-- =============================================================================
-- Portal UDFV — Schema SQL Migration
-- Supabase Self-Hosted (supabase.udfv.cloud)
-- Created: 2026-03-06
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS portal;

-- ---------------------------------------------------------------------------
-- PROGRAMS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.programs (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR UNIQUE NOT NULL,
    type            VARCHAR NOT NULL CHECK (type IN ('diplomado', 'curso_abierto', 'ruta_formativa', 'postitulo', 'certificacion')),
    title           VARCHAR NOT NULL,
    description     TEXT,
    objectives      JSONB,
    curriculum      JSONB,
    duration_hours  INT,
    modality        VARCHAR,
    moodle_url      TEXT,
    stats           JSONB,
    tags            TEXT[],
    level           VARCHAR,
    featured        BOOLEAN DEFAULT false,
    status          VARCHAR DEFAULT 'active',
    image_url       TEXT,
    source          VARCHAR,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- COURSES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.courses (
    id                  SERIAL PRIMARY KEY,
    slug                VARCHAR UNIQUE NOT NULL,
    program_id          INT REFERENCES portal.programs(id),
    title               VARCHAR NOT NULL,
    category            VARCHAR,
    duration_hours      INT,
    description         TEXT,
    moodle_course_id    INT,
    moodle_platform     VARCHAR,
    enrollment_status   VARCHAR DEFAULT 'active',
    start_date          DATE,
    end_date            DATE,
    enrolled_count      INT DEFAULT 0,
    tags                TEXT[],
    level               VARCHAR,
    source              VARCHAR,
    image_url           TEXT,
    created_at          TIMESTAMPTZ DEFAULT now(),
    updated_at          TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- TEAM MEMBERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.team_members (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR UNIQUE NOT NULL,
    name            VARCHAR NOT NULL,
    role            VARCHAR,
    subunit         VARCHAR,
    bio             TEXT,
    email           VARCHAR,
    photo_url       TEXT,
    display_order   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- PROGRAM — TEAM (join table)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.program_team (
    program_id      INT REFERENCES portal.programs(id),
    member_id       INT REFERENCES portal.team_members(id),
    role_in_program VARCHAR,
    PRIMARY KEY (program_id, member_id)
);

-- ---------------------------------------------------------------------------
-- TESTIMONIALS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.testimonials (
    id          SERIAL PRIMARY KEY,
    author_name VARCHAR NOT NULL,
    author_role VARCHAR,
    content     TEXT NOT NULL,
    program_id  INT REFERENCES portal.programs(id),
    rating      INT CHECK (rating BETWEEN 1 AND 5),
    photo_url   TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- NEWS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.news (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR UNIQUE NOT NULL,
    title       VARCHAR NOT NULL,
    excerpt     TEXT,
    content     TEXT,
    category    VARCHAR,
    image_url   TEXT,
    source      VARCHAR DEFAULT 'manual',
    source_url  TEXT,
    published_at TIMESTAMPTZ DEFAULT now(),
    featured    BOOLEAN DEFAULT false,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- RESOURCES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.resources (
    id              SERIAL PRIMARY KEY,
    slug            VARCHAR UNIQUE NOT NULL,
    title           VARCHAR NOT NULL,
    type            VARCHAR,
    category        VARCHAR,
    url             TEXT,
    embed_code      TEXT,
    thumbnail_url   TEXT,
    description     TEXT,
    display_order   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CHAT SESSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.chat_sessions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    session_token   VARCHAR UNIQUE NOT NULL,
    user_email      VARCHAR,
    message_count   INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- CHAT MESSAGES
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.chat_messages (
    id          SERIAL PRIMARY KEY,
    session_id  UUID REFERENCES portal.chat_sessions(id),
    role        VARCHAR NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- SYNC LOG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.sync_log (
    id              SERIAL PRIMARY KEY,
    source          VARCHAR NOT NULL,
    sync_type       VARCHAR,
    items_found     INT DEFAULT 0,
    items_created   INT DEFAULT 0,
    items_updated   INT DEFAULT 0,
    status          VARCHAR,
    error_message   TEXT,
    started_at      TIMESTAMPTZ DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- ADMIN ACTIONS (audit log + approval queue)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.admin_actions (
    id              SERIAL PRIMARY KEY,
    user_email      VARCHAR NOT NULL,
    user_role       VARCHAR NOT NULL,
    action_type     VARCHAR NOT NULL,
    target_table    VARCHAR NOT NULL,
    target_id       INT,
    data_before     JSONB,
    data_after      JSONB,
    status          VARCHAR NOT NULL DEFAULT 'executed',
    reviewed_by     VARCHAR,
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- Soft-delete support for news
ALTER TABLE portal.news ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'published';
UPDATE portal.news SET status = 'published' WHERE status IS NULL;

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_programs_type    ON portal.programs (type);
CREATE INDEX IF NOT EXISTS idx_programs_status  ON portal.programs (status);
CREATE INDEX IF NOT EXISTS idx_programs_featured ON portal.programs (featured);
CREATE INDEX IF NOT EXISTS idx_courses_program  ON portal.courses (program_id);
CREATE INDEX IF NOT EXISTS idx_courses_platform ON portal.courses (moodle_platform);
CREATE INDEX IF NOT EXISTS idx_news_published   ON portal.news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_featured    ON portal.news (featured);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON portal.chat_messages (session_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_status ON portal.admin_actions (status);
CREATE INDEX IF NOT EXISTS idx_news_status ON portal.news (status);

-- ---------------------------------------------------------------------------
-- POSTGREST PERMISSIONS
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA portal TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA portal TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA portal TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA portal TO service_role;

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

-- programs
ALTER TABLE portal.programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read programs"   ON portal.programs FOR SELECT USING (true);
CREATE POLICY "Service write programs" ON portal.programs FOR ALL USING (current_setting('role') = 'service_role');

-- courses
ALTER TABLE portal.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read courses"   ON portal.courses FOR SELECT USING (true);
CREATE POLICY "Service write courses" ON portal.courses FOR ALL USING (current_setting('role') = 'service_role');

-- team_members
ALTER TABLE portal.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read team"   ON portal.team_members FOR SELECT USING (true);
CREATE POLICY "Service write team" ON portal.team_members FOR ALL USING (current_setting('role') = 'service_role');

-- program_team
ALTER TABLE portal.program_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read program_team"   ON portal.program_team FOR SELECT USING (true);
CREATE POLICY "Service write program_team" ON portal.program_team FOR ALL USING (current_setting('role') = 'service_role');

-- testimonials
ALTER TABLE portal.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read testimonials"   ON portal.testimonials FOR SELECT USING (true);
CREATE POLICY "Service write testimonials" ON portal.testimonials FOR ALL USING (current_setting('role') = 'service_role');

-- news
ALTER TABLE portal.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read news"   ON portal.news FOR SELECT USING (true);
CREATE POLICY "Service write news" ON portal.news FOR ALL USING (current_setting('role') = 'service_role');

-- resources
ALTER TABLE portal.resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read resources"   ON portal.resources FOR SELECT USING (true);
CREATE POLICY "Service write resources" ON portal.resources FOR ALL USING (current_setting('role') = 'service_role');

-- chat_sessions: users read their own, service_role writes
ALTER TABLE portal.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read own sessions" ON portal.chat_sessions FOR SELECT USING (true);
CREATE POLICY "Service write sessions"          ON portal.chat_sessions FOR ALL USING (current_setting('role') = 'service_role');

-- chat_messages: same pattern
ALTER TABLE portal.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read messages" ON portal.chat_messages FOR SELECT USING (true);
CREATE POLICY "Service write messages"      ON portal.chat_messages FOR ALL USING (current_setting('role') = 'service_role');

-- sync_log: internal only
ALTER TABLE portal.sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only sync_log" ON portal.sync_log FOR ALL USING (current_setting('role') = 'service_role');

-- admin_actions: internal only
ALTER TABLE portal.admin_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service only admin_actions" ON portal.admin_actions FOR ALL USING (current_setting('role') = 'service_role');
