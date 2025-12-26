-- AI 캘린더 데이터베이스 스키마
-- Supabase에서 실행

-- 1. 사용자 테이블 (회원가입/로그인 지원)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE NOT NULL,  -- 전화번호 (로그인 ID)
    password_hash VARCHAR(255) NOT NULL,  -- 비밀번호 해시
    name VARCHAR(50) NOT NULL,  -- 실명
    nickname VARCHAR(50) NOT NULL,  -- 닉네임
    is_active BOOLEAN DEFAULT TRUE,  -- 계정 활성화 상태
    last_login_at TIMESTAMP WITH TIME ZONE,  -- 마지막 로그인
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 전화번호 인덱스
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 2. 목표 테이블
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50) NOT NULL,  -- 'weight', 'exercise', 'diet', 'sleep'
    target_description TEXT NOT NULL,
    duration_weeks INTEGER NOT NULL DEFAULT 12,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'active',  -- 'active', 'completed', 'paused', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 플랜 테이블 (AI가 생성한 주간/월간 플랜)
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    plan_type VARCHAR(20) NOT NULL,  -- 'exercise', 'diet', 'sleep'
    plan_content JSONB NOT NULL,  -- 상세 플랜 내용 (JSON)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 미션 테이블 (일일 미션)
CREATE TABLE IF NOT EXISTS missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    mission_date DATE NOT NULL,
    mission_type VARCHAR(20) NOT NULL,  -- 'exercise', 'diet', 'sleep'
    title VARCHAR(200) NOT NULL,
    description TEXT,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. 미션 체크 로그 테이블 (체크/언체크 기록)
CREATE TABLE IF NOT EXISTS mission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,  -- 'check', 'uncheck'
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 대화 기록 테이블
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    agent_type VARCHAR(20),  -- 'orchestrator', 'pt', 'diet', 'sleep', 'watcher'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 감시자 개입 기록 테이블
CREATE TABLE IF NOT EXISTS watcher_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    intervention_type VARCHAR(50) NOT NULL,  -- 'onboarding_stuck', 'plan_dissatisfaction', 'execution_dropout'
    intervention_message TEXT,
    user_response VARCHAR(100),  -- 사용자가 선택한 옵션
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. 주간 리뷰 테이블
CREATE TABLE IF NOT EXISTS weekly_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES goals(id) ON DELETE CASCADE,
    week_number INTEGER NOT NULL,
    week_start_date DATE NOT NULL,
    week_end_date DATE NOT NULL,
    exercise_completion_rate DECIMAL(5,2),
    diet_completion_rate DECIMAL(5,2),
    sleep_completion_rate DECIMAL(5,2),
    overall_completion_rate DECIMAL(5,2),
    ai_feedback TEXT,
    user_reflection TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. 개인 일정 테이블 (사용자의 실제 일정)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,  -- 시작 시간 (NULL이면 종일 일정)
    end_time TIME,    -- 종료 시간
    is_all_day BOOLEAN DEFAULT FALSE,  -- 종일 일정 여부
    category VARCHAR(50) DEFAULT 'personal',  -- 'work', 'personal', 'social', 'health', 'other'
    priority VARCHAR(20) DEFAULT 'normal',  -- 'high', 'normal', 'low'
    location VARCHAR(200),  -- 장소
    is_recurring BOOLEAN DEFAULT FALSE,  -- 반복 일정 여부
    recurrence_rule VARCHAR(100),  -- 반복 규칙 (예: 'weekly', 'monthly')
    reminder_minutes INTEGER,  -- 알림 (분 단위, 예: 30 = 30분 전)
    color VARCHAR(20) DEFAULT '#3788d8',  -- 캘린더 표시 색상
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. AI 일정 조율 로그 테이블
CREATE TABLE IF NOT EXISTS schedule_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    adjustment_date DATE NOT NULL,
    original_plan JSONB,  -- 원래 계획 (운동/식단/수면)
    adjusted_plan JSONB,  -- 조정된 계획
    reason TEXT,  -- 조정 이유
    ai_suggestion TEXT,  -- AI 제안 내용
    user_approved BOOLEAN DEFAULT FALSE,  -- 사용자 승인 여부
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_goal_id ON plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_missions_user_id ON missions(user_id);
CREATE INDEX IF NOT EXISTS idx_missions_date ON missions(mission_date);
CREATE INDEX IF NOT EXISTS idx_missions_completed ON missions(completed);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id ON weekly_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_schedule_adjustments_user_id ON schedule_adjustments(user_id);

-- RLS (Row Level Security) 정책 (선택사항)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
