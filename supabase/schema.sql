-- =============================================
-- PALM (Personal AI Life Manager) - Database Schema
-- v2.1 - Complete Schema
-- =============================================

-- 기존 테이블 삭제 (순서 중요: 외래키 의존성)
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Helper Function 삭제
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
DROP FUNCTION IF EXISTS handle_new_user CASCADE;

-- =============================================
-- 1. Users 테이블 (구글 OAuth 전용)
-- Supabase Auth와 연동: auth.users.id를 그대로 사용
-- =============================================
CREATE TABLE users (
  id UUID PRIMARY KEY,                           -- Supabase Auth의 user id
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 서비스 역할을 통한 전체 접근 허용 (백엔드 Service Key 사용)
CREATE POLICY "Service role can manage users" ON users
  FOR ALL USING (true);

-- =============================================
-- 2. Categories 테이블 (사용자 정의 카테고리)
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
-- 3. Goals 테이블 (장기 목표)
-- =============================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
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
-- 4. Events 테이블 (일정)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_user_date ON events(user_id, event_date);
CREATE INDEX idx_events_category_id ON events(category_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage events" ON events
  FOR ALL USING (true);

-- =============================================
-- 5. Todos 테이블 (할 일)
-- =============================================
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  due_date DATE,
  due_time TIME,
  priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_goal_id ON todos(goal_id);
CREATE INDEX idx_todos_is_completed ON todos(is_completed);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage todos" ON todos
  FOR ALL USING (true);

-- =============================================
-- 6. Conversations 테이블 (AI 대화 세션)
-- =============================================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_updated_at ON conversations(updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage conversations" ON conversations
  FOR ALL USING (true);

-- =============================================
-- 7. Messages 테이블 (대화 메시지)
-- =============================================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  pending_events JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages" ON messages
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

-- =============================================
-- 구글 로그인 시 자동 유저 생성 트리거 (선택)
-- Supabase Auth에서 새 유저 생성 시 자동으로 users 테이블에 추가
-- =============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, nickname, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    last_login_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supabase Auth 트리거 (auth.users에 새 유저 생성 시 실행)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 초기 데이터 (테스트용, 필요시 주석 해제)
-- =============================================
-- INSERT INTO categories (user_id, name, color, is_default)
-- VALUES ('your-user-uuid', '기본', '#9CA3AF', true);
