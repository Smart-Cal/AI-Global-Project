-- 기존 DB에 events 및 schedule_adjustments 테이블 추가 (마이그레이션)

-- 1. 개인 일정 테이블 생성
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'personal',
    priority VARCHAR(20) DEFAULT 'normal',
    location VARCHAR(200),
    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule VARCHAR(100),
    reminder_minutes INTEGER,
    color VARCHAR(20) DEFAULT '#3788d8',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. AI 일정 조율 로그 테이블 생성
CREATE TABLE IF NOT EXISTS schedule_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    adjustment_date DATE NOT NULL,
    original_plan JSONB,
    adjusted_plan JSONB,
    reason TEXT,
    ai_suggestion TEXT,
    user_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_user_date ON events(user_id, event_date);
CREATE INDEX IF NOT EXISTS idx_schedule_adjustments_user_id ON schedule_adjustments(user_id);
