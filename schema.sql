-- ============================================================================
-- THINKERZZ EOS V3.1 — MASTER SUPABASE DATABASE SCHEMA & RLS SECURITY
-- Authoritative Schema Migration Script (Phase 1)
-- ============================================================================

-- Enable required Postgres extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. HELPER FUNCTIONS & TRIGGERS (Global Invariants)
-- ============================================================================

-- 1.1 Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.2 Append-only Audit Log table and trigger function
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    performed_by UUID, -- Supabase auth user_id
    diff JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log trigger function
CREATE OR REPLACE FUNCTION audit_log_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
    user_id_val UUID;
    org_id_val UUID;
    diff_val JSONB;
BEGIN
    user_id_val := auth.uid();
    
    IF TG_OP = 'DELETE' THEN
        IF TG_TABLE_NAME = 'orgs' THEN
            org_id_val := OLD.id;
        ELSE
            org_id_val := OLD.org_id;
        END IF;
        diff_val := jsonb_build_object('old', to_jsonb(OLD));
        INSERT INTO public.audit_log (org_id, table_name, record_id, action, performed_by, diff)
        VALUES (org_id_val, TG_TABLE_NAME, OLD.id, TG_OP, user_id_val, diff_val);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        IF TG_TABLE_NAME = 'orgs' THEN
            org_id_val := NEW.id;
        ELSE
            org_id_val := NEW.org_id;
        END IF;
        diff_val := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
        INSERT INTO public.audit_log (org_id, table_name, record_id, action, performed_by, diff)
        VALUES (org_id_val, TG_TABLE_NAME, NEW.id, TG_OP, user_id_val, diff_val);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        IF TG_TABLE_NAME = 'orgs' THEN
            org_id_val := NEW.id;
        ELSE
            org_id_val := NEW.org_id;
        END IF;
        diff_val := jsonb_build_object('new', to_jsonb(NEW));
        INSERT INTO public.audit_log (org_id, table_name, record_id, action, performed_by, diff)
        VALUES (org_id_val, TG_TABLE_NAME, NEW.id, TG_OP, user_id_val, diff_val);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 2. CORE SCHEMAS & TABLES
-- ============================================================================

-- 2.1 Identity & Organization
CREATE TABLE IF NOT EXISTS public.orgs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    timezone TEXT NOT NULL DEFAULT 'Asia/Karachi',
    academic_year TEXT NOT NULL DEFAULT '2026',
    settings_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'teacher', 'student')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    teacher_id UUID, -- Foreign key added below after teachers table creation
    student_id UUID, -- Foreign key added below after students table creation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.2 Teachers & Staff
