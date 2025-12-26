"""
4단계: 일일 미션
- 오늘의 미션 목록
- 미션 체크 기능
- 진행률 표시
"""
import streamlit as st
from datetime import date, datetime
import os
import sys

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.session import init_session_state
from utils.datetime_utils import format_date_korean, get_weekday_korean
from utils.formatters import format_mission_type, get_progress_emoji
from database.connection import is_connected
from database.queries import get_today_missions, update_mission_status, save_mission

# 세션 초기화
init_session_state()

st.set_page_config(
    page_title="일일 미션 - AI 캘린더",
    page_icon="✅",
    layout="wide"
)

st.title("✅ 오늘의 미션")

# 로그인 체크
if not st.session_state.get('logged_in'):
    st.warning("로그인이 필요합니다.")
    if st.button("🔐 로그인하러 가기", type="primary"):
        st.switch_page("main.py")
    st.stop()

# 목표/플랜 확인
if not st.session_state.get('goal_saved'):
    st.warning("⚠️ 먼저 목표를 설정해주세요!")
    if st.button("🎯 목표 설정하러 가기"):
        st.switch_page("pages/1_🎯_onboarding.py")
    st.stop()

if not st.session_state.get('plan'):
    st.warning("⚠️ 먼저 플랜을 생성해주세요!")
    if st.button("📋 플랜 생성하러 가기"):
        st.switch_page("pages/2_📋_plan.py")
    st.stop()

# 오늘 날짜 표시
today = date.today()
weekday = get_weekday_korean(today)
st.markdown(f"### 📆 {format_date_korean(today)}")

nickname = st.session_state.get('nickname', '사용자')
st.markdown(f"**{nickname}**님, 오늘도 화이팅! 💪")

st.markdown("---")

# 플랜에서 오늘의 미션 생성
plan = st.session_state.get('plan', {})
exercise_plan = plan.get('exercise', {})
diet_plan = plan.get('diet', {})
sleep_plan = plan.get('sleep', {})

# 오늘의 미션 목록 (세션에 저장)
if 'today_missions' not in st.session_state or st.session_state.get('missions_date') != today.isoformat():
    missions = []

    # 운동 미션
    if isinstance(exercise_plan, dict):
        for day_plan in exercise_plan.get('weekly_plan', []):
            if isinstance(day_plan, dict) and day_plan.get('day') == weekday:
                workout = day_plan.get('workout', '')
                if workout and workout != '완전 휴식':
                    missions.append({
                        'id': f'exercise_{today.isoformat()}',
                        'type': 'exercise',
                        'title': workout,
                        'description': f"소요 시간: {day_plan.get('duration', '30분')}",
                        'completed': False
                    })

    # 식단 미션들
    if isinstance(diet_plan, dict):
        daily_plan = diet_plan.get('daily_plan', {})
        if daily_plan:
            missions.append({
                'id': f'diet_breakfast_{today.isoformat()}',
                'type': 'diet',
                'title': '아침 식사 챙기기',
                'description': daily_plan.get('breakfast', '건강한 아침'),
                'completed': False
            })
            missions.append({
                'id': f'diet_water_{today.isoformat()}',
                'type': 'diet',
                'title': '물 2L 마시기',
                'description': diet_plan.get('hydration', '하루 2L 이상'),
                'completed': False
            })

    # 수면 미션
    if isinstance(sleep_plan, dict):
        sleep_schedule = sleep_plan.get('sleep_schedule', {})
        if sleep_schedule:
            missions.append({
                'id': f'sleep_{today.isoformat()}',
                'type': 'sleep',
                'title': f"{sleep_schedule.get('target_bedtime', '23:00')} 전 취침",
                'description': f"목표 수면시간: {sleep_schedule.get('sleep_duration', '8시간')}",
                'completed': False
            })

    st.session_state.today_missions = missions
    st.session_state.missions_date = today.isoformat()

missions = st.session_state.today_missions

# 미션 완료 상태 계산
total_missions = len(missions)
completed_missions = sum(1 for m in missions if m.get('completed', False))
completion_rate = (completed_missions / total_missions * 100) if total_missions > 0 else 0

# 진행률 표시
col1, col2, col3 = st.columns([2, 1, 1])
with col1:
    st.progress(completion_rate / 100)
with col2:
    st.metric("완료", f"{completed_missions}/{total_missions}")
with col3:
    emoji = get_progress_emoji(completion_rate)
    st.metric("달성률", f"{completion_rate:.0f}% {emoji}")

st.markdown("---")

# 미션 카테고리별 표시
mission_types = {
    'exercise': {'icon': '🏋️', 'label': '운동', 'color': '#FF6B6B'},
    'diet': {'icon': '🥗', 'label': '식단', 'color': '#4ECDC4'},
    'sleep': {'icon': '😴', 'label': '수면', 'color': '#9B59B6'}
}


