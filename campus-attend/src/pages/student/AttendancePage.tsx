import { useMemo } from 'react';
import { format } from 'date-fns';
import {
    Loader2,
    TrendingUp,
    TrendingDown,
    CalendarCheck,
    Shield,
    FileCheck,
    RefreshCw,
} from 'lucide-react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ReferenceLine,
} from 'recharts';

import {
    useAttendanceSummary,
    useRecentRecords,
    useAttendanceTrend,
    type SubjectAttendance,
} from '../../hooks/useAttendance';

// ── Status helpers ──────────────────────────────────────────

function getOverallColor(pct: number) {
    if (pct >= 75) return 'text-emerald-600';
    if (pct >= 65) return 'text-amber-500';
    return 'text-red-600';
}

function getOverallBg(pct: number) {
    if (pct >= 75) return 'bg-emerald-50 border-emerald-200';
    if (pct >= 65) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
}

function getStatusBadge(pct: number) {
    if (pct >= 75)
        return { label: 'SAFE', cls: 'bg-emerald-100 text-emerald-700' };
    if (pct >= 65)
        return { label: 'BORDERLINE', cls: 'bg-amber-100 text-amber-700' };
    if (pct >= 50)
        return { label: 'DANGER', cls: 'bg-red-100 text-red-600' };
    return { label: 'DETAINED', cls: 'bg-red-200 text-red-800' };
}

function getMarkedByLabel(mb: string) {
    const map: Record<string, string> = {
        student: 'Self',
        faculty: 'Faculty',
        system: 'System',
        ai_approved: 'AI',
    };
    return map[mb] ?? mb;
}

