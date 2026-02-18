// supabase/functions/parse-banner/index.ts
// Deno Edge Function — extracts structured event data from banner images via GPT-4o

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

// ── Types ───────────────────────────────────────────────────

interface RequestBody {
    banner_url: string;
    file_type?: "image" | "pdf";
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
    confidence: Record<string, "high" | "medium" | "low">;
}

// ── Extraction prompt ───────────────────────────────────────

const SYSTEM_PROMPT = `You are an event data extraction specialist. Extract structured data from educational event banners and brochures. Return ONLY valid JSON.`;

const USER_TEXT_PROMPT = `Extract the following fields from this event banner/brochure image.
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
  "confidence": {
    "event_name": "high"|"medium"|"low",
    "start_datetime": "high"|"medium"|"low",
    "venue": "high"|"medium"|"low"
  }
}
If a field is not present in the image, set it to null.
For dates, assume current year (${new Date().getFullYear()}) if not shown. Use 24-hour format.
Return ONLY the JSON, no markdown fences, no explanation.`;

// ── Helpers ─────────────────────────────────────────────────

/** Fetch file and return as base64 data URL */
async function fetchAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch banner: ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "image/png";
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Manual base64 encoding for Deno
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return { base64, mimeType: contentType };
}

/** Sanitise a string: trim and remove non-printable chars */
function sanitize(s: string | null | undefined): string | null {
    if (!s) return null;
    return s.trim().replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, "").trim() || null;
}

/** Validate and fix the extracted JSON */
function validate(raw: ExtractedEvent): ExtractedEvent {
    const result = { ...raw };

    // Ensure event_name is present
    result.event_name = sanitize(result.event_name) ?? "Untitled Event";

    // Sanitize strings
    result.venue = sanitize(result.venue);
    result.description = sanitize(result.description);
    result.organizer_club = sanitize(result.organizer_club);
    result.contact_info = sanitize(result.contact_info);

    // Validate dates
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
        if (isNaN(d.getTime())) {
            result.end_datetime = null;
        } else {
            result.end_datetime = d.toISOString();
        }
    }

    // start must be before end
    if (result.start_datetime && result.end_datetime) {
        if (new Date(result.start_datetime) >= new Date(result.end_datetime)) {
            // Swap or nullify end
            result.end_datetime = null;
        }
    }

    if (result.registration_deadline) {
        const d = new Date(result.registration_deadline);
        if (isNaN(d.getTime())) result.registration_deadline = null;
        else result.registration_deadline = d.toISOString();
    }

    // Validate category
    const validCategories = [
        "technical", "cultural", "social", "hackathon", "workshop", "seminar",
    ];
    if (result.category && !validCategories.includes(result.category)) {
        result.category = null;
    }

    // Ensure confidence object exists
    if (!result.confidence || typeof result.confidence !== "object") {
        result.confidence = {
            event_name: "low",
            start_datetime: "low",
            venue: "low",
        };
    }

    return result;
}

/** Attempt to parse GPT response as JSON, handling markdown fences */
function parseGptJson(text: string): ExtractedEvent {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
        cleaned = cleaned
            .replace(/^```(?:json)?\s*\n?/, "")
            .replace(/\n?```\s*$/, "");
    }

    try {
        return JSON.parse(cleaned) as ExtractedEvent;
    } catch {
        // Attempt to extract a JSON object from the text
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                return JSON.parse(match[0]) as ExtractedEvent;
            } catch {
                // fall through
            }
        }

        // Return a low-confidence fallback
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
            confidence: {
                event_name: "low",
                start_datetime: "low",
                venue: "low",
            },
        };
    }
}

// ── Main handler ────────────────────────────────────────────

serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
    }

    try {
        const body: RequestBody = await req.json();

        if (!body.banner_url) {
            return corsResponse(JSON.stringify({ error: "banner_url is required" }), 400);
        }

        // 1. Fetch and encode the banner
        const { base64, mimeType } = await fetchAsBase64(body.banner_url);

        // 2. Determine media type for GPT-4o vision
        const imageMediaType = mimeType.startsWith("image/") ? mimeType : "image/png";

        // 3. Call OpenAI
        const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
        if (!OPENAI_API_KEY) {
            return corsResponse(
                JSON.stringify({ error: "OPENAI_API_KEY is not configured" }),
                500,
            );
        }

        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: "gpt-4o",
                max_tokens: 1024,
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${imageMediaType};base64,${base64}`,
                                    detail: "high",
                                },
                            },
                            { type: "text", text: USER_TEXT_PROMPT },
                        ],
                    },
                ],
            }),
        });

        if (!openaiRes.ok) {
            const errBody = await openaiRes.text();
            console.error("OpenAI error:", openaiRes.status, errBody);
            return corsResponse(
                JSON.stringify({
                    error: "OpenAI API error",
                    detail: errBody,
                }),
                502,
            );
        }

        const openaiData = await openaiRes.json();
        const rawContent: string =
            openaiData?.choices?.[0]?.message?.content ?? "";

        // 4. Parse and validate
        const parsed = parseGptJson(rawContent);
        const validated = validate(parsed);

        // 5. Map to frontend-expected keys
        const response = {
            name: validated.event_name,
            description: validated.description,
            category: validated.category,
            venue: validated.venue,
            start_datetime: validated.start_datetime,
            end_datetime: validated.end_datetime,
            organizer_club: validated.organizer_club,
            contact_info: validated.contact_info,
            registration_deadline: validated.registration_deadline,
            confidence: validated.confidence,
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
