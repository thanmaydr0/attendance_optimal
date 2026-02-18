import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase';
import { useAuth } from './useAuth';
import type { Subject, ClassSession } from '../types/database';

// ── Extended session type with joined subject data ──────────
export interface TimetableSession extends ClassSession {
    subject: Pick<Subject, 'id' | 'name' | 'code' | 'department'> & {
        faculty: { full_name: string } | null;
    };
}

export interface AddSessionInput {
    subject_id: string;
    scheduled_date: string;     // YYYY-MM-DD
    start_time: string;         // HH:MM
    end_time: string;           // HH:MM
    venue?: string;
    session_type?: 'lecture' | 'lab' | 'tutorial';
}

export interface EnrolledSubject extends Subject {
    faculty: { full_name: string } | null;
}

export function useTimetable() {
    const { user } = useAuth();
    const [sessions, setSessions] = useState<TimetableSession[]>([]);
    const [enrolledSubjects, setEnrolledSubjects] = useState<EnrolledSubject[]>([]);
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [loading, setLoading] = useState(true);

    // ── Fetch timetable sessions ──────────────────────────────
    const fetchTimetable = useCallback(async () => {
        if (!user) return;
        setLoading(true);

        // Get student's enrolled subject IDs
        const { data: enrollments } = await supabase
            .from('student_subjects')
            .select('subject_id')
            .eq('student_id', user.id);

        const subjectIds = (enrollments ?? [])
            .map((e) => e.subject_id)
            .filter(Boolean) as string[];

        if (subjectIds.length === 0) {
            setSessions([]);
            setLoading(false);
            return;
        }

        // Fetch class sessions for those subjects, with subject + faculty join
        const { data, error } = await supabase
            .from('class_sessions')
            .select(`
        *,
        subject:subjects!subject_id (
          id, name, code, department,
          faculty:profiles!faculty_id ( full_name )
        )
      `)
            .in('subject_id', subjectIds)
            .eq('is_cancelled', false)
            .order('scheduled_date')
            .order('start_time');

        if (error) {
            console.error('fetchTimetable error:', error.message);
        }

        // Supabase returns the joined `subject` as an object (single FK)
        setSessions((data as unknown as TimetableSession[]) ?? []);
        setLoading(false);
    }, [user]);

    // ── Fetch enrolled subjects ───────────────────────────────
    const fetchEnrolledSubjects = useCallback(async () => {
        if (!user) return;

        const { data } = await supabase
            .from('student_subjects')
            .select(`
        subject:subjects!subject_id (
          *,
          faculty:profiles!faculty_id ( full_name )
        )
      `)
            .eq('student_id', user.id);

        const subjects = (data ?? [])
            .map((d) => d.subject as unknown as EnrolledSubject)
            .filter(Boolean);

        setEnrolledSubjects(subjects);
    }, [user]);

    // ── Fetch all subjects (for "Add Subject" modal) ──────────
    const fetchAllSubjects = useCallback(async () => {
        const { data } = await supabase
            .from('subjects')
            .select('*')
            .order('name');

        setAllSubjects(data ?? []);
    }, []);

    // ── Add a new class session ───────────────────────────────
    const addSession = useCallback(async (input: AddSessionInput) => {
        const { error } = await supabase
            .from('class_sessions')
            .insert({
                subject_id: input.subject_id,
                scheduled_date: input.scheduled_date,
                start_time: input.start_time,
                end_time: input.end_time,
                venue: input.venue ?? null,
                session_type: input.session_type ?? 'lecture',
            });

        if (error) throw error;
        await fetchTimetable();
    }, [fetchTimetable]);

    // ── Soft-delete a session ─────────────────────────────────
    const deleteSession = useCallback(async (sessionId: string) => {
        const { error } = await supabase
            .from('class_sessions')
            .update({ is_cancelled: true })
            .eq('id', sessionId);

        if (error) throw error;
        await fetchTimetable();
    }, [fetchTimetable]);

    // ── Enrol in a subject ────────────────────────────────────
    const enrollInSubject = useCallback(async (subjectId: string) => {
        if (!user) return;

        const { error } = await supabase
            .from('student_subjects')
            .insert({ student_id: user.id, subject_id: subjectId });

        if (error) throw error;
        await fetchEnrolledSubjects();
        await fetchTimetable();
    }, [user, fetchEnrolledSubjects, fetchTimetable]);

    // ── Bootstrap on mount ────────────────────────────────────
    useEffect(() => {
        fetchTimetable();
        fetchEnrolledSubjects();
        fetchAllSubjects();
    }, [fetchTimetable, fetchEnrolledSubjects, fetchAllSubjects]);

    return {
        sessions,
        enrolledSubjects,
        allSubjects,
        loading,
        addSession,
        deleteSession,
        enrollInSubject,
        refetch: fetchTimetable,
    };
}