def render_mission_card(mission: dict, index: int):
    """미션 카드 렌더링"""
    mission_type = mission.get('type', 'exercise')
    type_info = mission_types.get(mission_type, mission_types['exercise'])

    col1, col2 = st.columns([0.1, 0.9])

    with col1:
        # 체크박스
        completed = st.checkbox(
            "",
            value=mission.get('completed', False),
            key=f"mission_check_{index}"
        )

        # 상태 업데이트
        if completed != mission.get('completed', False):
            st.session_state.today_missions[index]['completed'] = completed
            st.rerun()

    with col2:
        title = mission.get('title', '')
        description = mission.get('description', '')

        if completed:
            st.markdown(f"~~{type_info['icon']} **{title}**~~")
            st.caption(f"~~{description}~~ ✅ 완료!")
        else:
            st.markdown(f"{type_info['icon']} **{title}**")
            st.caption(description)

    st.markdown("")


# 운동 미션
exercise_missions = [m for m in missions if m.get('type') == 'exercise']
if exercise_missions:
    st.markdown("### 🏋️ 운동")
    for i, mission in enumerate(exercise_missions):
        original_index = missions.index(mission)
        render_mission_card(mission, original_index)
    st.markdown("---")

# 식단 미션
diet_missions = [m for m in missions if m.get('type') == 'diet']
if diet_missions:
    st.markdown("### 🥗 식단")
    for i, mission in enumerate(diet_missions):
        original_index = missions.index(mission)
        render_mission_card(mission, original_index)
    st.markdown("---")

# 수면 미션
sleep_missions = [m for m in missions if m.get('type') == 'sleep']
if sleep_missions:
    st.markdown("### 😴 수면")
    for i, mission in enumerate(sleep_missions):
        original_index = missions.index(mission)
        render_mission_card(mission, original_index)

# 모든 미션 완료 시
if completion_rate == 100:
    st.balloons()
    st.success("🎉 오늘의 미션을 모두 완료했어요! 대단해요!")

    # 격려 메시지
    st.markdown("""
    ---
    ### 🌟 오늘의 성취

    오늘 하루도 목표를 향해 한 걸음 나아갔어요!
    꾸준함이 가장 중요합니다. 내일도 화이팅! 💪
    """)

# 미션 추가 (선택사항)
with st.expander("➕ 커스텀 미션 추가"):
    col1, col2 = st.columns([2, 1])

    with col1:
        new_mission_title = st.text_input("미션 이름", placeholder="예: 계단 오르기")
    with col2:
        new_mission_type = st.selectbox(
            "카테고리",
            ['exercise', 'diet', 'sleep'],
            format_func=lambda x: mission_types[x]['label']
        )

    if st.button("미션 추가") and new_mission_title:
        new_mission = {
            'id': f'custom_{datetime.now().timestamp()}',
            'type': new_mission_type,
            'title': new_mission_title,
            'description': '커스텀 미션',
            'completed': False
        }
        st.session_state.today_missions.append(new_mission)
        st.success(f"✅ '{new_mission_title}' 미션이 추가되었습니다!")
        st.rerun()

# 빠른 네비게이션
st.markdown("---")
col1, col2, col3 = st.columns(3)

with col1:
    if st.button("📅 캘린더 보기", use_container_width=True):
        st.switch_page("pages/3_📅_calendar.py")

with col2:
    if st.button("📊 주간 리뷰", use_container_width=True):
        st.switch_page("pages/5_📊_review.py")

with col3:
    if st.button("📋 플랜 수정", use_container_width=True):
        st.switch_page("pages/2_📋_plan.py")

# 사이드바: 팁
with st.sidebar:
    st.markdown("### 💡 오늘의 팁")

    # 플랜에서 팁 추출
    tips = []
    if isinstance(exercise_plan, dict):
        tips.extend(exercise_plan.get('tips', []))
    if isinstance(diet_plan, dict):
        tips.extend(diet_plan.get('nutrition_tips', []))
    if isinstance(sleep_plan, dict):
        tips.extend(sleep_plan.get('sleep_tips', []))

    if tips:
        for tip in tips[:5]:
            st.markdown(f"- {tip}")
    else:
        st.markdown("""
        - 물을 자주 마시세요
        - 스트레칭을 잊지 마세요
        - 충분히 휴식하세요
        """)

    st.markdown("---")

    st.markdown("### 📊 오늘의 통계")
    st.markdown(f"- 총 미션: {total_missions}개")
    st.markdown(f"- 완료: {completed_missions}개")
    st.markdown(f"- 남음: {total_missions - completed_missions}개")

    # 동기부여 메시지
    if completion_rate < 30:
        st.info("🚀 시작이 반이에요! 하나씩 해봐요!")
    elif completion_rate < 70:
        st.info("👍 잘하고 있어요! 조금만 더!")
    elif completion_rate < 100:
        st.info("🔥 거의 다 왔어요! 마무리 화이팅!")
    else:
        st.success("🎉 완벽해요! 오늘도 성공!")
