-- 기존 users 테이블에 인증 필드 추가 (마이그레이션)
-- 이미 테이블이 있는 경우 이 스크립트 실행

-- 1. 새 필드 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. 전화번호 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

-- 3. 기존 데이터 업데이트 (nickname을 name으로 복사)
UPDATE users SET name = nickname WHERE name IS NULL;

-- 참고: 새로 시작하는 경우 schema.sql을 사용하세요
