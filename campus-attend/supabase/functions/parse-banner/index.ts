// supabase/functions/parse-banner/index.ts
// Deno Edge Function — extracts structured event data from banner images/PDFs via GPT-4o
// Supports multi-page PDFs with sliding window context approach

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

// pdf.js for server-side PDF → image rendering
import * as pdfjsLib from "https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs";

// ── CORS ────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "Authorization, Content-Type, x-client-info, apikey",
};

function corsResponse(body: string, status = 200) {
    return new Response(body, {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

// ── Constants ───────────────────────────────────────────────

const MAX_PDF_PAGES = 5;
const RENDER_SCALE = 2; // 2x for legibility
const BOTTOM_CROP_RATIO = 0.3; // bottom 30% of previous page for context

// ── Types ───────────────────────────────────────────────────

interface RequestBody {
    banner_url: string;
    file_type?: "image" | "pdf";
}

interface ScheduleDay {
    day: number;
    date: string | null;
    activities: string[];
}

interface ExtractedEvent {
    event_name: string | null;
    category:
    | "technical"
    | "cultural"
    | "social"
    | "hackathon"
    | "workshop"
    | "seminar"
    | null;
    venue: string | null;
    start_datetime: string | null;
    end_datetime: string | null;
    description: string | null;
    organizer_club: string | null;
    contact_info: string | null;
    registration_deadline: string | null;
    learning_outcomes: string[] | null;
    schedule: ScheduleDay[] | null;
    confidence: Record<string, "high" | "medium" | "low">;
}

interface FinalResponse {
    name: string | null;
    description: string | null;
    category: string | null;
    venue: string | null;
    start_datetime: string | null;
    end_datetime: string | null;
    organizer_club: string | null;
    contact_info: string | null;
    registration_deadline: string | null;
    learning_outcomes: string[] | null;
    schedule: ScheduleDay[] | null;
    confidence: Record<string, "high" | "medium" | "low">;
    is_multipage: boolean;
    pages_processed: number;
}

// ── Extraction prompts ──────────────────────────────────────

const SYSTEM_PROMPT = `You are an event data extraction specialist. Extract structured data from educational event banners and brochures. Return ONLY valid JSON.`;

const SINGLE_PAGE_PROMPT = `Extract the following fields from this event banner/brochure image.
Return ONLY a JSON object with these exact keys:
{
  "event_name": string,
  "category": "technical"|"cultural"|"social"|"hackathon"|"workshop"|"seminar",
  "venue": string | null,
  "start_datetime": "ISO 8601 string" | null,
  "end_datetime": "ISO 8601 string" | null,
  "description": string | null,
  "organizer_club": string | null,
  "contact_info": string | null,
  "registration_deadline": "ISO 8601 string" | null,
  "learning_outcomes": ["string", ...] | null,
  "schedule": [{ "day": number, "date": "ISO date" | null, "activities": ["string"] }] | null,
  "confidence": {
    "event_name": "high"|"medium"|"low",
    "start_datetime": "high"|"medium"|"low",
    "venue": "high"|"medium"|"low"
  }
}
If a field is not present in the image, set it to null.
For multi-day events (hackathons, fests), populate the "schedule" array with each day's activities.
For dates, assume current year (${new Date().getFullYear()}) if not shown. Use 24-hour format.
Return ONLY the JSON, no markdown fences, no explanation.`;

const CONTINUATION_PROMPT = `This is a continuation page from the same event brochure.
The first image shows the bottom of the previous page for context.
The second image is the new page.

Extract any ADDITIONAL information from this page. Return ONLY a JSON object:
{
  "event_name": string | null,
  "category": null,
  "venue": string | null,
  "start_datetime": null,
  "end_datetime": null,
  "description": string | null,
  "organizer_club": string | null,
  "contact_info": string | null,
  "registration_deadline": null,
  "learning_outcomes": ["string", ...] | null,
  "schedule": [{ "day": number, "date": "ISO date" | null, "activities": ["string"] }] | null,
  "confidence": {}
}
Only fill in fields that have NEW information on this page. Set everything else to null.
Focus especially on: schedule details, learning outcomes, contact info, descriptions.
Return ONLY the JSON, no markdown fences.`;

// ── Helpers ─────────────────────────────────────────────────

/** Encode Uint8Array to base64 */
function uint8ToBase64(bytes: Uint8Array): string {
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/** Fetch file and return as base64 + mime type */
async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch banner: ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    const base64 = uint8ToBase64(new Uint8Array(buffer));

    return { base64, mimeType: contentType };
}

/** Fetch raw bytes */
async function fetchBytes(url: string): Promise<Uint8Array> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
}

// ── PDF rendering ───────────────────────────────────────────

interface RenderedPage {
    /** Full page as base64 PNG */
    fullBase64: string;
    /** Bottom crop as base64 PNG (for sliding window context) */
    bottomCropBase64: string;
    width: number;
    height: number;
}

/**
 * Render a PDF page to a PNG base64 string using an OffscreenCanvas.
 * Also returns a bottom-crop for sliding window context.
 */
async function renderPdfPage(
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
): Promise<RenderedPage> {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const w = Math.floor(viewport.width);
    const h = Math.floor(viewport.height);

    // Use OffscreenCanvas (available in Deno Deploy)
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d") as OffscreenCanvasRenderingContext2D;

    await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport }).promise;

    // Full page → PNG blob → base64
    const fullBlob = await canvas.convertToBlob({ type: "image/png" });
    const fullBuffer = await fullBlob.arrayBuffer();
    const fullBase64 = uint8ToBase64(new Uint8Array(fullBuffer));

    // Bottom crop
    const cropY = Math.floor(h * (1 - BOTTOM_CROP_RATIO));
    const cropH = h - cropY;
    const cropCanvas = new OffscreenCanvas(w, cropH);
    const cropCtx = cropCanvas.getContext("2d") as OffscreenCanvasRenderingContext2D;
    // Draw the bottom portion
    cropCtx.drawImage(canvas, 0, cropY, w, cropH, 0, 0, w, cropH);
    const cropBlob = await cropCanvas.convertToBlob({ type: "image/png" });
    const cropBuffer = await cropBlob.arrayBuffer();
    const bottomCropBase64 = uint8ToBase64(new Uint8Array(cropBuffer));

    return { fullBase64, bottomCropBase64, width: w, height: h };
}

