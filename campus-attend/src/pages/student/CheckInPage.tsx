import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
    Loader2,
    MapPin,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    Shield,
    PartyPopper,
    Navigation,
} from 'lucide-react';
import toast from 'react-hot-toast';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import confetti from 'canvas-confetti';

import { supabase } from '../../api/supabase';
import { useAuth } from '../../hooks/useAuth';

// ── Types ───────────────────────────────────────────────────

interface EventRow {
    id: string;
    name: string;
    description: string | null;
    venue: string | null;
    start_datetime: string;
    end_datetime: string;
    banner_url: string | null;
    qr_code_token: string;
    geofence_lat: number | null;
    geofence_lng: number | null;
    geofence_radius_m: number;
    status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
}

type Step = 'validating' | 'geo' | 'confirming' | 'done' | 'error';

interface GeoResult {
    lat: number;
    lng: number;
    distance: number; // metres
    verified: boolean;
}

// ── Haversine distance ──────────────────────────────────────

function haversineM(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
): number {
    const R = 6_371_000; // Earth radius in metres
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Component ───────────────────────────────────────────────

export default function CheckInPage() {
    const { token } = useParams<{ token: string }>();
    const { user } = useAuth();

    const [step, setStep] = useState<Step>('validating');
    const [event, setEvent] = useState<EventRow | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [geo, setGeo] = useState<GeoResult | null>(null);
    const [geoLoading, setGeoLoading] = useState(false);
    const [overrideReason, setOverrideReason] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [odResults, setOdResults] = useState<{ subject: string; faculty: string }[]>([]);

    // ── Step 1: Validate QR Token ───────────────────────
    useEffect(() => {
        if (!token) {
            setErrorMsg('No check-in token provided.');
            setStep('error');
            return;
        }

        const validate = async () => {
            try {
                // Fetch event by QR token
                const { data, error } = await supabase
                    .from('events')
                    .select('*')
                    .eq('qr_code_token', token)
                    .single();

                if (error || !data) {
                    setErrorMsg('Invalid or expired QR code. This event may no longer exist.');
                    setStep('error');
                    return;
                }

                const evt = data as EventRow;

                // Check status
                if (evt.status === 'cancelled') {
                    setErrorMsg('This event has been cancelled.');
                    setStep('error');
                    return;
                }
                if (evt.status === 'completed') {
                    setErrorMsg('This event has already ended. Check-in is closed.');
                    setStep('error');
                    return;
                }

                // Check time window: start_datetime - 30min → end_datetime
                const now = new Date();
                const start = new Date(evt.start_datetime);
                const end = new Date(evt.end_datetime);
                const earlyWindow = new Date(start.getTime() - 30 * 60 * 1000);

                if (now < earlyWindow) {
                    const mins = Math.ceil((earlyWindow.getTime() - now.getTime()) / 60000);
                    setErrorMsg(
                        `Check-in hasn't opened yet. It opens 30 minutes before the event starts (in ~${mins} min).`,
                    );
                    setStep('error');
                    return;
                }
                if (now > end) {
                    setErrorMsg('The event has ended. Check-in is closed.');
                    setStep('error');
                    return;
                }

                // Check if student already checked in
                if (user) {
                    const { data: existing } = await supabase
                        .from('event_registrations')
                        .select('id, check_in_time')
                        .eq('event_id', evt.id)
                        .eq('student_id', user.id)
                        .maybeSingle();

                    if (existing?.check_in_time) {
                        setEvent(evt);
                        setErrorMsg('You have already checked in to this event!');
                        setStep('error');
                        return;
                    }
                }

                setEvent(evt);
                setStep('geo');
            } catch {
                setErrorMsg('Something went wrong while validating the QR code.');
                setStep('error');
            }
        };

        validate();
    }, [token, user]);

    // ── Step 2: Geolocation ─────────────────────────────
    const requestGeo = useCallback(() => {
        if (!event) return;
        setGeoLoading(true);

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const studentLat = pos.coords.latitude;
                const studentLng = pos.coords.longitude;

                if (event.geofence_lat != null && event.geofence_lng != null) {
                    const dist = haversineM(
                        studentLat,
                        studentLng,
                        event.geofence_lat,
                        event.geofence_lng,
                    );

                    setGeo({
                        lat: studentLat,
                        lng: studentLng,
                        distance: Math.round(dist),
                        verified: dist <= event.geofence_radius_m,
                    });
                } else {
                    // No geofence set — auto-verify
                    setGeo({
                        lat: studentLat,
                        lng: studentLng,
                        distance: 0,
                        verified: true,
                    });
                }
                setGeoLoading(false);
            },
            (err) => {
                toast.error(
                    err.code === 1
                        ? 'Location access denied. Please allow location in your browser.'
                        : 'Unable to determine your location. Please try again.',
                );
                setGeoLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    }, [event]);

    // Auto-request geo when entering geo step
    useEffect(() => {
        if (step === 'geo' && !geo && !geoLoading) {
            requestGeo();
        }
    }, [step, geo, geoLoading, requestGeo]);

    // ── Step 3: Confirm check-in ────────────────────────
    const handleCheckIn = useCallback(async () => {
        if (!event || !user || !geo) return;
        setConfirming(true);

        try {
            // Upsert registration + check-in
            const { error: regError } = await supabase
                .from('event_registrations')
                .upsert(
                    {
                        event_id: event.id,
                        student_id: user.id,
                        check_in_time: new Date().toISOString(),
                        check_in_lat: geo.lat,
                        check_in_lng: geo.lng,
                        geofence_verified: geo.verified,
                    },
                    { onConflict: 'event_id,student_id' },
                );

            if (regError) throw regError;

            // 🎉 Fire confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6'],
            });

            setStep('done');

            // ── Step 4: Auto-trigger OD requests ────────
            try {
                const eventStart = new Date(event.start_datetime);
                const eventEnd = new Date(event.end_datetime);
                const eventDate = eventStart.toISOString().split('T')[0];

                // Find student's enrolled subjects
                const { data: enrollments } = await supabase
                    .from('student_subjects')
                    .select('subject_id')
                    .eq('student_id', user.id);

                if (!enrollments || enrollments.length === 0) {
                    setConfirming(false);
                    return;
                }

                const subjectIds = enrollments.map((e) => e.subject_id);
                const eventStartTime = eventStart.toTimeString().slice(0, 8);
                const eventEndTime = eventEnd.toTimeString().slice(0, 8);

                // Find overlapping class sessions on the event date
                const { data: sessions } = await supabase
                    .from('class_sessions')
                    .select('id, subject_id, start_time, end_time')
                    .in('subject_id', subjectIds)
                    .eq('scheduled_date', eventDate)
                    .eq('is_cancelled', false);

                if (!sessions || sessions.length === 0) {
                    setConfirming(false);
                    return;
                }

                // Filter sessions that overlap with event time
                const overlapping = sessions.filter((s) => {
                    return s.start_time < eventEndTime && s.end_time > eventStartTime;
                });

                if (overlapping.length === 0) {
                    setConfirming(false);
                    return;
                }

                // Get event registration ID
                const { data: regRow } = await supabase
                    .from('event_registrations')
                    .select('id')
                    .eq('event_id', event.id)
                    .eq('student_id', user.id)
                    .single();

                if (!regRow) {
                    setConfirming(false);
                    return;
                }

                // Get subject details with faculty
                const { data: subjects } = await supabase
                    .from('subjects')
                    .select('id, name, faculty_id')
                    .in(
                        'id',
                        overlapping.map((s) => s.subject_id),
                    );

                const subjectMap = new Map(
                    (subjects ?? []).map((s) => [s.id, s]),
                );

                // Get faculty names
                const facultyIds = (subjects ?? [])
                    .map((s) => s.faculty_id)
                    .filter(Boolean) as string[];

                const { data: faculties } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', facultyIds);

                const facultyMap = new Map(
                    (faculties ?? []).map((f) => [f.id, f.full_name]),
                );

                // Create OD requests for each overlapping session
                const odEntries: { subject: string; faculty: string }[] = [];

                for (const session of overlapping) {
                    const subj = subjectMap.get(session.subject_id);
                    if (!subj || !subj.faculty_id) continue;

                    const { error: odError } = await supabase
                        .from('on_duty_requests')
                        .insert({
                            student_id: user.id,
                            event_registration_id: regRow.id,
                            faculty_id: subj.faculty_id,
                            subject_id: subj.id,
                            class_session_id: session.id,
                            status: 'pending',
                        });

                    if (!odError) {
                        odEntries.push({
                            subject: subj.name,
                            faculty: facultyMap.get(subj.faculty_id) ?? 'Faculty',
                        });

                        // Call WhatsApp Edge Function (fire-and-forget)
                        supabase.functions.invoke('send-whatsapp', {
                            body: {
                                faculty_id: subj.faculty_id,
                                student_id: user.id,
                                event_name: event.name,
                                subject_name: subj.name,
                                session_date: eventDate,
                                session_time: `${session.start_time} - ${session.end_time}`,
                            },
                        }).catch(() => {
                            /* WhatsApp notification is best-effort */
                        });
                    }
                }

                if (odEntries.length > 0) {
                    setOdResults(odEntries);
                    toast.success(
                        `${odEntries.length} On-Duty request${odEntries.length > 1 ? 's' : ''} auto-sent!`,
                    );
                }
            } catch {
                // OD request failures are non-critical
                console.error('Failed to auto-create OD requests');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Check-in failed');
        } finally {
            setConfirming(false);
        }
    }, [event, user, geo]);

    // ── Render ──────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md space-y-4">
                {/* Logo / branding */}
                <div className="text-center">
                    <h1 className="text-xl font-bold text-gray-900">Campus Attend</h1>
                    <p className="text-xs text-gray-400 mt-0.5">Event Check-In</p>
                </div>

                {/* ═══ VALIDATING ═══ */}
                {step === 'validating' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-4">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto" />
                        <p className="text-sm text-gray-600 font-medium">
                            Validating your check-in link…
                        </p>
                    </div>
                )}

                {/* ═══ ERROR ═══ */}
                {step === 'error' && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-4">
                        <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                            <XCircle className="w-7 h-7 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">
                                Check-In Unavailable
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">{errorMsg}</p>
                        </div>
                        {event && (
                            <div className="bg-gray-50 rounded-lg p-3 text-left text-xs text-gray-600">
                                <p className="font-semibold text-gray-800">{event.name}</p>
                                {event.venue && (
                                    <p className="flex items-center gap-1 mt-1">
                                        <MapPin className="w-3 h-3" /> {event.venue}
                                    </p>
                                )}
                            </div>
                        )}
                        <Link
                            to="/student/events"
                            className="inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            ← Browse Events
                        </Link>
                    </div>
                )}

                {/* ═══ GEO VERIFICATION ═══ */}
                {step === 'geo' && event && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden space-y-0">
                        {/* Event header */}
                        <div className="p-5 border-b border-gray-100">
                            <h2 className="text-lg font-bold text-gray-900">{event.name}</h2>
                            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                {event.venue && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {event.venue}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {new Date(event.start_datetime).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>
                        </div>

                        {/* Map */}
                        {(geo || geoLoading) && (
                            <div className="h-56">
                                {geoLoading ? (
                                    <div className="flex flex-col items-center justify-center h-full bg-gray-50 space-y-2">
                                        <Navigation className="w-8 h-8 text-indigo-400 animate-pulse" />
                                        <p className="text-xs text-gray-500">
                                            Getting your location…
                                        </p>
                                    </div>
                                ) : geo ? (
                                    <GeoMap
                                        studentLat={geo.lat}
                                        studentLng={geo.lng}
                                        eventLat={event.geofence_lat}
                                        eventLng={event.geofence_lng}
                                        radiusM={event.geofence_radius_m}
                                    />
                                ) : null}
                            </div>
                        )}

                        {/* Geo result */}
                        <div className="p-5 space-y-4">
                            {geo && (
                                <>
                                    {geo.verified ? (
                                        <div className="flex items-start gap-3 bg-emerald-50 rounded-xl p-4">
                                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-emerald-800">
                                                    You are in the event zone ✓
                                                </p>
                                                <p className="text-xs text-emerald-600 mt-0.5">
                                                    {event.geofence_lat != null
                                                        ? `${geo.distance}m from event center (within ${event.geofence_radius_m}m)`
                                                        : 'No geofence set — location recorded'}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="flex items-start gap-3 bg-amber-50 rounded-xl p-4">
                                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-sm font-semibold text-amber-800">
                                                        Outside the event zone
                                                    </p>
                                                    <p className="text-xs text-amber-600 mt-0.5">
                                                        You are <strong>{geo.distance}m</strong>{' '}
                                                        away — need to be within{' '}
                                                        <strong>{event.geofence_radius_m}m</strong>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Manual override */}
                                            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                                                <p className="text-xs text-gray-500">
                                                    If you're at the venue but GPS is inaccurate,
                                                    you can override with a reason:
                                                </p>
                                                <textarea
                                                    value={overrideReason}
                                                    onChange={(e) =>
                                                        setOverrideReason(e.target.value)
                                                    }
                                                    placeholder="e.g., GPS signal is weak indoors…"
                                                    className="w-full rounded-lg border border-gray-300 py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
                                                    rows={2}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Action buttons */}
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={requestGeo}
                                            disabled={geoLoading}
                                            className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition flex-1"
                                        >
                                            <Navigation className="w-4 h-4" /> Re-scan
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setStep('confirming')}
                                            disabled={
                                                !geo.verified && overrideReason.trim().length < 5
                                            }
                                            className="flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40 transition flex-[2]"
                                        >
                                            <Shield className="w-4 h-4" /> Continue
                                        </button>
                                    </div>

                                    {!geo.verified && overrideReason.trim().length < 5 && (
                                        <p className="text-[11px] text-gray-400 text-center">
                                            Provide a reason (min 5 characters) to override
                                        </p>
                                    )}
                                </>
                            )}

                            {!geo && !geoLoading && (
                                <button
                                    type="button"
                                    onClick={requestGeo}
                                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                                >
                                    <Navigation className="w-4 h-4" /> Enable Location
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ CONFIRMING ═══ */}
                {step === 'confirming' && event && geo && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 space-y-5 text-center">
                        <div className="space-y-2">
                            <h2 className="text-lg font-bold text-gray-900">
                                Confirm Check-In
                            </h2>
                            <p className="text-sm text-gray-500">
                                You're about to check in to:
                            </p>
                        </div>

                        <div className="bg-indigo-50 rounded-xl p-4 text-left">
                            <p className="text-sm font-bold text-indigo-900">{event.name}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-indigo-600">
                                {event.venue && (
                                    <span className="flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {event.venue}
                                    </span>
                                )}
                                <span className="flex items-center gap-1">
                                    {geo.verified ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                                    )}
                                    {geo.verified ? 'Geo verified' : 'Manual override'}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckIn}
                            disabled={confirming}
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-60 transition"
                        >
                            {confirming ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <CheckCircle2 className="w-5 h-5" />
                            )}
                            {confirming ? 'Checking In…' : 'Confirm Check-In'}
                        </button>

                        <button
                            type="button"
                            onClick={() => setStep('geo')}
                            className="text-sm text-gray-400 hover:text-gray-600 transition"
                        >
                            ← Go back
                        </button>
                    </div>
                )}

                {/* ═══ DONE ═══ */}
                {step === 'done' && event && (
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center space-y-5">
                        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-50 flex items-center justify-center">
                            <PartyPopper className="w-8 h-8 text-emerald-600" />
                        </div>

                        <div className="space-y-1">
                            <h2 className="text-xl font-bold text-gray-900">
                                You're Checked In! 🎉
                            </h2>
                            <p className="text-sm text-gray-500">
                                ✅ Checked in to{' '}
                                <span className="font-semibold text-gray-700">{event.name}</span>
                                ! Your attendance is being processed.
                            </p>
                        </div>

                        {/* OD request results */}
                        {odResults.length > 0 && (
                            <div className="bg-violet-50 rounded-xl p-4 text-left space-y-2">
                                <p className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5" />
                                    Auto-generated On-Duty Requests
                                </p>
                                <div className="space-y-1.5">
                                    {odResults.map((od, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center justify-between text-xs"
                                        >
                                            <span className="text-violet-700 font-medium">
                                                {od.subject}
                                            </span>
                                            <span className="text-violet-500">
                                                → {od.faculty}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-violet-500 mt-1">
                                    WhatsApp notifications sent to faculty for approval.
                                </p>
                            </div>
                        )}

                        <Link
                            to="/student/events"
                            className="inline-block text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            ← Back to Events
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════

// ── Leaflet map for geo verification ────────────────────────

function GeoMap({
    studentLat,
    studentLng,
    eventLat,
    eventLng,
    radiusM,
}: {
    studentLat: number;
    studentLng: number;
    eventLat: number | null;
    eventLng: number | null;
    radiusM: number;
}) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const centerLat = eventLat ?? studentLat;
        const centerLng = eventLng ?? studentLng;

        const map = L.map(containerRef.current).setView([centerLat, centerLng], 16);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19,
        }).addTo(map);

        // Student marker — blue
        const studentIcon = L.divIcon({
            html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
            className: '',
            iconSize: [16, 16],
            iconAnchor: [8, 8],
        });
        L.marker([studentLat, studentLng], { icon: studentIcon })
            .addTo(map)
            .bindPopup('You are here');

        // Event geofence circle — green
        if (eventLat != null && eventLng != null) {
            L.circle([eventLat, eventLng], {
                radius: radiusM,
                color: '#22c55e',
                fillColor: '#22c55e',
                fillOpacity: 0.12,
                weight: 2,
            }).addTo(map);

            // Event center marker
            const eventIcon = L.divIcon({
                html: `<div style="width:12px;height:12px;background:#22c55e;border:2px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`,
                className: '',
                iconSize: [12, 12],
                iconAnchor: [6, 6],
            });
            L.marker([eventLat, eventLng], { icon: eventIcon })
                .addTo(map)
                .bindPopup('Event location');

            // Fit bounds to show both markers
            const bounds = L.latLngBounds(
                [studentLat, studentLng],
                [eventLat, eventLng],
            );
            map.fitBounds(bounds.pad(0.3));
        }

        return () => {
            map.remove();
        };
    }, [studentLat, studentLng, eventLat, eventLng, radiusM]);

    return <div ref={containerRef} className="w-full h-full" />;
}
