-- =============================================
-- PALM (Personal AI Life Manager) - Database Schema
-- v3.1 - Human-Centric Life Secretary
-- =============================================

-- 기존 테이블 삭제 (순서 중요: 외래키 의존성)
DROP TABLE IF EXISTS group_invitations CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS life_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS todos CASCADE;
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
  location VARCHAR(100),                         -- 날씨 API용 도시명 (예: "Seoul")
  chronotype VARCHAR(20) DEFAULT 'morning'       -- 집중 시간대
    CHECK (chronotype IN ('early_morning', 'morning', 'afternoon', 'evening', 'night')),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chronotype 정의:
-- early_morning: 05:00 - 09:00 (새벽형)
-- morning: 09:00 - 12:00 (오전 집중형)
-- afternoon: 12:00 - 17:00 (오후 집중형)
-- evening: 17:00 - 21:00 (저녁 집중형)
-- night: 21:00 - 02:00 (야행성)

CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

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
-- 3. Goals 테이블 (Deadline 기반 목표)
-- =============================================
CREATE TABLE goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_date DATE NOT NULL,                     -- 마감일 (필수)
  priority VARCHAR(10) DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  status VARCHAR(20) DEFAULT 'planning'          -- 목표 상태
    CHECK (status IN ('planning', 'scheduled', 'in_progress', 'completed', 'failed')),
  total_estimated_time INT DEFAULT 0,            -- 총 예상 시간 (분)
  completed_time INT DEFAULT 0,                  -- 완료된 시간 (분)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status 정의:
-- planning: Todo 분해 중 (계획 미완성)
-- scheduled: Event까지 배치 완료
-- in_progress: 진행 중 (하나 이상 완료)
-- completed: 100% 달성
-- failed: 마감 초과 미완료

CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_goals_target_date ON goals(target_date);
CREATE INDEX idx_goals_status ON goals(status);

ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage goals" ON goals
  FOR ALL USING (true);

-- =============================================
-- 4. Todos 테이블 (할 일 - 부분 완료 추적)
-- =============================================
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- 마감 관련
  deadline TIMESTAMPTZ,                          -- 마감 시각
  is_hard_deadline BOOLEAN DEFAULT false,        -- true면 절대 밀릴 수 없음

  -- 시간 관련
  estimated_time INT,                            -- 예상 시간 (분)
  completed_time INT DEFAULT 0,                  -- 완료된 시간 (분)
  is_divisible BOOLEAN DEFAULT true,             -- 분할 가능 여부

  -- 상태
  priority VARCHAR(10) DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- 반복 (기존 호환)
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(20),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_deadline ON todos(deadline);
CREATE INDEX idx_todos_goal_id ON todos(goal_id);
CREATE INDEX idx_todos_is_completed ON todos(is_completed);

ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage todos" ON todos
  FOR ALL USING (true);

-- =============================================
-- 5. Events 테이블 (일정 - Fixed/Flexible 구분)
-- =============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  related_todo_id UUID REFERENCES todos(id) ON DELETE SET NULL,  -- 연결된 Todo
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_all_day BOOLEAN DEFAULT false,
  location TEXT,

  -- 유동성 관련
  is_fixed BOOLEAN DEFAULT true,                 -- true: 고정, false: 유동
  priority INTEGER DEFAULT 3                     -- 1~5 (1:낮음, 5:절대)
    CHECK (priority >= 1 AND priority <= 5),

  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Priority 정의:
-- 1: 낮음 (언제든 이동/취소 가능) - 청소, 넷플릭스
-- 2: 보통-낮음 (가능하면 유지) - 개인 운동
-- 3: 보통 (기본값) - 일반 약속
-- 4: 높음 (웬만하면 변경 불가) - 중요 미팅
-- 5: 절대 (절대 변경 불가) - 시험, 면접

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_user_date ON events(user_id, event_date);
CREATE INDEX idx_events_category_id ON events(category_id);
CREATE INDEX idx_events_related_todo_id ON events(related_todo_id);
CREATE INDEX idx_events_is_fixed ON events(is_fixed);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage events" ON events
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
  mcp_data JSONB,                -- MCP 데이터 (상품 추천, 장소 추천 등) - "행동하는 AI" 결과
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage messages" ON messages
  FOR ALL USING (true);

-- =============================================
-- 8. Life Logs 테이블 (AI 일기)
-- =============================================
CREATE TABLE life_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  summary TEXT,                                  -- 한 줄 요약
  content TEXT NOT NULL,                         -- AI 작성 일기 본문
  mood VARCHAR(10),                              -- 이모지 (😊, 😐, 😢 등)
  tags TEXT[],                                   -- 태그 배열 ['운동', '공부', '약속']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, log_date)                      -- 사용자별 하루 하나
);

CREATE INDEX idx_life_logs_user_id ON life_logs(user_id);
CREATE INDEX idx_life_logs_log_date ON life_logs(log_date);

ALTER TABLE life_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage life_logs" ON life_logs
  FOR ALL USING (true);

-- =============================================
-- 9. Groups 테이블 (그룹)
-- =============================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_created_by ON groups(created_by);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage groups" ON groups
  FOR ALL USING (true);

-- =============================================
-- 10. Group Members 테이블 (그룹 멤버)
-- =============================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member'
    CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)                      -- 중복 가입 방지
);

CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);

ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage group_members" ON group_members
  FOR ALL USING (true);

-- =============================================
-- 11. Group Invitations 테이블 (그룹 초대)
-- =============================================
CREATE TABLE group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id),
  invitee_email VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_group_invitations_group_id ON group_invitations(group_id);
CREATE INDEX idx_group_invitations_invitee_email ON group_invitations(invitee_email);
CREATE INDEX idx_group_invitations_status ON group_invitations(status);

ALTER TABLE group_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage group_invitations" ON group_invitations
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

CREATE TRIGGER update_life_logs_updated_at
  BEFORE UPDATE ON life_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 구글 로그인 시 자동 유저 생성 트리거
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
