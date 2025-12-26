-- 초기 테스트 데이터 삽입

-- 테스트 사용자
INSERT INTO users (id, nickname) VALUES
    ('11111111-1111-1111-1111-111111111111', '테스트유저');

-- 테스트 목표
INSERT INTO goals (id, user_id, goal_type, target_description, duration_weeks, start_date) VALUES
    ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
     'weight', '3개월 안에 10kg 감량하기', 12, CURRENT_DATE);

-- 테스트 플랜 (1주차)
INSERT INTO plans (id, user_id, goal_id, week_number, plan_type, plan_content) VALUES
    ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
     '22222222-2222-2222-2222-222222222222', 1, 'exercise',
     '{"days": [
        {"day": "월", "workout": "유산소 30분 (걷기/조깅)", "intensity": "low"},
        {"day": "화", "workout": "근력운동 - 상체", "intensity": "medium"},
        {"day": "수", "workout": "휴식 또는 스트레칭", "intensity": "low"},
        {"day": "목", "workout": "유산소 30분", "intensity": "medium"},
        {"day": "금", "workout": "근력운동 - 하체", "intensity": "medium"},
        {"day": "토", "workout": "자유 운동 또는 산책", "intensity": "low"},
        {"day": "일", "workout": "완전 휴식", "intensity": "rest"}
     ]}'::jsonb);

-- 테스트 미션 (오늘)
INSERT INTO missions (id, user_id, plan_id, mission_date, mission_type, title, description) VALUES
    ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333', CURRENT_DATE, 'exercise',
     '유산소 운동 30분', '걷기 또는 조깅으로 30분 운동하기'),
    ('55555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333', CURRENT_DATE, 'diet',
     '물 2L 마시기', '하루 동안 물 2리터 마시기'),
    ('66666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111',
     '33333333-3333-3333-3333-333333333333', CURRENT_DATE, 'sleep',
     '11시 전 취침', '밤 11시 전에 잠자리에 들기');
