import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';

// ── Types ───────────────────────────────────────────────────

export interface AttendanceBuffer {
    present_count: number;
    held_count: number;
    total_planned: number;
    current_pct: number;
    buffer_classes: number;
    projected_pct: number;
    is_safe: boolean;
}

export interface SubjectAttendance {
    subject_id: string;
    subject_name: string;
    subject_code: string;
    buffer: AttendanceBuffer;
    on_duty_count: number;
}

export interface RecentRecord {
    id: string;
    status: string;
    marked_at: string;
    marked_by: string;
    notes: string | null;
    class_session: {
        scheduled_date: string;
        start_time: string;
        subject: {
            name: string;
            code: string;
        } | null;
    } | null;
}

// ── Fetch helpers ───────────────────────────────────────────

async function fetchAttendanceSummary(
    studentId: string,
): Promise<SubjectAttendance[]> {
    // 1. Get enrolled subjects
    const { data: enrollments, error: enrolErr } = await supabase
        .from('student_subjects')
        .select('subject_id, subjects!subject_id ( id, name, code )')
        .eq('student_id', studentId);

    if (enrolErr) throw enrolErr;
    if (!enrollments || enrollments.length === 0) return [];

    // 2. For each subject, call the RPC
    const results: SubjectAttendance[] = [];

    for (const row of enrollments) {
        const subj = row.subjects as unknown as { id: string; name: string; code: string } | null;
        if (!subj) continue;

        const { data, error } = await supabase.rpc('calculate_attendance_buffer', {
            p_student_id: studentId,
            p_subject_id: subj.id,
        });

        if (error) {
            console.error(`RPC error for ${subj.code}:`, error.message);
            continue;
        }

        // Count on-duty records
        const { count } = await supabase
            .from('attendance_records')
            .select('id', { count: 'exact', head: true })
            .eq('student_id', studentId)
            .eq('status', 'on_duty')
            .in(
                'class_session_id',
                (
                    await supabase
                        .from('class_sessions')
                        .select('id')
                        .eq('subject_id', subj.id)
                ).data?.map((c) => c.id) ?? [],
            );

        results.push({
            subject_id: subj.id,
            subject_name: subj.name,
            subject_code: subj.code,
            buffer: data as unknown as AttendanceBuffer,
            on_duty_count: count ?? 0,
        });
    }

    return results;
}

async function fetchRecentRecords(
    studentId: string,
    limit = 10,
): Promise<RecentRecord[]> {
    const { data, error } = await supabase
        .from('attendance_records')
        .select(`
      id, status, marked_at, marked_by, notes,
      class_session:class_sessions!class_session_id (
        scheduled_date, start_time,
        subject:subjects!subject_id ( name, code )
      )
    `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return (data as unknown as RecentRecord[]) ?? [];
}

// ── Trend data (weekly aggregated) ──────────────────────────

export interface WeeklyTrend {
    week: string;       // e.g. "Week 1", "Week 2"
    pct: number;        // cumulative attendance %
    projected: number;  // projected end-of-semester %
}

async function fetchTrendData(studentId: string): Promise<WeeklyTrend[]> {
    // Fetch all attendance records ordered by date
    const { data, error } = await supabase
        .from('attendance_records')
        .select(`
      status, marked_at,
      class_session:class_sessions!class_session_id ( scheduled_date )
    `)
        .eq('student_id', studentId)
        .order('marked_at', { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Group by week and compute cumulative attendance
    const trends: WeeklyTrend[] = [];
    let totalHeld = 0;
    let totalPresent = 0;
    let weekNum = 0;
    let lastWeekKey = '';

    for (const record of data) {
        const session = record.class_session as unknown as { scheduled_date: string } | null;
        const dateStr = session?.scheduled_date ?? record.marked_at;
        const date = new Date(dateStr);
        // ISO week key
        const weekKey = `${date.getFullYear()}-W${Math.ceil(
            ((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7,
        )}`;

        totalHeld++;
        if (record.status === 'present' || record.status === 'on_duty') {
            totalPresent++;
        }

        if (weekKey !== lastWeekKey) {
            weekNum++;
            lastWeekKey = weekKey;
        }

        // Upsert the current week's data point
        const pct = totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 10000) / 100 : 100;
        const existing = trends.find((t) => t.week === `Week ${weekNum}`);
        if (existing) {
            existing.pct = pct;
            existing.projected = pct; // simplified projection
        } else {
            trends.push({ week: `Week ${weekNum}`, pct, projected: pct });
        }
    }

    return trends;
}

// ── React Query hooks ───────────────────────────────────────

export function useAttendanceSummary() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['attendance-summary', user?.id],
        queryFn: () => fetchAttendanceSummary(user!.id),
        enabled: !!user,
        staleTime: 60_000,
    });
}

export function useRecentRecords(limit = 10) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['recent-attendance', user?.id, limit],
        queryFn: () => fetchRecentRecords(user!.id, limit),
        enabled: !!user,
        staleTime: 60_000,
    });
}

export function useAttendanceTrend() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['attendance-trend', user?.id],
        queryFn: () => fetchTrendData(user!.id),
        enabled: !!user,
        staleTime: 120_000,
    });
}
