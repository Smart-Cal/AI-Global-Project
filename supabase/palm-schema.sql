-- =============================================
-- PALM (Personal AI Life Manager) - Database Schema
-- v1.0 - PALM 아키텍처 기준
-- =============================================

-- 기존 테이블 삭제 (순서 중요: 외래키 의존성)
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- =============================================
-- 1. Users 테이블 (PALM 스펙)
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their data" ON users
  FOR ALL USING (true);

-- =============================================
-- 2. Categories 테이블
-- =============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#9CA3AF',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_user_id ON categories(user_id);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage categories" ON categories
  FOR ALL USING (true);

-- =============================================
-- 3. Events 테이블 (PALM 스펙 - datetime + duration)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  datetime TIMESTAMPTZ NOT NULL,           -- 일정 시작 시간
  duration INTEGER DEFAULT 60,              -- 소요 시간 (분)
  type VARCHAR(20) DEFAULT 'personal',      -- 'fixed' | 'personal' | 'goal'
  location TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_datetime ON events(datetime);
CREATE INDEX idx_events_user_datetime ON events(user_id, datetime);
CREATE INDEX idx_events_category_id ON events(category_id);
CREATE INDEX idx_events_type ON events(type);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage events" ON events
  FOR ALL USING (true);

-- =============================================
-- 4. Todos 테이블 (PALM 스펙 - event_id + timing + scheduled_at)
-- =============================================
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,  -- 연결된 Event
  title VARCHAR(255) NOT NULL,
  description TEXT,
  timing VARCHAR(10) DEFAULT 'before',     -- 'before' | 'during' | 'after'
  deadline TIMESTAMPTZ,                     -- 마감 시간
  scheduled_at TIMESTAMPTZ,                 -- AI가 배치한 시간
  duration INTEGER DEFAULT 30,              -- 예상 소요 시간 (분)
  priority VARCHAR(10) DEFAULT 'medium',    -- 'high' | 'medium' | 'low'
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_event_id ON todos(event_id);
CREATE INDEX idx_todos_deadline ON todos(deadline);
CREATE INDEX idx_todos_scheduled_at ON todos(scheduled_at);
CREATE INDEX idx_todos_priority ON todos(priority);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage todos" ON todos
  FOR ALL USING (true);

-- =============================================
-- 5. Goals 테이블 (유지, 확장)
-- =============================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE,
  priority VARCHAR(10) DEFAULT 'medium',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_target_date ON goals(target_date);
CREATE INDEX idx_goals_is_active ON goals(is_active);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage goals" ON goals
  FOR ALL USING (true);

-- =============================================
-- 6. Conversation History 테이블 (AI 대화 컨텍스트 저장용)
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]',              -- 대화 내역 (ChatMessage[])
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conversations" ON conversations
  FOR ALL USING (true);

-- =============================================
-- Helper Functions
-- =============================================

-- 자동 updated_at 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
