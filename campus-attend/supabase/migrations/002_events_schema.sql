-- ============================================================
-- 002_events_schema.sql  –  Events, registrations, OD, semesters, WhatsApp log
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EVENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE events (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_admin_id               UUID REFERENCES profiles(id),
    name                        TEXT NOT NULL,
    description                 TEXT,
    category                    TEXT CHECK (category IN ('technical','cultural','social','hackathon','workshop','seminar')),
    venue                       TEXT,
    start_datetime              TIMESTAMPTZ NOT NULL,
    end_datetime                TIMESTAMPTZ NOT NULL,
    banner_url                  TEXT,
    banner_parsed               BOOLEAN DEFAULT false,
    qr_code_token               TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    geofence_lat                DOUBLE PRECISION,
    geofence_lng                DOUBLE PRECISION,
    geofence_radius_m           INT DEFAULT 200,
    max_participants            INT,
    status                      TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','ongoing','completed','cancelled')),
    learning_outcomes           TEXT[],
    difficulty_level            INT DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 5),
    whatsapp_notification_sent  BOOLEAN DEFAULT false,
    created_at                  TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. EVENT_REGISTRATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE event_registrations (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id          UUID REFERENCES events(id),
    student_id        UUID REFERENCES profiles(id),
    check_in_time     TIMESTAMPTZ,
    check_in_lat      DOUBLE PRECISION,
    check_in_lng      DOUBLE PRECISION,
    geofence_verified BOOLEAN DEFAULT false,
    certificate_issued BOOLEAN DEFAULT false,
    certificate_url   TEXT,
    on_duty_status    TEXT DEFAULT 'pending' CHECK (on_duty_status IN ('pending','approved','rejected')),
    UNIQUE (event_id, student_id)
);

-- ────────────────────────────────────────────────────────────
-- 3. ON_DUTY_REQUESTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE on_duty_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id            UUID REFERENCES profiles(id),
    event_registration_id UUID REFERENCES event_registrations(id),
    faculty_id            UUID REFERENCES profiles(id),
    subject_id            UUID REFERENCES subjects(id),
    class_session_id      UUID REFERENCES class_sessions(id),
    status                TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','escalated')),
    ai_message_log        JSONB DEFAULT '[]',
    created_at            TIMESTAMPTZ DEFAULT now(),
    resolved_at           TIMESTAMPTZ,
    faculty_response      TEXT
);

-- ────────────────────────────────────────────────────────────
-- 4. ACADEMIC_SEMESTERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE academic_semesters (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   TEXT NOT NULL,
    start_date             DATE NOT NULL,
    end_date               DATE NOT NULL,
    total_working_days     INT NOT NULL,
    attendance_threshold   NUMERIC(4,2) DEFAULT 0.75,
    condonation_threshold  NUMERIC(4,2) DEFAULT 0.65,
    is_current             BOOLEAN DEFAULT false
);

-- ────────────────────────────────────────────────────────────
-- 5. WHATSAPP_MESSAGE_LOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE whatsapp_message_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    on_duty_request_id  UUID REFERENCES on_duty_requests(id),
    to_phone            TEXT NOT NULL,
    message_body        TEXT NOT NULL,
    twilio_message_sid  TEXT,
    direction           TEXT CHECK (direction IN ('outbound','inbound')),
    status              TEXT,
    sent_at             TIMESTAMPTZ DEFAULT now()
);


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_duty_requests    ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_semesters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;

-- ── events ──────────────────────────────────────────────────

-- All authenticated users can read events
CREATE POLICY "Authenticated users can view events"
    ON events FOR SELECT
    USING (auth.role() = 'authenticated');

-- Club admins can insert their own events
CREATE POLICY "Club admins can create events"
    ON events FOR INSERT
    WITH CHECK (auth.uid() = club_admin_id);

-- Club admins can update their own events
CREATE POLICY "Club admins can update own events"
    ON events FOR UPDATE
    USING (auth.uid() = club_admin_id)
    WITH CHECK (auth.uid() = club_admin_id);

-- Club admins can delete their own events
CREATE POLICY "Club admins can delete own events"
    ON events FOR DELETE
    USING (auth.uid() = club_admin_id);

-- Admins have full access to events
CREATE POLICY "Admins have full access to events"
    ON events FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- ── event_registrations ─────────────────────────────────────

-- Students can see their own registrations
CREATE POLICY "Students can view own registrations"
    ON event_registrations FOR SELECT
    USING (auth.uid() = student_id);

-- Club admins can see registrations for their events
CREATE POLICY "Club admins can view registrations for own events"
    ON event_registrations FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM events e
            WHERE e.id = event_registrations.event_id
              AND e.club_admin_id = auth.uid()
        )
    );

-- Students can register themselves
CREATE POLICY "Students can register for events"
    ON event_registrations FOR INSERT
    WITH CHECK (auth.uid() = student_id);