CREATE TABLE IF NOT EXISTS public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    capacity INT NOT NULL, -- Set by Admin only, no pre-filled default
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_class', 'on_leave')),
    rating NUMERIC(3,1) NOT NULL DEFAULT 0.0, -- Default 0 ("New")
    demos_given INT NOT NULL DEFAULT 0, -- Default 0 ("New")
    demos_converted INT NOT NULL DEFAULT 0, -- Default 0 ("New")
    reliability INT NOT NULL DEFAULT 0, -- Default 0 ("New")
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    city TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.3 Teacher Pay Rates (ISOLATED TABLE — Admin-only RLS)
CREATE TABLE IF NOT EXISTS public.teacher_pay_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    rate_per_class NUMERIC(10,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'PKR',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.teacher_leave (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.4 Academic Master Data & Versioned Syllabus
CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    name TEXT NOT NULL,
    program TEXT NOT NULL CHECK (program IN ('O Level', 'A Level', 'IGCSE')),
    has_syllabus BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.teacher_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(teacher_id, subject_id)
);

CREATE TABLE IF NOT EXISTS public.syllabus_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    program TEXT NOT NULL CHECK (program IN ('O Level', 'A Level', 'IGCSE')),
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    academic_year TEXT NOT NULL, -- e.g. '2026'
    cambridge_code TEXT NOT NULL, -- e.g. '9702'
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.syllabus_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    template_id UUID NOT NULL REFERENCES public.syllabus_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.5 Students & Enrollment
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    name TEXT NOT NULL,
    parent_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    gender TEXT NOT NULL DEFAULT 'female' CHECK (gender IN ('male', 'female', 'other')),
    program TEXT NOT NULL CHECK (program IN ('O Level', 'A Level', 'IGCSE')),
    exam_session TEXT NOT NULL, -- e.g. 'May/June 2027'
    enrolled_at DATE NOT NULL DEFAULT CURRENT_DATE,
    months_committed INT NOT NULL DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'stopped')),
    monthly_fee NUMERIC(10,2) NOT NULL, -- Flexible manual value
    fee_status TEXT NOT NULL DEFAULT 'due' CHECK (fee_status IN ('paid', 'due', 'in_grace', 'stopped')),
    next_due_date DATE NOT NULL,
    source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.student_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    syllabus_template_id UUID NOT NULL REFERENCES public.syllabus_templates(id),
    target_grade TEXT NOT NULL DEFAULT 'A*' CHECK (target_grade IN ('A*', 'A', 'B', 'C', 'D', 'E', 'U')),
    assessed_grade TEXT NULL CHECK (assessed_grade IN ('A*', 'A', 'B', 'C', 'D', 'E', 'U')), -- Teacher sets after test
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.syllabus_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL REFERENCES public.syllabus_topics(id) ON DELETE CASCADE,
    state TEXT NOT NULL DEFAULT 'plan' CHECK (state IN ('covered', 'plan', 'na')),
    covered_at TIMESTAMPTZ NULL,
    by_teacher_id UUID NULL REFERENCES public.teachers(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    UNIQUE(student_id, topic_id)
);

-- 2.6 Admissions & CRM
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    name TEXT NOT NULL,
    parent_name TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    program TEXT CHECK (program IN ('O Level', 'A Level', 'IGCSE')),
    subjects TEXT, -- Free text note at lead stage
    source TEXT NOT NULL DEFAULT 'google' CHECK (source IN ('google', 'facebook', 'instagram', 'whatsapp', 'referral', 'walk_in')),
    utm JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'demo_booked', 'won', 'lost')),
    temperature TEXT NOT NULL DEFAULT 'warm' CHECK (temperature IN ('hot', 'warm', 'cold')),
    assigned_manager UUID NULL REFERENCES auth.users(id),
    next_follow_up DATE NULL,
    lost_reason TEXT NULL,
    converted_student_id UUID NULL REFERENCES public.students(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.lead_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL,
    note TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.demos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    subject_id UUID NULL REFERENCES public.subjects(id),
    teacher_id UUID NULL REFERENCES public.teachers(id),
    scheduled_at TIMESTAMPTZ NOT NULL,
    meeting_link TEXT,
    status TEXT NOT NULL DEFAULT 'needs_teacher' CHECK (status IN ('needs_teacher', 'scheduled', 'awaiting_outcome', 'done')),
    outcome TEXT NULL CHECK (outcome IN ('won', 'lost', 'follow_up')),
    reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.7 Academics & Scheduling
CREATE TABLE IF NOT EXISTS public.class_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id),
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    teacher_id UUID NULL REFERENCES public.teachers(id), -- NULL for unassigned public demo
    type TEXT NOT NULL DEFAULT 'class' CHECK (type IN ('class', 'makeup', 'test')),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
    meeting_link TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL,
    
    -- TIME-RANGE OVERLAP EXCLUDE CONSTRAINT (btree_gist)
    CONSTRAINT no_overlapping_teacher_sessions 
    EXCLUDE USING gist (
        teacher_id WITH =,
        tstzrange(start_at, end_at) WITH &&
    ) WHERE (deleted_at IS NULL AND teacher_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id),
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'absent')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.class_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    session_id UUID NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    topics_covered UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.homework (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id),
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    teacher_id UUID NOT NULL REFERENCES public.teachers(id),
    title TEXT NOT NULL,
    deadline TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'submitted', 'late', 'graded')),
    score NUMERIC(5,2) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id),
    subject_id UUID NOT NULL REFERENCES public.subjects(id),
    name TEXT NOT NULL,
    date DATE NOT NULL,
    score NUMERIC(5,2) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.8 Money & Vouchers (ADMIN ONLY tables)
CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    student_id UUID NOT NULL REFERENCES public.students(id),
    voucher_no TEXT NOT NULL,
    period TEXT NOT NULL, -- e.g. 'August 2026'
    amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    grace_deadline DATE NOT NULL, -- due_date + 3 days
    status TEXT NOT NULL DEFAULT 'due' CHECK (status IN ('due', 'in_grace', 'paid', 'stopped')),
    reference_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.voucher_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('bank_transfer', 'jazzcash', 'easypaisa', 'cash', 'other')),
    reference TEXT,
    screenshot_url TEXT,
    reconciled_by UUID REFERENCES auth.users(id),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL, -- Negative payment value recorded here
    reason TEXT NOT NULL,
    by_user_id UUID NOT NULL REFERENCES auth.users(id),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.fee_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
    decision TEXT NOT NULL CHECK (decision IN ('stop', 'extend', 'paid')),
    by_user_id UUID NOT NULL REFERENCES auth.users(id),
    at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.payment_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    label TEXT NOT NULL,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    iban TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- 2.9 Communication, Support & Notifications Engine
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    type TEXT NOT NULL CHECK (type IN ('class_reminder', 'fee_due', 'grace_ending', 'demo_confirmed', 'payment_received', 'monthly_report', 'follow_up', 'announcement')),
    channels TEXT[] NOT NULL DEFAULT '{"calendar", "email", "wa_me"}',
    priority INT NOT NULL DEFAULT 2 CHECK (priority IN (1, 2, 3)), -- 1 time-critical, 2 transactional, 3 FYI
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
    retry_count INT NOT NULL DEFAULT 0,
    unique_key TEXT NOT NULL, -- Idempotency key
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    posted_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.announcement_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
    program TEXT CHECK (program IN ('O Level', 'A Level', 'IGCSE')),
    student_id UUID NULL REFERENCES public.students(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    subject TEXT NOT NULL,
    opened_by UUID NOT NULL REFERENCES auth.users(id),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    target_reply_at TIMESTAMPTZ NOT NULL, -- 1-hour target SLA
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    title TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Private Supabase Bucket Key
    file_type TEXT NOT NULL,
    student_id UUID NULL REFERENCES public.students(id),
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    referrer_student_id UUID NOT NULL REFERENCES public.students(id),
    referred_name TEXT NOT NULL,
    referred_phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'enrolled', 'rewarded')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.ad_spend (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id),
    channel TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    period DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID UNIQUE NOT NULL REFERENCES public.orgs(id),
    booking_window_start TIME NOT NULL DEFAULT '07:00:00',
    booking_window_end TIME NOT NULL DEFAULT '23:00:00',
    grace_days INT NOT NULL DEFAULT 3,
    weights_json JSONB DEFAULT '{"attendance": 0.50, "homework": 0.30, "fees": 0.20}'::jsonb,
    channel_priority TEXT[] DEFAULT '{"calendar", "email", "wa_me"}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

