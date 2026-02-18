import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    ArrowLeft,
    Users,
    MapPin,
    Clock,
    Download,
    CheckCircle2,
    XCircle,
    Loader2,
    Calendar,
    Signal,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

import { supabase } from '../../api/supabase';
import QRCodePanel from '../../components/events/QRCodePanel';

// ── Types ───────────────────────────────────────────────────

interface EventRow {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    venue: string | null;
    start_datetime: string;
    end_datetime: string;
    banner_url: string | null;
    qr_code_token: string;
    geofence_lat: number | null;
    geofence_lng: number | null;
    geofence_radius_m: number;
    max_participants: number | null;
    status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
    learning_outcomes: string[] | null;
    difficulty_level: number;
    created_at: string;
}

interface Attendee {
    id: string;
    student_id: string;
    check_in_time: string | null;
    check_in_lat: number | null;
    check_in_lng: number | null;
    geofence_verified: boolean;
    profile: {
        full_name: string;
        email: string;
        department: string | null;
    } | null;
}

// ── Component ───────────────────────────────────────────────

export default function ClubEventDetail() {
    const { id: eventId } = useParams<{ id: string }>();

    const [event, setEvent] = useState<EventRow | null>(null);
    const [attendees, setAttendees] = useState<Attendee[]>([]);
    const [loading, setLoading] = useState(true);
    const [liveCount, setLiveCount] = useState(0);

    // ── Fetch event & attendees ─────────────────────────
    const fetchData = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);

        try {
            // Fetch event
            const { data: eventData, error: eventError } = await supabase
                .from('events')
                .select('*')
                .eq('id', eventId)
                .single();

            if (eventError) throw eventError;
            setEvent(eventData as EventRow);

            // Fetch attendees with profile join
            const { data: regData, error: regError } = await supabase
                .from('event_registrations')
                .select(`
                    id,
                    student_id,
                    check_in_time,
                    check_in_lat,
                    check_in_lng,
                    geofence_verified,
                    profile:profiles!event_registrations_student_id_fkey (
                        full_name,
                        email,
                        department
                    )
                `)
                .eq('event_id', eventId)
                .order('check_in_time', { ascending: false });

            if (regError) throw regError;

            const mapped = (regData ?? []).map((r: Record<string, unknown>) => ({
                id: r.id as string,
                student_id: r.student_id as string,
                check_in_time: r.check_in_time as string | null,
                check_in_lat: r.check_in_lat as number | null,
                check_in_lng: r.check_in_lng as number | null,
                geofence_verified: r.geofence_verified as boolean,
                profile: r.profile as Attendee['profile'],
            }));

            setAttendees(mapped);
            setLiveCount(mapped.filter((a) => a.check_in_time).length);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load event');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // ── Realtime subscription ───────────────────────────
    useEffect(() => {
        if (!eventId) return;

        const channel = supabase
            .channel(`event-registrations-${eventId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'event_registrations',
                    filter: `event_id=eq.${eventId}`,
                },
                async (payload) => {
                    // On any change, re-fetch attendees for simplicity
                    const { data } = await supabase
                        .from('event_registrations')
                        .select(`
                            id,
                            student_id,
                            check_in_time,
                            check_in_lat,
                            check_in_lng,
                            geofence_verified,
                            profile:profiles!event_registrations_student_id_fkey (
                                full_name,
                                email,
                                department
                            )
                        `)
                        .eq('event_id', eventId)
                        .order('check_in_time', { ascending: false });

                    if (data) {
                        const mapped = data.map((r: Record<string, unknown>) => ({
                            id: r.id as string,
                            student_id: r.student_id as string,
                            check_in_time: r.check_in_time as string | null,
                            check_in_lat: r.check_in_lat as number | null,
                            check_in_lng: r.check_in_lng as number | null,
                            geofence_verified: r.geofence_verified as boolean,
                            profile: r.profile as Attendee['profile'],
                        }));
                        setAttendees(mapped);
                        setLiveCount(mapped.filter((a) => a.check_in_time).length);
                    }
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [eventId]);

    // ── CSV export ──────────────────────────────────────
    const exportCsv = useCallback(() => {
        const checkedIn = attendees.filter((a) => a.check_in_time);
        if (checkedIn.length === 0) {
            toast.error('No check-ins to export');
            return;
        }

        const header = 'Name,Email,Department,Check-in Time,Geofence Verified,Latitude,Longitude';
        const rows = checkedIn.map((a) =>
            [
                `"${a.profile?.full_name ?? 'Unknown'}"`,
                `"${a.profile?.email ?? ''}"`,
                `"${a.profile?.department ?? ''}"`,
                `"${a.check_in_time ? format(new Date(a.check_in_time), 'yyyy-MM-dd HH:mm:ss') : ''}"`,
                a.geofence_verified ? 'Yes' : 'No',
                a.check_in_lat ?? '',
                a.check_in_lng ?? '',
            ].join(','),
        );

        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `${event?.name ?? 'event'}-attendees-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        toast.success(`Exported ${checkedIn.length} attendees`);
    }, [attendees, event]);

    // ── Stats ───────────────────────────────────────────
    const stats = useMemo(() => {
        const checkedIn = attendees.filter((a) => a.check_in_time);
        const verified = checkedIn.filter((a) => a.geofence_verified);
        return {
            total: attendees.length,
            checkedIn: checkedIn.length,
            verified: verified.length,
            unverified: checkedIn.length - verified.length,
        };
    }, [attendees]);

    // ── Loading ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                <p className="text-sm text-gray-500">Loading event…</p>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <XCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm text-gray-500">Event not found</p>
                <Link
                    to="/club/events"
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                    ← Back to events
                </Link>
            </div>
        );
    }

    const STATUS_COLORS: Record<string, string> = {
        upcoming: 'bg-blue-100 text-blue-700',
        ongoing: 'bg-emerald-100 text-emerald-700',
        completed: 'bg-gray-100 text-gray-600',
        cancelled: 'bg-red-100 text-red-600',
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* ── Header ─────────────────────────────────── */}
            <div className="flex items-start gap-3">
                <Link
                    to="/club/events"
                    className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 transition"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-2xl font-bold text-gray-900 truncate">
                            {event.name}
                        </h1>
                        <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[event.status] ?? 'bg-gray-100'
                                }`}
                        >
                            {event.status}
                        </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                        {event.venue && (
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" /> {event.venue}
                            </span>
                        )}
                        <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {format(new Date(event.start_datetime), 'MMM d, yyyy · h:mm a')}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format(new Date(event.end_datetime), 'h:mm a')}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Banner ─────────────────────────────────── */}
            {event.banner_url && (
                <div className="rounded-xl overflow-hidden border border-gray-200">
                    <img
                        src={event.banner_url}
                        alt={event.name}
                        className="w-full h-48 object-cover"
                    />
                </div>
            )}

            {/* ── Stats cards ────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                    label="Registered"
                    value={stats.total}
                    icon={<Users className="w-4 h-4 text-indigo-500" />}
                    color="indigo"
                />
                <StatCard
                    label="Checked In"
                    value={stats.checkedIn}
                    icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                    color="emerald"
                    live
                />
                <StatCard
                    label="Geo Verified"
                    value={stats.verified}
                    icon={<MapPin className="w-4 h-4 text-blue-500" />}
                    color="blue"
                />
                <StatCard
                    label="Unverified"
                    value={stats.unverified}
                    icon={<XCircle className="w-4 h-4 text-amber-500" />}
                    color="amber"
                />
            </div>

            {/* ── Main grid: QR + attendee table ─────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* QR code panel */}
                <div className="lg:col-span-1">
                    <QRCodePanel
                        eventId={event.id}
                        qrCodeToken={event.qr_code_token}
                        eventName={event.name}
                        onTokenRefreshed={() => fetchData()}
                    />
                </div>

                {/* Attendee table */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            Checked-in Students
                            <span className="flex items-center gap-1 text-[11px] font-normal text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">
                                <Signal className="w-3 h-3" /> Live
                            </span>
                        </h3>
                        <button
                            type="button"
                            onClick={exportCsv}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                        >
                            <Download className="w-3.5 h-3.5" /> Export CSV
                        </button>
                    </div>

                    {attendees.filter((a) => a.check_in_time).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400 text-sm">
                            <Users className="w-10 h-10 mb-2 opacity-40" />
                            No check-ins yet
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-gray-500 bg-gray-50">
                                            <th className="px-5 py-2.5 font-medium">#</th>
                                            <th className="px-5 py-2.5 font-medium">Student</th>
                                            <th className="px-5 py-2.5 font-medium">Department</th>
                                            <th className="px-5 py-2.5 font-medium">Check-in Time</th>
                                            <th className="px-5 py-2.5 font-medium text-center">
                                                Geo Status
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {attendees
                                            .filter((a) => a.check_in_time)
                                            .map((att, i) => (
                                                <tr
                                                    key={att.id}
                                                    className="hover:bg-gray-50 transition"
                                                >
                                                    <td className="px-5 py-3 text-gray-400 tabular-nums">
                                                        {i + 1}
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <div className="font-medium text-gray-800">
                                                            {att.profile?.full_name ?? 'Unknown'}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {att.profile?.email}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600">
                                                        {att.profile?.department ?? '—'}
                                                    </td>
                                                    <td className="px-5 py-3 text-gray-600 tabular-nums">
                                                        {att.check_in_time
                                                            ? format(
                                                                new Date(att.check_in_time),
                                                                'h:mm:ss a',
                                                            )
                                                            : '—'}
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <GeoStatusBadge
                                                            verified={att.geofence_verified}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="sm:hidden divide-y divide-gray-50">
                                {attendees
                                    .filter((a) => a.check_in_time)
                                    .map((att, i) => (
                                        <div key={att.id} className="px-4 py-3">
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">
                                                        {i + 1}. {att.profile?.full_name ?? 'Unknown'}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {att.profile?.department ?? '—'}
                                                    </p>
                                                </div>
                                                <GeoStatusBadge verified={att.geofence_verified} />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1 tabular-nums">
                                                {att.check_in_time &&
                                                    format(
                                                        new Date(att.check_in_time),
                                                        'h:mm:ss a',
                                                    )}
                                            </p>
                                        </div>
                                    ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

function StatCard({
    label,
    value,
    icon,
    color,
    live,
}: {
    label: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    live?: boolean;
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">{label}</span>
                <div className="flex items-center gap-1">
                    {icon}
                    {live && (
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                    )}
                </div>
            </div>
            <p className={`text-2xl font-bold text-${color}-600 tabular-nums`}>
                {value}
            </p>
        </div>
    );
}

function GeoStatusBadge({ verified }: { verified: boolean }) {
    return verified ? (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] font-medium px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Verified
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-600 text-[11px] font-medium px-2 py-0.5 rounded-full">
            <XCircle className="w-3 h-3" /> Unverified
        </span>
    );
}
