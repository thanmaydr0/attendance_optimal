import { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import {
    Loader2,
    CheckCircle2,
    XCircle,
    Bell,
    Users,
    ChevronRight,
    CheckCheck,
    XOctagon,
} from 'lucide-react';
import toast from 'react-hot-toast';

import {
    useFacultySubjects,
    useFacultySessions,
    useEnrolledStudents,
    usePendingODsForSession,
    useBulkMarkAttendance,
    type StudentRow,
} from '../../hooks/useFacultyAttendance';

type AttendanceStatus = 'present' | 'absent' | 'on_duty';

export default function FacultyAttendancePage() {
    // ── Step state ────────────────────────────────────────────
    const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
    const [selectedSession, setSelectedSession] = useState<string | null>(null);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [submitted, setSubmitted] = useState(false);

    // ── Queries ───────────────────────────────────────────────
    const { data: subjects, isLoading: subjectsLoading } = useFacultySubjects();
    const { data: sessions, isLoading: sessionsLoading } = useFacultySessions(selectedSubject);
    const { data: enrolled, isLoading: enrolledLoading } = useEnrolledStudents(selectedSubject);
    const { data: pendingODs } = usePendingODsForSession(selectedSession);
    const bulkMark = useBulkMarkAttendance();

    // ── Build student rows when enrolled / ODs change ─────────
    useEffect(() => {
        if (!enrolled) return;
        const odMap = new Map(
            (pendingODs ?? []).map((od) => [od.student_id, od.id]),
        );

        const rows: StudentRow[] = enrolled.map((e) => ({
            ...e,
            status: 'present' as AttendanceStatus,
            hasPendingOD: odMap.has(e.student_id),
            odRequestId: odMap.get(e.student_id) ?? null,
        }));

        // Sort: pending OD first, then alphabetical
        rows.sort((a, b) => {
            if (a.hasPendingOD !== b.hasPendingOD) return a.hasPendingOD ? -1 : 1;
            return (a.profile.full_name ?? '').localeCompare(b.profile.full_name ?? '');
        });

        setStudents(rows);
        setSubmitted(false);
    }, [enrolled, pendingODs]);

    // ── Handlers ──────────────────────────────────────────────
    const setStatus = (idx: number, status: AttendanceStatus) => {
        setStudents((prev) => {
            const next = [...prev];
            next[idx] = { ...next[idx], status };
            return next;
        });
    };

    const markAll = (status: AttendanceStatus) => {
        setStudents((prev) => prev.map((s) => ({ ...s, status })));
    };

    const handleSubmit = async () => {
        if (!selectedSession || students.length === 0) return;

        try {
            await bulkMark.mutateAsync({
                session_id: selectedSession,
                records: students.map((s) => ({
                    student_id: s.student_id,
                    status: s.status,
                })),
            });
            setSubmitted(true);
            toast.success('Attendance submitted successfully');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to submit');
        }
    };

    // ── Summary counts ────────────────────────────────────────
    const summary = useMemo(() => {
        const counts = { present: 0, absent: 0, on_duty: 0, total: students.length };
        for (const s of students) {
            if (s.status === 'present') counts.present++;
            else if (s.status === 'absent') counts.absent++;
            else if (s.status === 'on_duty') counts.on_duty++;
        }
        return counts;
    }, [students]);

    const inputCls =
        'block w-full rounded-lg border border-gray-300 py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition';

    // ── Loading ───────────────────────────────────────────────
    if (subjectsLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">Mark Attendance</h1>

            {/* ═══════════════════════════════════════════════════
          STEP 1: Select Subject
         ═══════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">1</span>
                    Select Subject
                </h2>

                <select
                    value={selectedSubject ?? ''}
                    onChange={(e) => {
                        setSelectedSubject(e.target.value || null);
                        setSelectedSession(null);
                        setStudents([]);
                        setSubmitted(false);
                    }}
                    className={inputCls}
                >
                    <option value="">Choose a subject…</option>
                    {(subjects ?? []).map((s) => (
                        <option key={s.id} value={s.id}>
                            {s.code} — {s.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* ═══════════════════════════════════════════════════
          STEP 2: Select Session
         ═══════════════════════════════════════════════════ */}
            {selectedSubject && (
                <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">2</span>
                        Select Today&apos;s Session
                    </h2>

                    {sessionsLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" />
                    ) : !sessions || sessions.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">
                            No sessions scheduled today for this subject.
                        </p>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {sessions.map((s) => {
                                const isSelected = selectedSession === s.id;
                                const fmtTime = (t: string) => {
                                    const [h, m] = t.split(':');
                                    const hr = parseInt(h, 10);
                                    return `${hr % 12 || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
                                };

                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => { setSelectedSession(s.id); setSubmitted(false); }}
                                        className={`flex items-center justify-between rounded-lg border p-3 text-left transition ${isSelected
                                                ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-300'
                                                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">
                                                {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {s.venue ?? 'No venue'} · {s.session_type}
                                            </p>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-indigo-500' : 'text-gray-300'}`} />
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════
          STEP 3: Student Checklist
         ═══════════════════════════════════════════════════ */}
            {selectedSession && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">3</span>
                            <Users className="w-4 h-4 text-gray-400" />
                            Student List
                            <span className="text-xs text-gray-400 font-normal">({students.length} students)</span>
                        </h2>

                        {/* Quick buttons */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => markAll('present')}
                                className="flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                            >
                                <CheckCheck className="w-3.5 h-3.5" /> Mark All Present
                            </button>
                            <button
                                onClick={() => markAll('absent')}
                                className="flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition"
                            >
                                <XOctagon className="w-3.5 h-3.5" /> Mark All Absent
                            </button>
                        </div>
                    </div>

                    {enrolledLoading ? (
                        <div className="flex justify-center py-10">
                            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                    ) : students.length === 0 ? (
                        <div className="px-5 py-10 text-center text-sm text-gray-400">
                            No students enrolled in this subject.
                        </div>
                    ) : (
                        <>
                            {/* Desktop table */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            <th className="px-5 py-3 w-8">#</th>
                                            <th className="px-4 py-3">Student</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {students.map((s, i) => (
                                            <tr
                                                key={s.student_id}
                                                className={`transition ${s.hasPendingOD ? 'bg-amber-50/60' : 'hover:bg-gray-50/60'}`}
                                            >
                                                <td className="px-5 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-gray-900">{s.profile.full_name}</p>
                                                        {s.hasPendingOD && (
                                                            <span className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                                                                <Bell className="w-3 h-3" /> OD Pending
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-400">{s.profile.email}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusToggle status={s.status} onChange={(v) => setStatus(i, v)} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile cards */}
                            <div className="sm:hidden divide-y divide-gray-100">
                                {students.map((s, i) => (
                                    <div
                                        key={s.student_id}
                                        className={`px-4 py-3 space-y-2 ${s.hasPendingOD ? 'bg-amber-50/60' : ''}`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-xs text-gray-400">{i + 1}.</span>
                                                <p className="text-sm font-medium text-gray-900 truncate">{s.profile.full_name}</p>
                                                {s.hasPendingOD && (
                                                    <Bell className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                        <StatusToggle status={s.status} onChange={(v) => setStatus(i, v)} />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* ── Submit bar ──────────────────────────────── */}
                    {students.length > 0 && (
                        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            {/* Summary chips */}
                            <div className="flex gap-3 text-xs font-medium">
                                <span className="text-emerald-600">✓ {summary.present} Present</span>
                                <span className="text-red-500">✗ {summary.absent} Absent</span>
                                <span className="text-sky-600">◎ {summary.on_duty} OD</span>
                            </div>

                            {submitted ? (
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                                    <CheckCircle2 className="w-5 h-5" /> Submitted
                                </div>
                            ) : (
                                <button
                                    onClick={handleSubmit}
                                    disabled={bulkMark.isPending}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-60 transition"
                                >
                                    {bulkMark.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {bulkMark.isPending ? 'Submitting…' : 'Submit Attendance'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Status toggle sub-component ─────────────────────────────

function StatusToggle({
    status,
    onChange,
}: {
    status: AttendanceStatus;
    onChange: (v: AttendanceStatus) => void;
}) {
    const options: { value: AttendanceStatus; label: string; active: string; icon: typeof CheckCircle2 }[] = [
        { value: 'present', label: 'Present', active: 'bg-emerald-600 text-white', icon: CheckCircle2 },
        { value: 'absent', label: 'Absent', active: 'bg-red-500 text-white', icon: XCircle },
        { value: 'on_duty', label: 'OD', active: 'bg-sky-500 text-white', icon: Bell },
    ];

    return (
        <div className="flex gap-1 justify-center">
            {options.map((o) => {
                const Icon = o.icon;
                const isActive = status === o.value;
                return (
                    <button
                        key={o.value}
                        onClick={() => onChange(o.value)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${isActive ? o.active : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                    >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{o.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
