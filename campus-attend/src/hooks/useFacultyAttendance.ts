import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Subject, ClassSession } from '../types/database';

// ── Types ───────────────────────────────────────────────────

export interface FacultySubject extends Subject {
    _count_sessions?: number;
}

export interface SessionWithSubject extends ClassSession {
    subject: Pick<Subject, 'id' | 'name' | 'code'> | null;
}

export interface EnrolledStudent {
    student_id: string;
    profile: {
        id: string;
        full_name: string;
        email: string;
        department: string | null;
        semester: number | null;
    };
}

export interface StudentRow extends EnrolledStudent {
    status: 'present' | 'absent' | 'on_duty' | 'medical';
    hasPendingOD: boolean;
    odRequestId: string | null;
}

export interface ODRequest {
    id: string;
    status: 'pending' | 'approved' | 'rejected' | 'escalated';
    created_at: string;
    resolved_at: string | null;
    faculty_response: string | null;
    ai_message_log: Record<string, unknown>[];
    student: { id: string; full_name: string; email: string } | null;
    subject: { id: string; name: string; code: string } | null;
    class_session: { id: string; scheduled_date: string; start_time: string } | null;
    event_registration: {
        id: string;
        event: { id: string; name: string; start_datetime: string } | null;
    } | null;
}

// ── Query: Faculty's subjects ───────────────────────────────

export function useFacultySubjects() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['faculty-subjects', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('subjects')
                .select('*')
                .eq('faculty_id', user!.id)
                .order('name');
            if (error) throw error;
            return (data ?? []) as FacultySubject[];
        },
        enabled: !!user,
        staleTime: 120_000,
    });
}

// ── Query: Sessions for a subject (today by default) ────────

export function useFacultySessions(subjectId: string | null, dateFilter?: string) {
    const today = dateFilter ?? new Date().toISOString().slice(0, 10);
    return useQuery({
        queryKey: ['faculty-sessions', subjectId, today],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('class_sessions')
                .select(`*, subject:subjects!subject_id ( id, name, code )`)
                .eq('subject_id', subjectId!)
                .eq('scheduled_date', today)
                .eq('is_cancelled', false)
                .order('start_time');
            if (error) throw error;
            return (data as unknown as SessionWithSubject[]) ?? [];
        },
        enabled: !!subjectId,
        staleTime: 30_000,
    });
}

// ── Query: Enrolled students for a subject ──────────────────

export function useEnrolledStudents(subjectId: string | null) {
    return useQuery({
        queryKey: ['enrolled-students', subjectId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('student_subjects')
                .select(`
          student_id,
          profile:profiles!student_id (
            id, full_name, email, department, semester
          )
        `)
                .eq('subject_id', subjectId!);
            if (error) throw error;
            return (data as unknown as EnrolledStudent[]) ?? [];
        },
        enabled: !!subjectId,
        staleTime: 60_000,
    });
}

// ── Query: Pending OD requests for a session ────────────────

export function usePendingODsForSession(sessionId: string | null) {
    return useQuery({
        queryKey: ['pending-ods', sessionId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('on_duty_requests')
                .select('id, student_id, status')
                .eq('class_session_id', sessionId!)
                .eq('status', 'pending');
            if (error) throw error;
            return (data ?? []) as { id: string; student_id: string | null; status: string }[];
        },
        enabled: !!sessionId,
        staleTime: 15_000,
    });
}

// ── Mutation: Bulk upsert attendance ────────────────────────

interface BulkAttendanceInput {
    session_id: string;
    records: { student_id: string; status: 'present' | 'absent' | 'on_duty' | 'medical' }[];
}

export function useBulkMarkAttendance() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ session_id, records }: BulkAttendanceInput) => {
            const rows = records.map((r) => ({
                student_id: r.student_id,
                class_session_id: session_id,
                status: r.status,
                marked_by: 'faculty' as const,
            }));

            const { error } = await supabase
                .from('attendance_records')
                .upsert(rows, { onConflict: 'student_id,class_session_id' });

            if (error) throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['faculty-sessions'] });
            qc.invalidateQueries({ queryKey: ['pending-ods'] });
        },
    });
}

// ── Query: All OD requests for this faculty ─────────────────

export function useFacultyODRequests() {
    const { user } = useAuth();
    return useQuery({
        queryKey: ['faculty-od-requests', user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('on_duty_requests')
                .select(`
          id, status, created_at, resolved_at, faculty_response, ai_message_log,
          student:profiles!student_id ( id, full_name, email ),
          subject:subjects!subject_id ( id, name, code ),
          class_session:class_sessions!class_session_id ( id, scheduled_date, start_time ),
          event_registration:event_registrations!event_registration_id (
            id,
            event:events!event_id ( id, name, start_datetime )
          )
        `)
                .eq('faculty_id', user!.id)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data as unknown as ODRequest[]) ?? [];
        },
        enabled: !!user,
        staleTime: 30_000,
    });
}

// ── Mutation: Approve / Reject OD request ───────────────────

interface ResolveODInput {
    requestId: string;
    action: 'approved' | 'rejected';
    response?: string;
    studentId?: string;
    sessionId?: string;
}

export function useResolveODRequest() {
    const qc = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, action, response, studentId, sessionId }: ResolveODInput) => {
            // 1. Update the OD request
            const { error: odErr } = await supabase
                .from('on_duty_requests')
                .update({
                    status: action,
                    resolved_at: new Date().toISOString(),
                    faculty_response: response ?? null,
                })
                .eq('id', requestId);

            if (odErr) throw odErr;

            // 2. If approved → upsert attendance as on_duty
            if (action === 'approved' && studentId && sessionId) {
                const { error: attErr } = await supabase
                    .from('attendance_records')
                    .upsert(
                        {
                            student_id: studentId,
                            class_session_id: sessionId,
                            status: 'on_duty',
                            marked_by: 'faculty',
                        },
                        { onConflict: 'student_id,class_session_id' },
                    );
                if (attErr) throw attErr;
            }

            // 3. If rejected → invoke WhatsApp Edge Function (fire-and-forget)
            if (action === 'rejected') {
                supabase.functions
                    .invoke('send-whatsapp', {
                        body: { request_id: requestId, action: 'rejected' },
                    })
                    .catch(console.error);
            }
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['faculty-od-requests'] });
            qc.invalidateQueries({ queryKey: ['pending-ods'] });
        },
    });
}
