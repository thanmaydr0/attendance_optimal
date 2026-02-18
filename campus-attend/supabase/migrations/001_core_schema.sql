-- ============================================================
-- 001_core_schema.sql  –  Campus Attend core tables, RLS & triggers
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES  (extends auth.users)
-- ────────────────────────────────────────────────────────────
CREATE TABLE profiles (
    id            UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    full_name     TEXT NOT NULL,
    email         TEXT UNIQUE NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('student', 'faculty', 'club_admin', 'admin')),
    phone_whatsapp TEXT,
    department    TEXT,
    semester      INT,
    created_at    TIMESTAMPTZ DEFAULT now(),
    avatar_url    TEXT
);

-- ────────────────────────────────────────────────────────────
-- 2. SUBJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE subjects (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                  TEXT NOT NULL,
    code                  TEXT NOT NULL,
    faculty_id            UUID REFERENCES profiles(id),
    department            TEXT,
    semester              INT,
    credits               INT DEFAULT 3,
    total_classes_planned INT DEFAULT 0,
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 3. STUDENT_SUBJECTS  (enrollment junction)
-- ────────────────────────────────────────────────────────────
CREATE TABLE student_subjects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID REFERENCES profiles(id),
    subject_id  UUID REFERENCES subjects(id),
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (student_id, subject_id)
);

-- ────────────────────────────────────────────────────────────
-- 4. CLASS_SESSIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE class_sessions (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id     UUID REFERENCES subjects(id),
    scheduled_date DATE NOT NULL,
    start_time     TIME NOT NULL,
    end_time       TIME NOT NULL,
    venue          TEXT,
    session_type   TEXT DEFAULT 'lecture' CHECK (session_type IN ('lecture', 'lab', 'tutorial')),
    is_cancelled   BOOLEAN DEFAULT false,
    created_at     TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 5. ATTENDANCE_RECORDS
-- ────────────────────────────────────────────────────────────
CREATE TABLE attendance_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id       UUID REFERENCES profiles(id),
    class_session_id UUID REFERENCES class_sessions(id),
    status           TEXT NOT NULL CHECK (status IN ('present', 'absent', 'on_duty', 'medical')),
    marked_at        TIMESTAMPTZ DEFAULT now(),
    marked_by        TEXT DEFAULT 'system' CHECK (marked_by IN ('student', 'faculty', 'system', 'ai_approved')),
    on_duty_event_id UUID,                       -- nullable, links to events
    notes            TEXT,
    UNIQUE (student_id, class_session_id)
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on every table
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- ── profiles ────────────────────────────────────────────────

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ── subjects ────────────────────────────────────────────────

-- All authenticated users can read subjects
CREATE POLICY "Authenticated users can view subjects"
    ON subjects FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only faculty and admin can insert subjects
CREATE POLICY "Faculty and admins can insert subjects"
    ON subjects FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- Only faculty (owner) and admin can update subjects
CREATE POLICY "Faculty and admins can update subjects"
    ON subjects FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- ── student_subjects ────────────────────────────────────────

-- Students can see their own enrollments
CREATE POLICY "Students can view own enrollments"
    ON student_subjects FOR SELECT
    USING (auth.uid() = student_id);

-- Faculty / admin can see all enrollments
CREATE POLICY "Faculty and admins can view all enrollments"
    ON student_subjects FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- ── class_sessions ──────────────────────────────────────────

-- All authenticated users can read class sessions
CREATE POLICY "Authenticated users can view class sessions"
    ON class_sessions FOR SELECT
    USING (auth.role() = 'authenticated');

-- Faculty / admin can insert class sessions
CREATE POLICY "Faculty and admins can insert class sessions"
    ON class_sessions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role IN ('faculty', 'admin')
        )
    );

-- ── attendance_records ──────────────────────────────────────

-- Students can see their own attendance
CREATE POLICY "Students can view own attendance"
    ON attendance_records FOR SELECT
    USING (auth.uid() = student_id);

-- Faculty can see attendance for subjects they teach
CREATE POLICY "Faculty can view attendance for own subjects"
    ON attendance_records FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM class_sessions cs
            JOIN subjects      s ON s.id = cs.subject_id
            WHERE cs.id = attendance_records.class_session_id
              AND s.faculty_id = auth.uid()
        )
    );

-- Faculty can insert attendance records for their subjects
CREATE POLICY "Faculty can insert attendance"
    ON attendance_records FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM class_sessions cs
            JOIN subjects      s ON s.id = cs.subject_id
            WHERE cs.id = class_session_id
              AND s.faculty_id = auth.uid()
        )
    );


-- ============================================================
-- TRIGGER: auto-create profile on auth.users INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
    );
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