function getStatusColor(status: string) {
    const map: Record<string, string> = {
        present: 'bg-emerald-100 text-emerald-700',
        absent: 'bg-red-100 text-red-600',
        on_duty: 'bg-sky-100 text-sky-700',
        medical: 'bg-violet-100 text-violet-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
}

// ── Component ───────────────────────────────────────────────

export default function AttendancePage() {
    const {
        data: subjectData,
        isLoading: summaryLoading,
        refetch: refetchSummary,
    } = useAttendanceSummary();

    const { data: recentRecords, isLoading: recentLoading } =
        useRecentRecords(10);

    const { data: trendData, isLoading: trendLoading } = useAttendanceTrend();

    // ── Aggregated stats ────────────────────────────────────
    const stats = useMemo(() => {
        if (!subjectData || subjectData.length === 0)
            return {
                overallPct: 0,
                attended: 0,
                held: 0,
                buffer: 0,
                odApproved: 0,
            };

        let totalPresent = 0;
        let totalHeld = 0;
        let totalBuffer = 0;
        let totalOd = 0;

        for (const s of subjectData) {
            totalPresent += s.buffer.present_count;
            totalHeld += s.buffer.held_count;
            totalBuffer += s.buffer.buffer_classes;
            totalOd += s.on_duty_count;
        }

        return {
            overallPct:
                totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 10000) / 100 : 100,
            attended: totalPresent,
            held: totalHeld,
            buffer: totalBuffer,
            odApproved: totalOd,
        };
    }, [subjectData]);

    // ── Sort subjects by % ascending (most critical first) ──
    const sortedSubjects = useMemo(() => {
        if (!subjectData) return [];
        return [...subjectData].sort(
            (a, b) => (a.buffer.current_pct ?? 0) - (b.buffer.current_pct ?? 0),
        );
    }, [subjectData]);

    // ── Loading ──────────────────────────────────────────────
    if (summaryLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── Header ─────────────────────────────────────── */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
                <button
                    onClick={() => refetchSummary()}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                    <RefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* ═══════════════════════════════════════════════════
          1. SUMMARY CARDS
         ═══════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Overall % */}
                <div
                    className={`rounded-xl border p-5 ${getOverallBg(stats.overallPct)}`}
                >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                        {stats.overallPct >= 75 ? (
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                        ) : (
                            <TrendingDown className="w-4 h-4 text-red-500" />
                        )}
                        Overall Attendance
                    </div>
                    <p className={`text-3xl font-extrabold ${getOverallColor(stats.overallPct)}`}>
                        {stats.overallPct}%
                    </p>
                </div>

                {/* Classes attended / held */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                        <CalendarCheck className="w-4 h-4 text-indigo-500" />
                        Classes
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">
                        {stats.attended}
                        <span className="text-lg font-semibold text-gray-400"> / {stats.held}</span>
                    </p>
                </div>

                {/* Buffer */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                        <Shield className="w-4 h-4 text-teal-500" />
                        Safe-to-Miss
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{stats.buffer}</p>
                    <p className="text-xs text-gray-400 mt-0.5">classes remaining</p>
                </div>

                {/* OD Approved */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-2">
                        <FileCheck className="w-4 h-4 text-violet-500" />
                        On-Duty Approved
                    </div>
                    <p className="text-3xl font-extrabold text-gray-900">{stats.odApproved}</p>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════
          2. PER-SUBJECT TABLE
         ═══════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Subject Breakdown</h2>
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <th className="px-5 py-3">Subject</th>
                                <th className="px-4 py-3 text-center">Held</th>
                                <th className="px-4 py-3 text-center">Present</th>
                                <th className="px-4 py-3 text-center">On Duty</th>
                                <th className="px-4 py-3 text-center">%</th>
                                <th className="px-4 py-3 text-center">Buffer</th>
                                <th className="px-4 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {sortedSubjects.map((s) => {
                                const pct = Math.round((s.buffer.current_pct ?? 0) * 100);
                                const badge = getStatusBadge(pct);
                                return (
                                    <SubjectRow key={s.subject_id} s={s} pct={pct} badge={badge} />
                                );
                            })}
                            {sortedSubjects.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                                        No subjects enrolled yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile cards */}
                <div className="sm:hidden divide-y divide-gray-100">
                    {sortedSubjects.map((s) => {
                        const pct = Math.round((s.buffer.current_pct ?? 0) * 100);
                        const badge = getStatusBadge(pct);
                        return (
                            <div key={s.subject_id} className="px-4 py-3 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-gray-900 text-sm truncate">
                                        {s.subject_code} — {s.subject_name}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                                        {badge.label}
                                    </span>
                                </div>
                                <div className="flex gap-4 text-xs text-gray-500">
                                    <span>Held {s.buffer.held_count}</span>
                                    <span>Present {s.buffer.present_count}</span>
                                    <span>OD {s.on_duty_count}</span>
                                    <span className={`font-semibold ${getOverallColor(pct)}`}>{pct}%</span>
                                    <span>Buffer {s.buffer.buffer_classes}</span>
                                </div>
                                {/* Mini progress bar */}
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all ${pct >= 75 ? 'bg-emerald-500' : pct >= 65 ? 'bg-amber-400' : 'bg-red-500'
                                            }`}
                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════
          3. ATTENDANCE TREND CHART
         ═══════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">Attendance Trend</h2>

                {trendLoading ? (
                    <div className="flex items-center justify-center h-52">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </div>
                ) : !trendData || trendData.length === 0 ? (
                    <div className="flex items-center justify-center h-52 text-sm text-gray-400">
                        Not enough data to show a trend yet.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis
                                dataKey="week"
                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                domain={[0, 100]}
                                tick={{ fontSize: 11, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `${v}%`}
                            />
                            <Tooltip
                                formatter={(val: number | string | undefined) => [`${val ?? 0}%`, '']}
                                contentStyle={{
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    fontSize: '13px',
                                }}
                            />
                            {/* 75% threshold line */}
                            <ReferenceLine
                                y={75}
                                stroke="#ef4444"
                                strokeDasharray="6 4"
                                label={{
                                    value: '75%',
                                    fill: '#ef4444',
                                    fontSize: 11,
                                    position: 'insideTopRight',
                                }}
                            />
                            {/* Actual cumulative % */}
                            <Line
                                type="monotone"
                                dataKey="pct"
                                stroke="#4f46e5"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: '#4f46e5' }}
                                activeDot={{ r: 5 }}
                                name="Attendance"
                            />
                            {/* Projected % */}
                            <Line
                                type="monotone"
                                dataKey="projected"
                                stroke="#14b8a6"
                                strokeWidth={1.5}
                                strokeDasharray="4 4"
                                dot={false}
                                name="Projected"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════
          4. RECENT ACTIVITY FEED
         ═══════════════════════════════════════════════════ */}
            <div className="bg-white rounded-xl border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Recent Activity</h2>
                </div>

                {recentLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                    </div>
                ) : !recentRecords || recentRecords.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-gray-400">
                        No attendance records yet.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {recentRecords.map((r) => (
                            <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                                {/* Status dot */}
                                <span
                                    className={`shrink-0 w-2 h-2 rounded-full ${r.status === 'present'
                                        ? 'bg-emerald-500'
                                        : r.status === 'absent'
                                            ? 'bg-red-500'
                                            : r.status === 'on_duty'
                                                ? 'bg-sky-500'
                                                : 'bg-violet-500'
                                        }`}
                                />

                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                        {r.class_session?.subject?.name ?? 'Unknown Subject'}
                                        <span className="ml-1.5 text-xs text-gray-400">
                                            {r.class_session?.subject?.code}
                                        </span>
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {r.class_session?.scheduled_date
                                            ? format(new Date(r.class_session.scheduled_date), 'dd MMM yyyy')
                                            : '—'}{' '}
                                        · {r.class_session?.start_time ?? ''} ·{' '}
                                        Marked by {getMarkedByLabel(r.marked_by)}
                                    </p>
                                </div>

                                <span
                                    className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${getStatusColor(
                                        r.status,
                                    )}`}
                                >
                                    {r.status.replace('_', ' ')}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}

// ── Desktop table row sub-component ─────────────────────────

function SubjectRow({
    s,
    pct,
    badge,
}: {
    s: SubjectAttendance;
    pct: number;
    badge: { label: string; cls: string };
}) {
    return (
        <tr className="hover:bg-gray-50/60 transition">
            <td className="px-5 py-3">
                <p className="font-medium text-gray-900">{s.subject_name}</p>
                <p className="text-xs text-gray-400">{s.subject_code}</p>
            </td>
            <td className="px-4 py-3 text-center text-gray-700">{s.buffer.held_count}</td>
            <td className="px-4 py-3 text-center text-gray-700">{s.buffer.present_count}</td>
            <td className="px-4 py-3 text-center text-gray-700">{s.on_duty_count}</td>
            <td className={`px-4 py-3 text-center font-semibold ${getOverallColor(pct)}`}>
                {pct}%
            </td>
            <td className="px-4 py-3 text-center font-semibold text-gray-900">
                {s.buffer.buffer_classes}
            </td>
            <td className="px-4 py-3 text-center">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${badge.cls}`}>
                    {badge.label}
                </span>
            </td>
        </tr>
    );
}