/** Render all pages (up to MAX_PDF_PAGES) of a PDF */
async function renderPdfPages(pdfBytes: Uint8Array): Promise<RenderedPage[]> {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;

    const totalPages = pdf.numPages;
    if (totalPages > MAX_PDF_PAGES) {
        throw new Error(
            `PDF has ${totalPages} pages, maximum supported is ${MAX_PDF_PAGES}`,
        );
    }

    const pages: RenderedPage[] = [];
    for (let i = 1; i <= totalPages; i++) {
        pages.push(await renderPdfPage(pdf, i));
    }
    return pages;
}

// ── GPT-4o calls ────────────────────────────────────────────

async function callGpt4o(
    apiKey: string,
    imageContents: Array<{ type: "image_url"; image_url: { url: string; detail: string } }>,
    textPrompt: string,
): Promise<string> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o",
            max_tokens: 2048,
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                {
                    role: "user",
                    content: [
                        ...imageContents,
                        { type: "text", text: textPrompt },
                    ],
                },
            ],
        }),
    });

    if (!res.ok) {
        const errBody = await res.text();
        console.error("OpenAI error:", res.status, errBody);
        throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
}

// ── JSON parsing ────────────────────────────────────────────

function parseGptJson(text: string): ExtractedEvent {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned
            .replace(/^```(?:json)?\s*\n?/, "")
            .replace(/\n?```\s*$/, "");
    }

    try {
        return JSON.parse(cleaned) as ExtractedEvent;
    } catch {
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]) as ExtractedEvent;
            } catch {
                // fall through
            }
        }

        return emptyExtraction();
    }
}

function emptyExtraction(): ExtractedEvent {
    return {
        event_name: null,
        category: null,
        venue: null,
        start_datetime: null,
        end_datetime: null,
        description: null,
        organizer_club: null,
        contact_info: null,
        registration_deadline: null,
        learning_outcomes: null,
        schedule: null,
        confidence: { event_name: "low", start_datetime: "low", venue: "low" },
    };
}

