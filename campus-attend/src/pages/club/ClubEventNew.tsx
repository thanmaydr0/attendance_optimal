import {
    useState,
    useRef,
    useEffect,
    useCallback,
    type FormEvent,
    type DragEvent,
} from 'react';
import {
    Upload,
    Bot,
    Loader2,
    CheckCircle2,
    Star,
    X,
    Plus,
    MapPin,
    Download,
    Copy,
    ExternalLink,
    ChevronDown,
    Calendar,
    FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
    useEventForm,
    type EventCategory,
    type ScheduleDay,
} from '../../hooks/useEventForm';

// ── Constants ───────────────────────────────────────────────

const CATEGORIES: { value: EventCategory; label: string }[] = [
    { value: 'technical', label: 'Technical' },
    { value: 'cultural', label: 'Cultural' },
    { value: 'social', label: 'Social' },
    { value: 'hackathon', label: 'Hackathon' },
    { value: 'workshop', label: 'Workshop' },
    { value: 'seminar', label: 'Seminar' },
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

const CONFIDENCE_COLORS: Record<string, string> = {
    high: 'bg-emerald-100 text-emerald-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-600',
};

const SHARE_BASE = 'https://campusattend.app/checkin';

// ── Component ───────────────────────────────────────────────

export default function NewEventPage() {
    const {
        bannerUrl,
        parsing,
        parsed,
        form,
        uploading,
        creating,
        created,
        uploadAndParse,
        updateField,
        createEvent,
        reset,
    } = useEventForm();

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── File handling ─────────────────────────────────────
    const handleFile = useCallback(
        async (file: File) => {
            if (!ACCEPTED_TYPES.includes(file.type)) {
                toast.error('Only JPG, PNG, or PDF files are accepted.');
                return;
            }
            if (file.size > MAX_FILE_SIZE) {
                toast.error('File must be under 10 MB.');
                return;
            }
            try {
                await uploadAndParse(file);
                setStep(2);
                toast.success('Banner processed! Review the extracted details.');
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Upload failed');
            }
        },
        [uploadAndParse],
    );

    const onDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    };

    const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    // ── Form submit ───────────────────────────────────────
    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (!form.name) { toast.error('Event name is required'); return; }
        if (!form.start_datetime || !form.end_datetime) {
            toast.error('Start and end date/time are required');
            return;
        }

        try {
            await createEvent();
            setStep(3);
            toast.success('Event created! 🎉');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to create event');
        }
    };

    // ── Shared input class ────────────────────────────────
    const inputCls =
        'block w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition';

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* ── Header ────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Create Event</h1>
                {step > 1 && step < 3 && (
                    <button
                        onClick={() => { reset(); setStep(1); }}
                        className="text-sm text-gray-500 hover:text-gray-700 transition"
                    >
                        Start over
                    </button>
                )}
            </div>

            {/* ── Step indicators ───────────────────────────── */}
            <div className="flex items-center gap-2 text-xs font-semibold">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="flex items-center gap-1.5">
                        <span
                            className={`flex items-center justify-center w-6 h-6 rounded-full transition ${step >= s
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-500'
                                }`}
                        >
                            {step > s ? <CheckCircle2 className="w-3.5 h-3.5" /> : s}
                        </span>
                        <span className={step >= s ? 'text-gray-900' : 'text-gray-400'}>
                            {s === 1 ? 'Banner' : s === 2 ? 'Details' : 'Done'}
                        </span>
                        {s < 3 && <div className="w-8 h-px bg-gray-300" />}
                    </div>
                ))}
            </div>

            {/* ═══════════════════════════════════════════════════
          STEP 1: Banner Upload
         ═══════════════════════════════════════════════════ */}
            {step === 1 && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
                    {/* Parsing state */}
                    {(uploading || parsing) ? (
                        <div className="flex flex-col items-center justify-center py-16 space-y-4">
                            <div className="relative">
                                <Bot className="w-12 h-12 text-indigo-600 animate-bounce" />
                                <Loader2 className="absolute -bottom-1 -right-1 w-5 h-5 text-indigo-400 animate-spin" />
                            </div>
                            <p className="text-sm font-medium text-gray-700">
                                {uploading ? '📤 Uploading banner…' : '🤖 AI is reading your banner…'}
                            </p>
                            <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 rounded-full animate-pulse" style={{ width: uploading ? '40%' : '70%' }} />
                            </div>
                        </div>
                    ) : (
                        /* Drop zone */
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-xl cursor-pointer transition ${dragOver
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                                }`}
                        >
                            <Upload className="w-10 h-10 text-gray-400 mb-3" />
                            <p className="text-sm font-medium text-gray-700">
                                Drop your event banner here
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                                JPG, PNG, or PDF — up to 10 MB
                            </p>
                            <button
                                type="button"
                                className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-800 transition"
                            >
                                <Upload className="w-4 h-4" /> Upload & Auto-Extract
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.pdf"
                                onChange={onFileSelect}
                                className="hidden"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════
          STEP 2: Event Details Form
         ═══════════════════════════════════════════════════ */}
            {step === 2 && (
                <form onSubmit={handleCreate} className="space-y-5">
                    {/* Banner preview */}
                    {bannerUrl && (
                        <div className="rounded-xl overflow-hidden border border-gray-200">
                            <img src={bannerUrl} alt="Event banner" className="w-full h-40 object-cover" />
                        </div>
                    )}

                    {/* AI confidence notice */}
                    {parsed && (
                        <div className="flex items-start gap-2 bg-violet-50 rounded-lg p-3 text-xs text-violet-800">
                            <Bot className="w-4 h-4 shrink-0 mt-0.5" />
                            <p>
                                AI auto-filled the form below. Fields with confidence indicators may need review.
                                <span className="ml-1 font-medium">All fields are editable.</span>
                            </p>
                        </div>
                    )}

                    {/* Multipage PDF badge */}
                    {parsed?.is_multipage && (
                        <div className="flex items-center gap-2 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                            <FileText className="w-4 h-4 shrink-0" />
                            <p>
                                Multi-page PDF detected — <span className="font-semibold">{parsed.pages_processed} pages</span> processed.
                            </p>
                        </div>
                    )}

                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                        {/* Event Name */}
                        <FieldWithConfidence
                            label="Event Name"
                            confidence={parsed?.confidence?.name}
                        >
                            <input
                                type="text"
                                value={form.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className={inputCls}
                                placeholder="Annual Tech Hackathon 2026"
                                required
                            />
                        </FieldWithConfidence>

                        {/* Category */}
                        <FieldWithConfidence
                            label="Category"
                            confidence={parsed?.confidence?.category}
                        >
                            <select
                                value={form.category}
                                onChange={(e) => updateField('category', e.target.value as EventCategory)}
                                className={inputCls}
                            >
                                <option value="">Select category…</option>
                                {CATEGORIES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </FieldWithConfidence>

                        {/* Venue */}
                        <FieldWithConfidence
                            label="Venue"
                            confidence={parsed?.confidence?.venue}
                        >
                            <input
                                type="text"
                                value={form.venue}
                                onChange={(e) => updateField('venue', e.target.value)}
                                className={inputCls}
                                placeholder="Auditorium, Main Block"
                            />
                        </FieldWithConfidence>

                        {/* Date/Time */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FieldWithConfidence
                                label="Start Date & Time"
                                confidence={parsed?.confidence?.start_datetime}
                            >
                                <input
                                    type="datetime-local"
                                    value={form.start_datetime}
                                    onChange={(e) => updateField('start_datetime', e.target.value)}
                                    className={inputCls}
                                    required
                                />
                            </FieldWithConfidence>

                            <FieldWithConfidence
                                label="End Date & Time"
                                confidence={parsed?.confidence?.end_datetime}
                            >
                                <input
                                    type="datetime-local"
                                    value={form.end_datetime}
                                    onChange={(e) => updateField('end_datetime', e.target.value)}
                                    className={inputCls}
                                    required
                                />
                            </FieldWithConfidence>
                        </div>

                        {/* Description */}
                        <FieldWithConfidence
                            label="Description"
                            confidence={parsed?.confidence?.description}
                        >
                            <textarea
                                value={form.description}
                                onChange={(e) => updateField('description', e.target.value)}
                                className={`${inputCls} min-h-[80px] resize-y`}
                                placeholder="Describe the event…"
                                rows={3}
                            />
                        </FieldWithConfidence>

                        {/* Learning Outcomes (tag input) */}
                        <FieldWithConfidence
                            label="Learning Outcomes"
                            confidence={parsed?.confidence?.learning_outcomes}
                        >
                            <TagInput
                                tags={form.learning_outcomes}
                                onChange={(tags) => updateField('learning_outcomes', tags)}
                            />
                        </FieldWithConfidence>

                        {/* Schedule (from multi-day events / hackathons) */}
                        {parsed?.schedule && parsed.schedule.length > 0 && (
                            <ScheduleSection schedule={parsed.schedule} />
                        )}

                        {/* Max Participants + Difficulty */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Max Participants
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    value={form.max_participants}
                                    onChange={(e) =>
                                        updateField('max_participants', e.target.value ? Number(e.target.value) : '')
                                    }
                                    className={inputCls}
                                    placeholder="Leave empty for unlimited"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Difficulty Level
                                </label>
                                <StarRating
                                    value={form.difficulty_level}
                                    onChange={(v) => updateField('difficulty_level', v)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Geofence map */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-indigo-500" /> Geofence Location
                        </h3>
                        <p className="text-xs text-gray-400">
                            Click on the map to set the check-in location, or enter coordinates manually.
                        </p>
                        <LeafletMapPicker
                            lat={form.geofence_lat !== '' ? Number(form.geofence_lat) : null}
                            lng={form.geofence_lng !== '' ? Number(form.geofence_lng) : null}
                            onChange={(lat, lng) => {
                                updateField('geofence_lat', lat);
                                updateField('geofence_lng', lng);
                            }}
                        />
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-[11px] text-gray-500 mb-0.5">Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={form.geofence_lat}
                                    onChange={(e) => updateField('geofence_lat', e.target.value ? Number(e.target.value) : '')}
                                    className={inputCls}
                                    placeholder="12.9716"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-gray-500 mb-0.5">Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    value={form.geofence_lng}
                                    onChange={(e) => updateField('geofence_lng', e.target.value ? Number(e.target.value) : '')}
                                    className={inputCls}
                                    placeholder="77.5946"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] text-gray-500 mb-0.5">Radius (m)</label>
                                <input
                                    type="number"
                                    min={10}
                                    max={5000}
                                    value={form.geofence_radius_m}
                                    onChange={(e) => updateField('geofence_radius_m', Number(e.target.value))}
                                    className={inputCls}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={creating}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-60 transition"
                    >
                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {creating ? 'Creating…' : 'Create Event'}
                    </button>
                </form>
            )}

            {/* ═══════════════════════════════════════════════════
          STEP 3: QR Code + Share
         ═══════════════════════════════════════════════════ */}
            {step === 3 && created && (
                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6 text-center">
                    <div className="space-y-2">
                        <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                        <h2 className="text-xl font-bold text-gray-900">Event Created!</h2>
                        <p className="text-sm text-gray-500">
                            Share this QR code with students to enable check-in.
                        </p>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center" id="event-qr">
                        <div className="bg-white p-4 rounded-2xl shadow-lg border border-gray-100">
                            <QRCodeSVG
                                value={`${SHARE_BASE}/${created.qr_code_token}`}
                                size={200}
                                level="H"
                                includeMargin
                            />
                        </div>
                    </div>

                    {/* Share link */}
                    <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-3 mx-auto max-w-md">
                        <input
                            readOnly
                            value={`${SHARE_BASE}/${created.qr_code_token}`}
                            className="flex-1 bg-transparent text-sm text-gray-700 outline-none truncate"
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${SHARE_BASE}/${created.qr_code_token}`);
                                toast.success('Link copied!');
                            }}
                            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition"
                        >
                            <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                        <a
                            href={`${SHARE_BASE}/${created.qr_code_token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition"
                        >
                            <ExternalLink className="w-4 h-4 text-gray-500" />
                        </a>
                    </div>

                    {/* Download */}
                    <button
                        onClick={() => {
                            const svg = document.querySelector('#event-qr svg');
                            if (!svg) return;
                            const svgData = new XMLSerializer().serializeToString(svg);
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            const img = new Image();
                            img.onload = () => {
                                canvas.width = img.width;
                                canvas.height = img.height;
                                ctx?.drawImage(img, 0, 0);
                                const a = document.createElement('a');
                                a.download = `event-qr-${created.qr_code_token.slice(0, 8)}.png`;
                                a.href = canvas.toDataURL('image/png');
                                a.click();
                            };
                            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                    >
                        <Download className="w-4 h-4" /> Download QR (PNG)
                    </button>

                    {/* New event */}
                    <button
                        onClick={() => { reset(); setStep(1); }}
                        className="block mx-auto text-sm text-indigo-600 hover:text-indigo-700 font-medium transition"
                    >
                        + Create another event
                    </button>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

// ── Field with confidence indicator ─────────────────────────

function FieldWithConfidence({
    label,
    confidence,
    children,
}: {
    label: string;
    confidence?: 'high' | 'medium' | 'low';
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-1">
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                {confidence && (
                    <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CONFIDENCE_COLORS[confidence]}`}
                    >
                        {confidence}
                    </span>
                )}
            </div>
            {children}
        </div>
    );
}

