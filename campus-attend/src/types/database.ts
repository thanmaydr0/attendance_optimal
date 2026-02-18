// ─────────────────────────────────────────────────────────
// Typed Database interface matching supabase schema
// ─────────────────────────────────────────────────────────

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    full_name: string;
                    email: string;
                    role: 'student' | 'faculty' | 'club_admin' | 'admin';
                    phone_whatsapp: string | null;
                    department: string | null;
                    semester: number | null;
                    created_at: string;
                    avatar_url: string | null;
                };
                Insert: {
                    id: string;
                    full_name: string;
                    email: string;
                    role: 'student' | 'faculty' | 'club_admin' | 'admin';
                    phone_whatsapp?: string | null;
                    department?: string | null;
                    semester?: number | null;
                    created_at?: string;
                    avatar_url?: string | null;
                };
                Update: {
                    id?: string;
                    full_name?: string;
                    email?: string;
                    role?: 'student' | 'faculty' | 'club_admin' | 'admin';
                    phone_whatsapp?: string | null;
                    department?: string | null;
                    semester?: number | null;
                    created_at?: string;
                    avatar_url?: string | null;
                };
            };

            subjects: {
                Row: {
                    id: string;
                    name: string;
                    code: string;
                    faculty_id: string | null;
                    department: string | null;
                    semester: number | null;
                    credits: number;
                    total_classes_planned: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    code: string;
                    faculty_id?: string | null;
                    department?: string | null;
                    semester?: number | null;
                    credits?: number;
                    total_classes_planned?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    code?: string;
                    faculty_id?: string | null;
                    department?: string | null;
                    semester?: number | null;
                    credits?: number;
                    total_classes_planned?: number;
                    created_at?: string;
                };
            };

            events: {
                Row: {
                    id: string;
                    club_admin_id: string | null;
                    name: string;
                    description: string | null;
                    category: 'technical' | 'cultural' | 'social' | 'hackathon' | 'workshop' | 'seminar' | null;
                    venue: string | null;
                    start_datetime: string;
                    end_datetime: string;
                    banner_url: string | null;
                    banner_parsed: boolean;
                    qr_code_token: string;
                    geofence_lat: number | null;
                    geofence_lng: number | null;
                    geofence_radius_m: number;
                    max_participants: number | null;
                    status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
                    learning_outcomes: string[] | null;
                    difficulty_level: number;
                    whatsapp_notification_sent: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    club_admin_id?: string | null;
                    name: string;
                    description?: string | null;
                    category?: 'technical' | 'cultural' | 'social' | 'hackathon' | 'workshop' | 'seminar' | null;
                    venue?: string | null;
                    start_datetime: string;
                    end_datetime: string;
                    banner_url?: string | null;
                    banner_parsed?: boolean;
                    qr_code_token?: string;
                    geofence_lat?: number | null;
                    geofence_lng?: number | null;
                    geofence_radius_m?: number;
                    max_participants?: number | null;
                    status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
                    learning_outcomes?: string[] | null;
                    difficulty_level?: number;
                    whatsapp_notification_sent?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    club_admin_id?: string | null;
                    name?: string;
                    description?: string | null;
                    category?: 'technical' | 'cultural' | 'social' | 'hackathon' | 'workshop' | 'seminar' | null;
                    venue?: string | null;
                    start_datetime?: string;
                    end_datetime?: string;
                    banner_url?: string | null;
                    banner_parsed?: boolean;
                    qr_code_token?: string;
                    geofence_lat?: number | null;
                    geofence_lng?: number | null;
                    geofence_radius_m?: number;
                    max_participants?: number | null;
                    status?: 'upcoming' | 'ongoing' | 'completed' | 'cancelled';
                    learning_outcomes?: string[] | null;
                    difficulty_level?: number;
                    whatsapp_notification_sent?: boolean;
                    created_at?: string;
                };
            };

            attendance_records: {
                Row: {
                    id: string;
                    student_id: string | null;
                    class_session_id: string | null;
                    status: 'present' | 'absent' | 'on_duty' | 'medical';
                    marked_at: string;
                    marked_by: 'student' | 'faculty' | 'system' | 'ai_approved';
                    on_duty_event_id: string | null;
                    notes: string | null;
                };
                Insert: {
                    id?: string;
                    student_id?: string | null;
                    class_session_id?: string | null;
                    status: 'present' | 'absent' | 'on_duty' | 'medical';
                    marked_at?: string;
                    marked_by?: 'student' | 'faculty' | 'system' | 'ai_approved';
                    on_duty_event_id?: string | null;
                    notes?: string | null;
                };
                Update: {
                    id?: string;
                    student_id?: string | null;
                    class_session_id?: string | null;
                    status?: 'present' | 'absent' | 'on_duty' | 'medical';
                    marked_at?: string;
                    marked_by?: 'student' | 'faculty' | 'system' | 'ai_approved';
                    on_duty_event_id?: string | null;
                    notes?: string | null;
                };
            };

            event_registrations: {
                Row: {
                    id: string;
                    event_id: string | null;
                    student_id: string | null;
                    check_in_time: string | null;
                    check_in_lat: number | null;
                    check_in_lng: number | null;
                    geofence_verified: boolean;
                    certificate_issued: boolean;
                    certificate_url: string | null;
                    on_duty_status: 'pending' | 'approved' | 'rejected';
                };
                Insert: {
                    id?: string;
                    event_id?: string | null;
                    student_id?: string | null;
                    check_in_time?: string | null;
                    check_in_lat?: number | null;
                    check_in_lng?: number | null;
                    geofence_verified?: boolean;
                    certificate_issued?: boolean;
                    certificate_url?: string | null;
                    on_duty_status?: 'pending' | 'approved' | 'rejected';
                };
                Update: {
                    id?: string;
                    event_id?: string | null;
                    student_id?: string | null;
                    check_in_time?: string | null;
                    check_in_lat?: number | null;
                    check_in_lng?: number | null;
                    geofence_verified?: boolean;
                    certificate_issued?: boolean;
                    certificate_url?: string | null;
                    on_duty_status?: 'pending' | 'approved' | 'rejected';
                };
            };

            on_duty_requests: {
                Row: {
                    id: string;
                    student_id: string | null;
                    event_registration_id: string | null;
                    faculty_id: string | null;
                    subject_id: string | null;
                    class_session_id: string | null;
                    status: 'pending' | 'approved' | 'rejected' | 'escalated';
                    ai_message_log: Record<string, unknown>[];
                    created_at: string;
                    resolved_at: string | null;
                    faculty_response: string | null;
                };
                Insert: {
                    id?: string;
                    student_id?: string | null;
                    event_registration_id?: string | null;
                    faculty_id?: string | null;
                    subject_id?: string | null;
                    class_session_id?: string | null;
                    status?: 'pending' | 'approved' | 'rejected' | 'escalated';
                    ai_message_log?: Record<string, unknown>[];
                    created_at?: string;
                    resolved_at?: string | null;
                    faculty_response?: string | null;
                };
                Update: {
                    id?: string;
                    student_id?: string | null;
                    event_registration_id?: string | null;
                    faculty_id?: string | null;
                    subject_id?: string | null;
                    class_session_id?: string | null;
                    status?: 'pending' | 'approved' | 'rejected' | 'escalated';
                    ai_message_log?: Record<string, unknown>[];
                    created_at?: string;
                    resolved_at?: string | null;
                    faculty_response?: string | null;
                };
            };

            academic_semesters: {
                Row: {
                    id: string;
                    name: string;
                    start_date: string;
                    end_date: string;
                    total_working_days: number;
                    attendance_threshold: number;
                    condonation_threshold: number;
                    is_current: boolean;
                };
                Insert: {
                    id?: string;
                    name: string;
                    start_date: string;
                    end_date: string;
                    total_working_days: number;
                    attendance_threshold?: number;
                    condonation_threshold?: number;
                    is_current?: boolean;
                };
                Update: {
                    id?: string;
                    name?: string;
                    start_date?: string;
                    end_date?: string;
                    total_working_days?: number;
                    attendance_threshold?: number;
                    condonation_threshold?: number;
                    is_current?: boolean;
                };
            };
        };

        Functions: {
            calculate_attendance_buffer: {
                Args: {
                    p_student_id: string;
                    p_subject_id: string;
                };
                Returns: {
                    present_count: number;
                    held_count: number;
                    total_planned: number;
                    current_pct: number;
                    buffer_classes: number;
                    projected_pct: number;
                    is_safe: boolean;
                };
            };
        };
    };
}

// ── Convenience type aliases ────────────────────────────────
export type Tables<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Row'];

export type InsertDto<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Insert'];

export type UpdateDto<T extends keyof Database['public']['Tables']> =
    Database['public']['Tables'][T]['Update'];

// Shorthand row types
export type Profile = Tables<'profiles'>;
export type Subject = Tables<'subjects'>;
export type Event = Tables<'events'>;
export type AttendanceRecord = Tables<'attendance_records'>;
export type EventRegistration = Tables<'event_registrations'>;
export type OnDutyRequest = Tables<'on_duty_requests'>;
export type AcademicSemester = Tables<'academic_semesters'>;
