import { useState, useMemo, type FormEvent } from 'react';
import { format, startOfWeek, addDays, isToday as checkIsToday } from 'date-fns';
import { Plus, Search, X, Loader2, BookOpen } from 'lucide-react';
import toast from 'react-hot-toast';

import { useTimetable, type AddSessionInput } from '../../hooks/useTimetable';
import TimetableCard from '../../components/TimetableCard';

// ── Constants ───────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM → 8 PM
const SESSION_TYPES = ['lecture', 'lab', 'tutorial'] as const;

export default function TimetablePage() {
    const {
        sessions,
        enrolledSubjects,
        allSubjects,
        loading,
        addSession,
        deleteSession,
        enrollInSubject,
    } = useTimetable();

    // ── Derived data ──────────────────────────────────────────
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

    // Map day name → date for current week
    const dayDates = useMemo(
        () => DAYS.map((_, i) => addDays(weekStart, i)),
        [weekStart],
    );

    // Unique subject IDs for colour assignment
    const subjectIds = useMemo(
        () => [...new Set(sessions.map((s) => s.subject?.id).filter(Boolean))] as string[],
        [sessions],
    );

    // Group sessions by day-of-week (0=Mon)
    const sessionsByDay = useMemo(() => {
        const map = new Map<number, typeof sessions>();
        for (const s of sessions) {
            const d = new Date(s.scheduled_date);
            const dow = (d.getDay() + 6) % 7; // JS Sun=0 → Mon=0
            const arr = map.get(dow) ?? [];
            arr.push(s);
            map.set(dow, arr);
        }
        return map;
    }, [sessions]);

    // ── Modals state ──────────────────────────────────────────
    const [showAddSession, setShowAddSession] = useState(false);
    const [showAddSubject, setShowAddSubject] = useState(false);
    const [subjectSearch, setSubjectSearch] = useState('');
    const [saving, setSaving] = useState(false);

    // Add session form
    const [formSubject, setFormSubject] = useState('');
    const [formDay, setFormDay] = useState('0');
    const [formStart, setFormStart] = useState('09:00');
    const [formEnd, setFormEnd] = useState('10:00');
    const [formVenue, setFormVenue] = useState('');
    const [formType, setFormType] = useState<'lecture' | 'lab' | 'tutorial'>('lecture');

    const handleAddSession = async (e: FormEvent) => {
        e.preventDefault();
        if (!formSubject) { toast.error('Select a subject'); return; }
        if (formStart >= formEnd) { toast.error('End time must be after start time'); return; }

        const date = addDays(weekStart, parseInt(formDay, 10));

        const input: AddSessionInput = {
            subject_id: formSubject,
            scheduled_date: format(date, 'yyyy-MM-dd'),
            start_time: formStart,
            end_time: formEnd,
            venue: formVenue || undefined,
            session_type: formType,
        };

        setSaving(true);
        try {
            await addSession(input);
            toast.success('Session added');
            setShowAddSession(false);
            resetForm();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to add session');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setFormSubject('');
        setFormDay('0');
        setFormStart('09:00');
        setFormEnd('10:00');
        setFormVenue('');
        setFormType('lecture');
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteSession(id);
            toast.success('Session removed');
        } catch {
            toast.error('Failed to remove session');
        }
    };

    const handleEnroll = async (subjectId: string) => {
        setSaving(true);
        try {
            await enrollInSubject(subjectId);
            toast.success('Enrolled!');
            setShowAddSubject(false);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to enrol');
        } finally {
            setSaving(false);
        }
    };

    const filteredSubjects = allSubjects.filter(
        (s) =>
            s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
            s.code.toLowerCase().includes(subjectSearch.toLowerCase()),
    );

    // ── Loading state ─────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    // ── Shared input class ────────────────────────────────────
    const inputCls =
        'block w-full rounded-lg border border-gray-300 py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition';

    return (
        <div className="space-y-6">
            {/* ── Header ────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Timetable</h1>
                    <p className="text-sm text-gray-500">
                        Week of {format(weekStart, 'dd MMM yyyy')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowAddSubject(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition"
                    >
                        <BookOpen className="w-4 h-4" /> Add Subject
                    </button>
                    <button
                        onClick={() => setShowAddSession(true)}
                        className="flex items-center gap-1.5 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 transition"
                    >
                        <Plus className="w-4 h-4" /> Add Session
                    </button>
                </div>
            </div>

            {/* ── Desktop weekly grid ───────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
                <div className="min-w-[900px]">
                    {/* Day headers */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1">
                        <div /> {/* spacer for time col */}
                        {DAYS.map((day, i) => {
                            const dt = dayDates[i];
                            const today = checkIsToday(dt);
                            return (
                                <div
                                    key={day}
                                    className={`text-center text-xs font-semibold py-2 rounded-lg ${today ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500'
                                        }`}
                                >
                                    {day}
                                    <span className="block text-[10px] font-normal">
                                        {format(dt, 'dd/MM')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time rows */}
                    {HOURS.map((hour) => (
                        <div
                            key={hour}
                            className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 min-h-[72px]"
                        >
                            {/* Time label */}
                            <div className="text-[11px] text-gray-400 pt-1 text-right pr-2">
                                {hour > 12 ? hour - 12 : hour} {hour >= 12 ? 'PM' : 'AM'}
                            </div>

                            {/* Day cells */}
                            {DAYS.map((_, dayIdx) => {
                                const daySessions = (sessionsByDay.get(dayIdx) ?? []).filter((s) => {
                                    const h = parseInt(s.start_time.split(':')[0], 10);
                                    return h === hour;
                                });

                                return (
                                    <div
                                        key={dayIdx}
                                        className="border border-gray-100 rounded-lg p-0.5 space-y-1"
                                    >
                                        {daySessions.map((s) => (
                                            <TimetableCard
                                                key={s.id}
                                                session={s}
                                                subjectIds={subjectIds}
                                                isToday={checkIsToday(dayDates[dayIdx])}
                                                onDelete={handleDelete}
                                                compact
                                            />
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Mobile day-by-day view ────────────────────────── */}
            <div className="md:hidden space-y-6">
                {DAYS.map((day, i) => {
                    const dt = dayDates[i];
                    const today = checkIsToday(dt);
                    const daySessions = (sessionsByDay.get(i) ?? []).sort((a, b) =>
                        a.start_time.localeCompare(b.start_time),
                    );

                    return (
                        <div key={day}>
                            <h3
                                className={`text-sm font-semibold mb-2 px-1 ${today ? 'text-indigo-700' : 'text-gray-700'
                                    }`}
                            >
                                {today && (
                                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mr-1.5 align-middle" />
                                )}
                                {day}, {format(dt, 'dd MMM')}
                            </h3>

                            {daySessions.length === 0 ? (
                                <p className="text-xs text-gray-400 px-1">No classes</p>
                            ) : (
                                <div className="space-y-2">
                                    {daySessions.map((s) => (
                                        <TimetableCard
                                            key={s.id}
                                            session={s}
                                            subjectIds={subjectIds}
                                            isToday={today}
                                            onDelete={handleDelete}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ══════════════════════════════════════════════════════
          MODAL: Add Session
         ══════════════════════════════════════════════════════ */}
            {showAddSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-5 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Add Class Session</h2>
                            <button
                                onClick={() => setShowAddSession(false)}
                                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddSession} className="space-y-4">
                            {/* Subject */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                                <select value={formSubject} onChange={(e) => setFormSubject(e.target.value)} className={inputCls}>
                                    <option value="">Select subject…</option>
                                    {enrolledSubjects.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.code} — {s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Day */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Day</label>
                                <select value={formDay} onChange={(e) => setFormDay(e.target.value)} className={inputCls}>
                                    {DAYS.map((d, i) => (
                                        <option key={d} value={i}>{d}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Time range */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                                    <input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} className={inputCls} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                                    <input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} className={inputCls} />
                                </div>
                            </div>

                            {/* Venue */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                                <input
                                    type="text"
                                    value={formVenue}
                                    onChange={(e) => setFormVenue(e.target.value)}
                                    className={inputCls}
                                    placeholder="Room 301"
                                />
                            </div>

                            {/* Session type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Session Type</label>
                                <select value={formType} onChange={(e) => setFormType(e.target.value as typeof formType)} className={inputCls}>
                                    {SESSION_TYPES.map((t) => (
                                        <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 disabled:opacity-60 transition"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                {saving ? 'Adding…' : 'Add Session'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
          MODAL: Add Subject (Enroll)
         ══════════════════════════════════════════════════════ */}
            {showAddSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900">Add Subject</h2>
                            <button
                                onClick={() => setShowAddSubject(false)}
                                className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by name or code…"
                                value={subjectSearch}
                                onChange={(e) => setSubjectSearch(e.target.value)}
                                className="block w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                        </div>

                        {/* List */}
                        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                            {filteredSubjects.length === 0 && (
                                <li className="py-4 text-center text-sm text-gray-400">No subjects found</li>
                            )}
                            {filteredSubjects.map((s) => {
                                const alreadyEnrolled = enrolledSubjects.some((es) => es.id === s.id);
                                return (
                                    <li key={s.id} className="flex items-center justify-between py-3 px-1">
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                                            <p className="text-xs text-gray-500">{s.code} · {s.department ?? '—'} · Sem {s.semester ?? '—'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleEnroll(s.id)}
                                            disabled={alreadyEnrolled || saving}
                                            className={`shrink-0 ml-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${alreadyEnrolled
                                                    ? 'bg-gray-100 text-gray-400 cursor-default'
                                                    : 'bg-teal-600 text-white hover:bg-teal-700'
                                                }`}
                                        >
                                            {alreadyEnrolled ? 'Enrolled' : 'Enrol'}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}