// ── Star rating ─────────────────────────────────────────────

function StarRating({
    value,
    onChange,
}: {
    value: number;
    onChange: (v: number) => void;
}) {
    return (
        <div className="flex gap-1 mt-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
                <button
                    key={s}
                    type="button"
                    onClick={() => onChange(s)}
                    className="transition hover:scale-110"
                >
                    <Star
                        className={`w-6 h-6 ${s <= value
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-gray-300'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}

// ── Tag input (learning outcomes) ───────────────────────────

function TagInput({
    tags,
    onChange,
}: {
    tags: string[];
    onChange: (tags: string[]) => void;
}) {
    const [input, setInput] = useState('');

    const addTag = () => {
        const trimmed = input.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
        }
        setInput('');
    };

    return (
        <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={() => onChange(tags.filter((t) => t !== tag))}
                            className="hover:text-red-500 transition"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addTag(); }
                    }}
                    className="flex-1 rounded-lg border border-gray-300 py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                    placeholder="Type and press Enter…"
                />
                <button
                    type="button"
                    onClick={addTag}
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-gray-100 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-200 transition"
                >
                    <Plus className="w-3.5 h-3.5" /> Add
                </button>
            </div>
        </div>
    );
}

// ── Schedule section (collapsible) ────────────────────────────

function ScheduleSection({ schedule }: { schedule: ScheduleDay[] }) {
    const [open, setOpen] = useState(true);

    return (
        <div className="border border-indigo-100 rounded-lg overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-left"
            >
                <span className="flex items-center gap-2 text-sm font-semibold text-indigo-800">
                    <Calendar className="w-4 h-4" />
                    Event Schedule ({schedule.length} day{schedule.length > 1 ? 's' : ''})
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-indigo-500 transition-transform ${open ? 'rotate-180' : ''
                        }`}
                />
            </button>

            {open && (
                <div className="divide-y divide-indigo-50">
                    {schedule.map((day) => (
                        <div key={day.day} className="px-4 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                                    {day.day}
                                </span>
                                <span className="text-sm font-medium text-gray-800">
                                    Day {day.day}
                                    {day.date && (
                                        <span className="ml-1.5 text-gray-400 font-normal">
                                            — {new Date(day.date).toLocaleDateString('en-IN', {
                                                weekday: 'short',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </span>
                                    )}
                                </span>
                            </div>
                            <ul className="ml-8 space-y-1">
                                {day.activities.map((activity, i) => (
                                    <li
                                        key={i}
                                        className="flex items-start gap-1.5 text-sm text-gray-600"
                                    >
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                                        {activity}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Leaflet map picker ──────────────────────────────────────

function LeafletMapPicker({
    lat,
    lng,
    onChange,
}: {
    lat: number | null;
    lng: number | null;
    onChange: (lat: number, lng: number) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);

    useEffect(() => {
        if (!containerRef.current || mapRef.current) return;

        const defaultLat = lat ?? 12.9716;
        const defaultLng = lng ?? 77.5946;

        const map = L.map(containerRef.current).setView([defaultLat, defaultLng], 15);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
        }).addTo(map);

        // Add initial marker if coordinates exist
        if (lat !== null && lng !== null) {
            markerRef.current = L.marker([lat, lng]).addTo(map);
        }

        // Click to place marker
        map.on('click', (e: L.LeafletMouseEvent) => {
            const { lat: clickLat, lng: clickLng } = e.latlng;
            if (markerRef.current) {
                markerRef.current.setLatLng([clickLat, clickLng]);
            } else {
                markerRef.current = L.marker([clickLat, clickLng]).addTo(map);
            }
            onChange(
                Math.round(clickLat * 1_000_000) / 1_000_000,
                Math.round(clickLng * 1_000_000) / 1_000_000,
            );
        });

        mapRef.current = map;

        return () => {
            map.remove();
            mapRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Sync marker when lat/lng change externally
    useEffect(() => {
        if (!mapRef.current) return;
        if (lat !== null && lng !== null) {
            if (markerRef.current) {
                markerRef.current.setLatLng([lat, lng]);
            } else {
                markerRef.current = L.marker([lat, lng]).addTo(mapRef.current);
            }
            mapRef.current.setView([lat, lng], mapRef.current.getZoom());
        }
    }, [lat, lng]);

    return (
        <div
            ref={containerRef}
            className="w-full h-56 rounded-lg overflow-hidden border border-gray-200 z-0"
        />
    );
}