-- Foreign Key links on Profiles
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. SOFT-DELETE AWARE PARTIAL UNIQUE INDEXES
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_leads_phone ON public.leads(org_id, phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_students_phone ON public.students(org_id, phone) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_vouchers_no ON public.vouchers(org_id, voucher_no) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_uniq_notifications_key ON public.notifications(org_id, unique_key) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. ATTACH AUTOMATIC UPDATED_AT & AUDIT LOG TRIGGERS
-- ============================================================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'orgs', 'profiles', 'teachers', 'teacher_pay_rates', 'teacher_leave',
        'subjects', 'teacher_subjects', 'syllabus_templates', 'syllabus_topics',
        'students', 'student_subjects', 'syllabus_progress', 'leads', 'lead_communications',
        'demos', 'class_sessions', 'attendance', 'class_notes', 'homework', 'tests',
        'vouchers', 'voucher_lines', 'payments', 'refunds', 'fee_decisions',
        'payment_accounts', 'notifications', 'announcements', 'announcement_targets',
        'tickets', 'ticket_messages', 'documents', 'referrals', 'ad_spend', 'settings'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- updated_at trigger
        EXECUTE format('DROP TRIGGER IF EXISTS trg_update_updated_at_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_update_updated_at_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
        
        -- audit_log trigger
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_log_%I ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_audit_log_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION audit_log_trigger_func()', t, t);
    END LOOP;
END $$;


-- ============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES — DENY-BY-DEFAULT
-- ============================================================================

-- Enable RLS on every single table
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'orgs', 'profiles', 'teachers', 'teacher_pay_rates', 'teacher_leave',
        'subjects', 'teacher_subjects', 'syllabus_templates', 'syllabus_topics',
        'students', 'student_subjects', 'syllabus_progress', 'leads', 'lead_communications',
        'demos', 'class_sessions', 'attendance', 'class_notes', 'homework', 'tests',
        'vouchers', 'voucher_lines', 'payments', 'refunds', 'fee_decisions',
        'payment_accounts', 'notifications', 'announcements', 'announcement_targets',
        'tickets', 'ticket_messages', 'documents', 'referrals', 'ad_spend', 'settings', 'audit_log'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

-- 5.1 Helper RLS Functions
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
    SELECT role FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
    SELECT org_id FROM public.profiles WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_teacher_id()
RETURNS UUID AS $$
    SELECT teacher_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'teacher' AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_student_id()
RETURNS UUID AS $$
    SELECT student_id FROM public.profiles WHERE user_id = auth.uid() AND role = 'student' AND deleted_at IS NULL LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 5.2 RLS Policies: Admin (FULL ACCESS across all tables in org)
-- Explicit RLS Policies for orgs table (where primary key is id, not org_id)
DROP POLICY IF EXISTS admin_full_access_orgs ON public.orgs;
CREATE POLICY admin_full_access_orgs ON public.orgs FOR ALL USING (current_user_role() = 'admin' AND id = current_user_org_id());

DROP POLICY IF EXISTS manager_read_orgs ON public.orgs;
CREATE POLICY manager_read_orgs ON public.orgs FOR SELECT USING (current_user_role() = 'manager' AND id = current_user_org_id());

DROP POLICY IF EXISTS teacher_read_orgs ON public.orgs;
CREATE POLICY teacher_read_orgs ON public.orgs FOR SELECT USING (current_user_role() = 'teacher' AND id = current_user_org_id());

DROP POLICY IF EXISTS student_read_orgs ON public.orgs;
CREATE POLICY student_read_orgs ON public.orgs FOR SELECT USING (current_user_role() = 'student' AND id = current_user_org_id());

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'profiles', 'teachers', 'teacher_pay_rates', 'teacher_leave',
        'subjects', 'teacher_subjects', 'syllabus_templates', 'syllabus_topics',
        'students', 'student_subjects', 'syllabus_progress', 'leads', 'lead_communications',
        'demos', 'class_sessions', 'attendance', 'class_notes', 'homework', 'tests',
        'vouchers', 'voucher_lines', 'payments', 'refunds', 'fee_decisions',
        'payment_accounts', 'notifications', 'announcements', 'announcement_targets',
        'tickets', 'ticket_messages', 'documents', 'referrals', 'ad_spend', 'settings', 'audit_log'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS admin_full_access_%I ON public.%I', t, t);
        EXECUTE format('CREATE POLICY admin_full_access_%I ON public.%I FOR ALL USING (current_user_role() = ''admin'' AND org_id = current_user_org_id())', t, t);
    END LOOP;
END $$;

-- 5.3 RLS Policies: Manager (Operational access MINUS Finance, Pay, Settings, Audit Log)
-- Manager Read/Write allowed on: leads, lead_communications, demos, students, student_subjects, syllabus_progress, class_sessions, attendance, class_notes, homework, tests, announcements, announcement_targets, tickets, ticket_messages, documents, referrals, ad_spend
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'leads', 'lead_communications', 'demos', 'students', 'student_subjects',
        'syllabus_progress', 'class_sessions', 'attendance', 'class_notes',
        'homework', 'tests', 'announcements', 'announcement_targets',
        'tickets', 'ticket_messages', 'documents', 'referrals', 'ad_spend',
        'subjects', 'teacher_subjects', 'syllabus_templates', 'syllabus_topics', 'teacher_leave'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS manager_access_%I ON public.%I', t, t);
        EXECUTE format('CREATE POLICY manager_access_%I ON public.%I FOR ALL USING (current_user_role() = ''manager'' AND org_id = current_user_org_id())', t, t);
    END LOOP;
END $$;

-- Manager READ ONLY on teachers (cannot add/edit teachers, cannot see pay)
CREATE POLICY manager_read_teachers ON public.teachers FOR SELECT USING (current_user_role() = 'manager' AND org_id = current_user_org_id());

-- 5.4 RLS Policies: Teacher (Own Students, Own Schedule, Own Homework/Tests, Read Syllabus)
CREATE POLICY teacher_read_own_students ON public.students FOR SELECT USING (
    current_user_role() = 'teacher' AND id IN (
        SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);

CREATE POLICY teacher_access_own_student_subjects ON public.student_subjects FOR ALL USING (
    current_user_role() = 'teacher' AND teacher_id = current_teacher_id()
);

CREATE POLICY teacher_access_own_syllabus_progress ON public.syllabus_progress FOR ALL USING (
    current_user_role() = 'teacher' AND student_id IN (
        SELECT student_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);

CREATE POLICY teacher_access_own_schedule ON public.class_sessions FOR ALL USING (
    current_user_role() = 'teacher' AND teacher_id = current_teacher_id()
);

CREATE POLICY teacher_access_own_attendance ON public.attendance FOR ALL USING (
    current_user_role() = 'teacher' AND session_id IN (
        SELECT id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);

CREATE POLICY teacher_access_own_class_notes ON public.class_notes FOR ALL USING (
    current_user_role() = 'teacher' AND session_id IN (
        SELECT id FROM public.class_sessions WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);

CREATE POLICY teacher_access_own_homework ON public.homework FOR ALL USING (
    current_user_role() = 'teacher' AND teacher_id = current_teacher_id()
);

CREATE POLICY teacher_access_own_tests ON public.tests FOR ALL USING (
    current_user_role() = 'teacher' AND subject_id IN (
        SELECT subject_id FROM public.student_subjects WHERE teacher_id = current_teacher_id() AND deleted_at IS NULL
    )
);

CREATE POLICY teacher_access_tickets ON public.tickets FOR ALL USING (
    current_user_role() = 'teacher' AND opened_by = auth.uid()
);

CREATE POLICY teacher_access_ticket_messages ON public.ticket_messages FOR ALL USING (
    current_user_role() = 'teacher' AND ticket_id IN (SELECT id FROM public.tickets WHERE opened_by = auth.uid() AND deleted_at IS NULL)
);

-- 5.5 RLS Policies: Student / Parent (Shared Login — Own Record Only)
CREATE POLICY student_read_own_profile ON public.students FOR SELECT USING (
    current_user_role() = 'student' AND id = current_student_id()
);

CREATE POLICY student_read_own_subjects ON public.student_subjects FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_syllabus_progress ON public.syllabus_progress FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_schedule ON public.class_sessions FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_attendance ON public.attendance FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_access_own_homework ON public.homework FOR ALL USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_tests ON public.tests FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_vouchers ON public.vouchers FOR SELECT USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_read_own_voucher_lines ON public.voucher_lines FOR SELECT USING (
    current_user_role() = 'student' AND voucher_id IN (SELECT id FROM public.vouchers WHERE student_id = current_student_id() AND deleted_at IS NULL)
);

CREATE POLICY student_insert_own_payments ON public.payments FOR INSERT WITH CHECK (
    current_user_role() = 'student' AND voucher_id IN (SELECT id FROM public.vouchers WHERE student_id = current_student_id() AND deleted_at IS NULL)
);

CREATE POLICY student_read_own_payments ON public.payments FOR SELECT USING (
    current_user_role() = 'student' AND voucher_id IN (SELECT id FROM public.vouchers WHERE student_id = current_student_id() AND deleted_at IS NULL)
);

CREATE POLICY student_access_own_documents ON public.documents FOR ALL USING (
    current_user_role() = 'student' AND student_id = current_student_id()
);

CREATE POLICY student_access_own_tickets ON public.tickets FOR ALL USING (
    current_user_role() = 'student' AND opened_by = auth.uid()
);

CREATE POLICY student_access_own_ticket_messages ON public.ticket_messages FOR ALL USING (
    current_user_role() = 'student' AND ticket_id IN (SELECT id FROM public.tickets WHERE opened_by = auth.uid() AND deleted_at IS NULL)
);

CREATE POLICY student_read_announcements ON public.announcements FOR SELECT USING (
    current_user_role() = 'student' AND id IN (
        SELECT announcement_id FROM public.announcement_targets 
        WHERE (student_id = current_student_id() OR program = (SELECT program FROM public.students WHERE id = current_student_id())) 
        AND deleted_at IS NULL
    )
);


-- ============================================================================
-- 6. PUBLIC BOOKING SECURITY DEFINER ROUTINES (ANON ACCESS LOCKED)
-- ============================================================================

-- Function 1: Public reading of open time slots (reads no student or existing lead data)
CREATE OR REPLACE FUNCTION public.get_open_slots(p_org_id UUID, p_date DATE)
RETURNS TABLE (slot_start TIMESTAMPTZ, slot_end TIMESTAMPTZ) AS $$
BEGIN
    -- Returns open booking slots between 07:00 and 23:00 PKT for the date
    RETURN QUERY
    SELECT 
        (p_date + (i || ' hours')::interval) AT TIME ZONE 'Asia/Karachi' AS slot_start,
        (p_date + ((i + 1) || ' hours')::interval) AT TIME ZONE 'Asia/Karachi' AS slot_end
    FROM generate_series(7, 22) AS i;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function 2: Public demo creation (creates lead & demo row only; reads nothing back)
CREATE OR REPLACE FUNCTION public.create_public_booking(
    p_org_id UUID,
    p_name TEXT,
    p_parent_name TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_program TEXT,
    p_subjects TEXT,
    p_scheduled_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
    v_lead_id UUID;
BEGIN
    -- Check soft-deleted duplicate phone
    IF EXISTS (SELECT 1 FROM public.leads WHERE org_id = p_org_id AND phone = p_phone AND deleted_at IS NULL) THEN
        RAISE EXCEPTION 'A lead with this phone number already exists.';
    END IF;

    -- Insert Lead
    INSERT INTO public.leads (org_id, name, parent_name, phone, email, program, subjects, source, status, temperature)
    VALUES (p_org_id, p_name, p_parent_name, p_phone, p_email, p_program, p_subjects, 'google', 'new', 'hot')
    RETURNING id INTO v_lead_id;

    -- Insert Demo (teacher_id NULL, status needs_teacher)
    INSERT INTO public.demos (org_id, lead_id, scheduled_at, status)
    VALUES (p_org_id, v_lead_id, p_scheduled_at, 'needs_teacher');

    RETURN v_lead_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant EXECUTE to anon and authenticated on public booking functions
GRANT EXECUTE ON FUNCTION public.get_open_slots(UUID, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

-- Revoke all table privileges from anon role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