// ── Sanitize & validate ─────────────────────────────────────

function sanitize(s: string | null | undefined): string | null {
    if (!s) return null;
    return s.trim().replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "").trim() || null;
}

function validate(raw: ExtractedEvent): ExtractedEvent {
    const result = { ...raw };

    result.event_name = sanitize(result.event_name) ?? "Untitled Event";
    result.venue = sanitize(result.venue);
    result.description = sanitize(result.description);
    result.organizer_club = sanitize(result.organizer_club);
    result.contact_info = sanitize(result.contact_info);

    if (result.start_datetime) {
        const d = new Date(result.start_datetime);
        if (isNaN(d.getTime())) {
            result.start_datetime = null;
            if (result.confidence) result.confidence.start_datetime = "low";
        } else {
            result.start_datetime = d.toISOString();
        }
    }

    if (result.end_datetime) {
        const d = new Date(result.end_datetime);
        if (isNaN(d.getTime())) result.end_datetime = null;
        else result.end_datetime = d.toISOString();
    }

    if (result.start_datetime && result.end_datetime) {
        if (new Date(result.start_datetime) >= new Date(result.end_datetime)) {
            result.end_datetime = null;
        }
    }

    if (result.registration_deadline) {
        const d = new Date(result.registration_deadline);
        if (isNaN(d.getTime())) result.registration_deadline = null;
        else result.registration_deadline = d.toISOString();
    }

    const validCategories = [
        "technical", "cultural", "social", "hackathon", "workshop", "seminar",
    ];
    if (result.category && !validCategories.includes(result.category)) {
        result.category = null;
    }

    if (!result.confidence || typeof result.confidence !== "object") {
        result.confidence = { event_name: "low", start_datetime: "low", venue: "low" };
    }

    // Sanitize learning outcomes
    if (result.learning_outcomes && Array.isArray(result.learning_outcomes)) {
        result.learning_outcomes = result.learning_outcomes
            .map((o) => (typeof o === "string" ? o.trim() : ""))
            .filter(Boolean);
        if (result.learning_outcomes.length === 0) result.learning_outcomes = null;
    }

    // Validate schedule
    if (result.schedule && Array.isArray(result.schedule)) {
        result.schedule = result.schedule
            .filter(
                (s) =>
                    typeof s === "object" &&
                    s !== null &&
                    typeof s.day === "number" &&
                    Array.isArray(s.activities),
            )
            .map((s) => ({
                day: s.day,
                date: sanitize(s.date),
                activities: s.activities
                    .map((a: unknown) => (typeof a === "string" ? a.trim() : ""))
                    .filter(Boolean),
            }));
        if (result.schedule.length === 0) result.schedule = null;
    }

    return result;
}

// ── Merge extractions ───────────────────────────────────────

function mergeExtractions(base: ExtractedEvent, addition: ExtractedEvent): ExtractedEvent {
    const merged = { ...base };

    // Scalars: use first non-null
    const scalarKeys: (keyof ExtractedEvent)[] = [
        "event_name", "category", "venue", "start_datetime", "end_datetime",
        "description", "organizer_club", "contact_info", "registration_deadline",
    ];

    for (const key of scalarKeys) {
        if (merged[key] === null && addition[key] !== null) {
            // deno-lint-ignore no-explicit-any
            (merged as any)[key] = addition[key];
        }
    }

    // Description: append if both exist
    if (base.description && addition.description) {
        merged.description = `${base.description}\n\n${addition.description}`;
    }

    // Arrays: concatenate
    if (addition.learning_outcomes && addition.learning_outcomes.length > 0) {
        const existing = merged.learning_outcomes ?? [];
        const newItems = addition.learning_outcomes.filter(
            (o) => !existing.includes(o),
        );
        merged.learning_outcomes = [...existing, ...newItems];
    }

    if (addition.schedule && addition.schedule.length > 0) {
        const existing = merged.schedule ?? [];
        // Merge by day number, append new days
        for (const addDay of addition.schedule) {
            const existingDay = existing.find((e) => e.day === addDay.day);
            if (existingDay) {
                const newActivities = addDay.activities.filter(
                    (a) => !existingDay.activities.includes(a),
                );
                existingDay.activities.push(...newActivities);
                if (!existingDay.date && addDay.date) existingDay.date = addDay.date;
            } else {
                existing.push(addDay);
            }
        }
        merged.schedule = existing;
    }

    // Merge confidence — keep highest
    const confLevels: Record<string, number> = { high: 3, medium: 2, low: 1 };
    if (addition.confidence) {
        for (const [key, val] of Object.entries(addition.confidence)) {
            const current = merged.confidence?.[key];
            if (!current || (confLevels[val] ?? 0) > (confLevels[current] ?? 0)) {
                merged.confidence[key] = val;
            }
        }
    }

    return merged;
}

