import { Clock, MapPin, User, Trash2 } from 'lucide-react';
import type { TimetableSession } from '../hooks/useTimetable';

// ── Subject color palette ───────────────────────────────────
const PALETTE = [
    { bg: 'bg-indigo-50', border: 'border-indigo-300', text: 'text-indigo-700', badge: 'bg-indigo-100' },
    { bg: 'bg-teal-50', border: 'border-teal-300', text: 'text-teal-700', badge: 'bg-teal-100' },
    { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-700', badge: 'bg-amber-100' },
    { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-700', badge: 'bg-rose-100' },
    { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-700', badge: 'bg-emerald-100' },
    { bg: 'bg-violet-50', border: 'border-violet-300', text: 'text-violet-700', badge: 'bg-violet-100' },
    { bg: 'bg-sky-50', border: 'border-sky-300', text: 'text-sky-700', badge: 'bg-sky-100' },
    { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-700', badge: 'bg-orange-100' },
];

export function getSubjectColor(subjectId: string, subjectIds: string[]) {
    const idx = subjectIds.indexOf(subjectId);
    return PALETTE[idx >= 0 ? idx % PALETTE.length : 0];
}

// ── Session type labels ─────────────────────────────────────
const TYPE_LABEL: Record<string, string> = {
    lecture: 'LEC',
    lab: 'LAB',
    tutorial: 'TUT',
};

interface TimetableCardProps {
    session: TimetableSession;
    subjectIds: string[];
    isToday?: boolean;
    onDelete?: (id: string) => void;
    compact?: boolean;
}

export default function TimetableCard({
    session,
    subjectIds,
    isToday = false,
    onDelete,
    compact = false,
}: TimetableCardProps) {
    const color = getSubjectColor(session.subject?.id ?? '', subjectIds);

    const formatTime = (t: string) => {
        const [h, m] = t.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}:${m} ${ampm}`;
    };

    return (
        <div
            className={`
        relative rounded-xl border-l-4 p-3 transition-shadow hover:shadow-md
        ${color.bg} ${color.border}
        ${isToday ? 'ring-2 ring-indigo-400 ring-offset-1' : ''}
        ${compact ? 'p-2' : ''}
      `}
        >
            {/* Subject name + code */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <h4 className={`font-semibold truncate text-sm ${color.text}`}>
                        {session.subject?.name ?? 'Unknown'}
                    </h4>
                    <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 ${color.badge} ${color.text}`}>
                        {session.subject?.code} · {TYPE_LABEL[session.session_type] ?? session.session_type}
                    </span>
                </div>

                {onDelete && (
                    <button
                        onClick={() => onDelete(session.id)}
                        className="p-1 rounded-lg text-gray-400 hover:bg-red-100 hover:text-red-500 transition shrink-0"
                        aria-label="Remove session"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Meta row */}
            <div className={`mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 ${compact ? 'mt-1' : ''}`}>
                <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatTime(session.start_time)} – {formatTime(session.end_time)}
                </span>

                {session.venue && (
                    <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {session.venue}
                    </span>
                )}

                {session.subject?.faculty && (
                    <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {session.subject.faculty.full_name}
                    </span>
                )}
            </div>
        </div>
    );
}
