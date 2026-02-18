import { useState } from 'react';
import { format } from 'date-fns';
import {
    Loader2,
    CheckCircle2,
    XCircle,
    MessageSquare,
    Calendar,
    Clock,
    PartyPopper,
    Bot,
    Filter,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
    useFacultyODRequests,
    useResolveODRequest,
    type ODRequest,
} from '../../hooks/useFacultyAttendance';

type TabFilter = 'all' | 'pending' | 'approved' | 'rejected';

export default function FacultyRequestsPage() {
    const { data: requests, isLoading } = useFacultyODRequests();
    const resolve = useResolveODRequest();
    const [tab, setTab] = useState<TabFilter>('pending');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const filtered = (requests ?? []).filter(
        (r) => tab === 'all' || r.status === tab,
    );

    const counts = {
        all: (requests ?? []).length,
        pending: (requests ?? []).filter((r) => r.status === 'pending').length,
        approved: (requests ?? []).filter((r) => r.status === 'approved').length,
        rejected: (requests ?? []).filter((r) => r.status === 'rejected').length,
    };

    const handleAction = async (req: ODRequest, action: 'approved' | 'rejected') => {
        try {
            await resolve.mutateAsync({
                requestId: req.id,
                action,
                studentId: req.student?.id,
                sessionId: req.class_session?.id,
            });
            toast.success(action === 'approved' ? 'Request approved' : 'Request rejected');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Action failed');
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">OD Requests</h1>

            {/* ── Filter tabs ──────────────────────────────────── */}
            <div className="flex items-center gap-1 border border-gray-200 rounded-xl bg-white p-1 w-fit">
                {(['pending', 'approved', 'rejected', 'all'] as TabFilter[]).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${tab === t
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        <Filter className="w-3 h-3" />
                        {t}
                        <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${tab === t ? 'bg-indigo-200 text-indigo-800' : 'bg-gray-100 text-gray-400'
                            }`}>
                            {counts[t]}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Requests list ────────────────────────────────── */}
            {filtered.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center">
                    <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">No {tab === 'all' ? '' : tab} requests.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((req) => (
                        <RequestCard
                            key={req.id}
                            req={req}
                            isExpanded={expandedId === req.id}
                            onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
                            onApprove={() => handleAction(req, 'approved')}
                            onReject={() => handleAction(req, 'rejected')}
                            isPending={resolve.isPending}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Request card sub-component ──────────────────────────────

function RequestCard({
    req,
    isExpanded,
    onToggle,
    onApprove,
    onReject,
    isPending,
}: {
    req: ODRequest;
    isExpanded: boolean;
    onToggle: () => void;
    onApprove: () => void;
    onReject: () => void;
    isPending: boolean;
}) {
    const statusBadge = {
        pending: 'bg-amber-100 text-amber-700',
        approved: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-600',
        escalated: 'bg-violet-100 text-violet-700',
    }[req.status] ?? 'bg-gray-100 text-gray-500';

    const eventName = req.event_registration?.event?.name ?? '—';
    const eventDate = req.event_registration?.event?.start_datetime
        ? format(new Date(req.event_registration.event.start_datetime), 'dd MMM yyyy')
        : '—';
    const sessionDate = req.class_session?.scheduled_date
        ? format(new Date(req.class_session.scheduled_date), 'dd MMM yyyy')
        : '—';
    const sessionTime = req.class_session?.start_time ?? '';

    // Try to extract a preview from AI message log
    const aiPreview = req.ai_message_log?.length
        ? String((req.ai_message_log[req.ai_message_log.length - 1] as Record<string, unknown>)?.content ?? '').slice(0, 120)
        : null;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden transition hover:shadow-sm">
            {/* Main row */}
            <button
                onClick={onToggle}
                className="w-full text-left px-5 py-4 flex items-center gap-4"
            >
                {/* Student avatar placeholder */}
                <div className="shrink-0 w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                    {(req.student?.full_name ?? '?')[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">{req.student?.full_name ?? 'Unknown'}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${statusBadge}`}>
                            {req.status}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {req.subject?.code} · {eventName} · {format(new Date(req.created_at), 'dd MMM, h:mm a')}
                    </p>
                </div>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                    {/* Info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <DetailChip icon={PartyPopper} label="Event" value={eventName} />
                        <DetailChip icon={Calendar} label="Event Date" value={eventDate} />
                        <DetailChip icon={Calendar} label="Class Date" value={sessionDate} />
                        <DetailChip icon={Clock} label="Class Time" value={sessionTime || '—'} />
                    </div>

                    {/* Subject */}
                    <p className="text-xs text-gray-600">
                        <span className="font-medium">Subject:</span> {req.subject?.code} — {req.subject?.name}
                    </p>

                    {/* AI Message Preview */}
                    {aiPreview && (
                        <div className="flex items-start gap-2 bg-violet-50 rounded-lg p-3 text-xs text-violet-800">
                            <Bot className="w-4 h-4 shrink-0 mt-0.5" />
                            <p className="line-clamp-3">{aiPreview}…</p>
                        </div>
                    )}

                    {/* Faculty response */}
                    {req.faculty_response && (
                        <p className="text-xs text-gray-600">
                            <span className="font-medium">Your response:</span> {req.faculty_response}
                        </p>
                    )}

                    {/* Action buttons — only for pending */}
                    {req.status === 'pending' && (
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={onApprove}
                                disabled={isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
                            >
                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Approve
                            </button>
                            <button
                                onClick={onReject}
                                disabled={isPending}
                                className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-60 transition"
                            >
                                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                Reject
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Detail chip ─────────────────────────────────────────────

function DetailChip({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof Calendar;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-2">
            <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <div className="min-w-0">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{label}</p>
                <p className="font-medium text-gray-700 truncate">{value}</p>
            </div>
        </div>
    );
}