// ── Main handler ────────────────────────────────────────────

serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
    }

    try {
        const body: RequestBody = await req.json();

        if (!body.banner_url) {
            return corsResponse(
                JSON.stringify({ error: "banner_url is required" }),
                400,
            );
        }

        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            return corsResponse(
                JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
                500,
            );
        }

        // Detect file type
        const isPdf =
            body.file_type === "pdf" ||
            body.banner_url.toLowerCase().endsWith(".pdf") ||
            body.banner_url.includes("application/pdf");

        let finalResult: ExtractedEvent;
        let pagesProcessed = 1;
        let isMultipage = false;

        if (!isPdf) {
            // ── Single image flow ─────────────────────────
            const { base64, mimeType } = await fetchAsBase64(body.banner_url);
            const imageMediaType = mimeType.startsWith("image/")
                ? mimeType
                : "image/png";

            const rawContent = await callGpt4o(
                OPENAI_API_KEY,
                [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:${imageMediaType};base64,${base64}`,
                            detail: "high",
                        },
                    },
                ],
                SINGLE_PAGE_PROMPT,
            );

            finalResult = validate(parseGptJson(rawContent));
        } else {
            // ── Multi-page PDF flow ───────────────────────
            const pdfBytes = await fetchBytes(body.banner_url);
            const pages = await renderPdfPages(pdfBytes);

            pagesProcessed = pages.length;
            isMultipage = pages.length > 1;

            // Page 1: extract as normal
            const page1Content = await callGpt4o(
                OPENAI_API_KEY,
                [
                    {
                        type: "image_url",
                        image_url: {
                            url: `data:image/png;base64,${pages[0].fullBase64}`,
                            detail: "high",
                        },
                    },
                ],
                SINGLE_PAGE_PROMPT,
            );

            finalResult = validate(parseGptJson(page1Content));

            // Subsequent pages: sliding window [bottom_crop(prev) + full(current)]
            for (let i = 1; i < pages.length; i++) {
                const prevBottomCrop = pages[i - 1].bottomCropBase64;
                const currentFull = pages[i].fullBase64;

                const pageContent = await callGpt4o(
                    OPENAI_API_KEY,
                    [
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${prevBottomCrop}`,
                                detail: "low",
                            },
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${currentFull}`,
                                detail: "high",
                            },
                        },
                    ],
                    CONTINUATION_PROMPT,
                );

                const pageExtraction = parseGptJson(pageContent);
                finalResult = mergeExtractions(finalResult, pageExtraction);
            }

            // Re-validate merged result
            finalResult = validate(finalResult);
        }

        // Build response
        const response: FinalResponse = {
            name: finalResult.event_name,
            description: finalResult.description,
            category: finalResult.category,
            venue: finalResult.venue,
            start_datetime: finalResult.start_datetime,
            end_datetime: finalResult.end_datetime,
            organizer_club: finalResult.organizer_club,
            contact_info: finalResult.contact_info,
            registration_deadline: finalResult.registration_deadline,
            learning_outcomes: finalResult.learning_outcomes,
            schedule: finalResult.schedule,
            confidence: finalResult.confidence,
            is_multipage: isMultipage,
            pages_processed: pagesProcessed,
        };

        return corsResponse(JSON.stringify(response));
    } catch (err) {
        console.error("parse-banner error:", err);
        return corsResponse(
            JSON.stringify({
                error: "Internal server error",
                message: err instanceof Error ? err.message : String(err),
            }),
            500,
        );
    }
});