-- Students can update their own registration (check-in)
CREATE POLICY "Students can update own registration"
    ON event_registrations FOR UPDATE
    USING (auth.uid() = student_id)
    WITH CHECK (auth.uid() = student_id);

-- ── on_duty_requests ────────────────────────────────────────

-- Students can see their own OD requests
CREATE POLICY "Students can view own OD requests"
    ON on_duty_requests FOR SELECT
    USING (auth.uid() = student_id);

-- Faculty can see OD requests directed to them
CREATE POLICY "Faculty can view OD requests for them"
    ON on_duty_requests FOR SELECT
    USING (auth.uid() = faculty_id);

-- Students can create OD requests
CREATE POLICY "Students can create OD requests"
    ON on_duty_requests FOR INSERT
    WITH CHECK (auth.uid() = student_id);

-- Faculty can update OD requests directed to them (approve/reject)
CREATE POLICY "Faculty can update OD requests for them"
    ON on_duty_requests FOR UPDATE
    USING (auth.uid() = faculty_id)
    WITH CHECK (auth.uid() = faculty_id);

-- ── academic_semesters ──────────────────────────────────────

-- All authenticated users can read semesters
CREATE POLICY "Authenticated users can view semesters"
    ON academic_semesters FOR SELECT
    USING (auth.role() = 'authenticated');

-- Only admins can manage semesters
CREATE POLICY "Admins can manage semesters"
    ON academic_semesters FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );

-- ── whatsapp_message_log ────────────────────────────────────

-- Admins can view all message logs
CREATE POLICY "Admins can view message logs"
    ON whatsapp_message_log FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid() AND p.role = 'admin'
        )
    );


-- ============================================================
-- FUNCTION: calculate_attendance_buffer
-- ============================================================
-- Returns JSONB: { present_count, held_count, total_planned,
--                  current_pct, buffer_classes, projected_pct, is_safe }
-- ============================================================

CREATE OR REPLACE FUNCTION public.calculate_attendance_buffer(
    p_student_id UUID,
    p_subject_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_present_count   INT;
    v_held_count      INT;
    v_total_planned   INT;
    v_current_pct     NUMERIC(5,4);
    v_threshold       NUMERIC(4,2);
    v_remaining       INT;
    v_buffer_classes  INT;
    v_projected_pct   NUMERIC(5,4);
    v_is_safe         BOOLEAN;
BEGIN
    -- Get the attendance threshold from the current semester
    SELECT attendance_threshold INTO v_threshold
    FROM academic_semesters
    WHERE is_current = true
    LIMIT 1;

    -- Fallback if no current semester is configured
    IF v_threshold IS NULL THEN
        v_threshold := 0.75;
    END IF;

    -- Total classes planned for this subject
    SELECT COALESCE(total_classes_planned, 0) INTO v_total_planned
    FROM subjects
    WHERE id = p_subject_id;

    -- Classes actually held (not cancelled) so far
    SELECT COUNT(*) INTO v_held_count
    FROM class_sessions
    WHERE subject_id = p_subject_id
      AND is_cancelled = false
      AND scheduled_date <= CURRENT_DATE;

    -- Classes the student attended
    SELECT COUNT(*) INTO v_present_count
    FROM attendance_records ar
    JOIN class_sessions cs ON cs.id = ar.class_session_id
    WHERE ar.student_id = p_student_id
      AND cs.subject_id = p_subject_id
      AND ar.status IN ('present', 'on_duty');

    -- Current attendance percentage
    IF v_held_count > 0 THEN
        v_current_pct := v_present_count::NUMERIC / v_held_count;
    ELSE
        v_current_pct := 1.0;
    END IF;

    -- Remaining classes = planned - held
    v_remaining := GREATEST(v_total_planned - v_held_count, 0);

    -- Buffer: how many remaining classes the student can skip and stay >= threshold
    -- Formula: present_count / (held_count + remaining) >= threshold
    --   => student needs ceil(threshold * total_planned) total present
    --   => can miss: present_count + remaining - ceil(threshold * total_planned)
    v_buffer_classes := GREATEST(
        (v_present_count + v_remaining) - CEIL(v_threshold * v_total_planned)::INT,
        0
    );

    -- Projected percentage if student attends all remaining classes
    IF v_total_planned > 0 THEN
        v_projected_pct := (v_present_count + v_remaining)::NUMERIC / v_total_planned;
    ELSE
        v_projected_pct := v_current_pct;
    END IF;

    -- Is the student currently safe?
    v_is_safe := v_current_pct >= v_threshold;

    RETURN jsonb_build_object(
        'present_count',  v_present_count,
        'held_count',     v_held_count,
        'total_planned',  v_total_planned,
        'current_pct',    ROUND(v_current_pct, 4),
        'buffer_classes', v_buffer_classes,
        'projected_pct',  ROUND(v_projected_pct, 4),
        'is_safe',        v_is_safe
    );
END;
$$;
