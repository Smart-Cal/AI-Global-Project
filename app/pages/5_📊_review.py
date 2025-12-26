"""
5단계: 주간 리뷰
- 주간 완료율 통계
- 카테고리별 분석
- AI 피드백
"""
import streamlit as st
from datetime import date, timedelta
import os
import sys

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.session import init_session_state
from utils.datetime_utils import (
    get_current_week_dates,
    format_date_korean,
    get_week_number
)
from utils.formatters import format_completion_rate, get_progress_emoji
from agents.orchestrator import get_orchestrator

# 세션 초기화
init_session_state()

st.set_page_config(
    page_title="주간 리뷰 - AI 캘린더",
    page_icon="📊",
    layout="wide"
)

st.title("📊 주간 리뷰")

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

# 주간 정보
goal = st.session_state.get('goal', {})
week_start, week_end = get_current_week_dates()
goal_start_date = date.today() - timedelta(days=7)  # 가상의 시작일
current_week = get_week_number(goal_start_date)
total_weeks = goal.get('duration_weeks', 12)

nickname = st.session_state.get('nickname', '사용자')

st.markdown(f"### 📆 {format_date_korean(week_start)} ~ {format_date_korean(week_end)}")
st.markdown(f"**{nickname}**님의 {current_week}주차 리뷰입니다")

st.markdown("---")

# 주간 통계 (데모 데이터)
# 실제로는 DB에서 가져와야 함
weekly_stats = st.session_state.get('weekly_stats', {
    'exercise': {'completed': 5, 'total': 7, 'rate': 71.4},
    'diet': {'completed': 12, 'total': 14, 'rate': 85.7},
    'sleep': {'completed': 6, 'total': 7, 'rate': 85.7},
    'overall': {'completed': 23, 'total': 28, 'rate': 82.1}
})

# 전체 진행률
st.markdown("### 📈 이번 주 전체 달성률")
overall_rate = weekly_stats['overall']['rate']
emoji = get_progress_emoji(overall_rate)

col1, col2, col3 = st.columns([3, 1, 1])
with col1:
    st.progress(overall_rate / 100)
with col2:
    st.metric(
        "달성률",
        f"{overall_rate:.1f}%",
        f"{emoji}"
    )
with col3:
    st.metric(
        "완료/전체",
        f"{weekly_stats['overall']['completed']}/{weekly_stats['overall']['total']}"
    )

st.markdown("---")

# 카테고리별 분석
st.markdown("### 📋 카테고리별 분석")

col1, col2, col3 = st.columns(3)

with col1:
    st.markdown("#### 🏋️ 운동")
    exercise_rate = weekly_stats['exercise']['rate']
    st.progress(exercise_rate / 100)
    st.metric(
        "달성률",
        f"{exercise_rate:.1f}%",
        f"{weekly_stats['exercise']['completed']}/{weekly_stats['exercise']['total']} 완료"
    )

    if exercise_rate >= 80:
        st.success("훌륭해요! 운동 습관이 잘 형성되고 있어요!")
    elif exercise_rate >= 50:
        st.info("좋아요! 조금만 더 노력해봐요!")
    else:
        st.warning("운동 시간을 조금씩 늘려봐요!")

with col2:
    st.markdown("#### 🥗 식단")
    diet_rate = weekly_stats['diet']['rate']
    st.progress(diet_rate / 100)
    st.metric(
        "달성률",
        f"{diet_rate:.1f}%",
        f"{weekly_stats['diet']['completed']}/{weekly_stats['diet']['total']} 완료"
    )

    if diet_rate >= 80:
        st.success("대단해요! 건강한 식습관을 유지하고 있어요!")
    elif diet_rate >= 50:
        st.info("잘하고 있어요! 야식만 조심하면 완벽!")
    else:
        st.warning("식사 시간을 규칙적으로 해봐요!")

with col3:
    st.markdown("#### 😴 수면")
    sleep_rate = weekly_stats['sleep']['rate']
    st.progress(sleep_rate / 100)
    st.metric(
        "달성률",
        f"{sleep_rate:.1f}%",
        f"{weekly_stats['sleep']['completed']}/{weekly_stats['sleep']['total']} 완료"
    )

    if sleep_rate >= 80:
        st.success("완벽해요! 수면 패턴이 안정적이에요!")
    elif sleep_rate >= 50:
        st.info("괜찮아요! 취침 시간을 조금만 앞당겨봐요!")
    else:
        st.warning("수면 습관 개선이 필요해요!")

st.markdown("---")

# 주간 그래프 (간단한 바 차트)
st.markdown("### 📊 일별 달성 현황")

# 데모 데이터
daily_data = {
    '월': 90,
    '화': 75,
    '수': 85,
    '목': 60,
    '금': 95,
    '토': 70,
    '일': 80
}

# 간단한 막대 그래프
cols = st.columns(7)
for i, (day, rate) in enumerate(daily_data.items()):
    with cols[i]:
        st.markdown(f"**{day}**")
        st.progress(rate / 100)
        st.caption(f"{rate}%")

st.markdown("---")

# AI 피드백
st.markdown("### 🤖 AI 코치의 피드백")

# AI 피드백 생성 (간단한 버전)
if overall_rate >= 80:
    feedback = f"""
    🎉 **{nickname}님, 정말 대단해요!**

    이번 주 달성률 {overall_rate:.1f}%는 훌륭한 성과입니다!
    특히 식단 관리를 잘 하고 계시네요.

    **다음 주 목표:**
    - 현재 페이스 유지하기
    - 운동 강도 살짝 높여보기
    - 주말에도 규칙적인 생활 유지

    이대로만 하면 목표 달성 문제없어요! 💪
    """
elif overall_rate >= 50:
    feedback = f"""
    👍 **{nickname}님, 잘하고 있어요!**

    이번 주 달성률 {overall_rate:.1f}%는 좋은 시작입니다.
    아직 완벽하지 않아도 괜찮아요!

    **개선 포인트:**
    - 운동: 하루 30분이 어려우면 15분부터 시작해보세요
    - 식단: 한 끼라도 계획대로 먹어보세요
    - 수면: 10분씩 취침 시간을 앞당겨보세요

    작은 성공이 모여 큰 변화가 됩니다! 🌱
    """
else:
    feedback = f"""
    💭 **{nickname}님, 괜찮아요!**

    이번 주 달성률이 {overall_rate:.1f}%로 목표에 못 미쳤지만,
    시작했다는 것 자체가 대단한 거예요!

    **쉬운 것부터 다시 시작해봐요:**
    - 물 마시기부터 시작
    - 5분 스트레칭
    - 스마트폰 알람으로 취침 시간 리마인더

    실패는 성공의 어머니! 다음 주에 다시 도전해요! 🚀
    """

st.markdown(feedback)

st.markdown("---")

# 목표 진행률
st.markdown("### 🎯 전체 목표 진행률")

progress_weeks = min(current_week, total_weeks)
goal_progress = (progress_weeks / total_weeks) * 100

col1, col2 = st.columns([3, 1])
with col1:
    st.progress(goal_progress / 100)
with col2:
    st.metric("진행", f"{progress_weeks}/{total_weeks}주")

remaining_weeks = total_weeks - progress_weeks
if remaining_weeks > 0:
    st.info(f"🎯 목표까지 {remaining_weeks}주 남았습니다!")
else:
    st.success("🎉 목표 기간을 완료했습니다!")

# 다음 주 플랜 생성
st.markdown("---")
st.markdown("### 🚀 다음 주 플랜 생성")

if overall_rate > 0:  # 이번 주에 기록이 있는 경우
    st.info(f"""
    이번 주 달성률 **{overall_rate:.1f}%**를 바탕으로 다음 주 플랜을 생성할 수 있습니다.

    - 달성률 80% 이상: 강도를 조금 높여 도전적인 플랜
    - 달성률 50~80%: 현재 페이스 유지
    - 달성률 50% 미만: 강도를 낮춰 더 쉽게 시작
    """)

    if st.button("🚀 다음 주 플랜 생성하기", type="primary", use_container_width=True):
        with st.spinner("AI가 이번 주 성과를 분석하고 맞춤 플랜을 생성하고 있습니다..."):
            orchestrator = get_orchestrator()

            # 현재 컨텍스트 구성
            context = {
                "nickname": nickname,
                "goal": goal.get('target_description', ''),
                "goal_type": goal.get('type', 'weight'),
                "duration_weeks": goal.get('duration_weeks', 12),
                "current_week": current_week
            }

            # 다음 주 플랜 생성
            next_plan = orchestrator.generate_next_week_plan(
                context=context,
                current_week=current_week,
                weekly_stats=weekly_stats,
                previous_plan=st.session_state.get('plan', {})
            )

            # 세션 상태 업데이트
            st.session_state.plan = next_plan
            st.session_state.current_week = current_week + 1

            st.success(f"🎉 {current_week + 1}주차 플랜이 생성되었습니다!")
            st.balloons()

            # 조정 사항 표시
            st.markdown("#### 📋 이번 주 조정 사항")

            col1, col2, col3 = st.columns(3)

            with col1:
                if weekly_stats['exercise']['rate'] >= 80:
                    st.success("🏋️ 운동: 강도 UP ⬆️")
                elif weekly_stats['exercise']['rate'] >= 50:
                    st.info("🏋️ 운동: 유지 ➡️")
                else:
                    st.warning("🏋️ 운동: 강도 DOWN ⬇️")

            with col2:
                if weekly_stats['diet']['rate'] >= 80:
                    st.success("🥗 식단: 엄격하게 ⬆️")
                elif weekly_stats['diet']['rate'] >= 50:
                    st.info("🥗 식단: 유지 ➡️")
                else:
                    st.warning("🥗 식단: 유연하게 ⬇️")

            with col3:
                if weekly_stats['sleep']['rate'] >= 80:
                    st.success("😴 수면: 최적화 ⬆️")
                elif weekly_stats['sleep']['rate'] >= 50:
                    st.info("😴 수면: 유지 ➡️")
                else:
                    st.warning("😴 수면: 유연하게 ⬇️")

            if st.button("📋 새 플랜 확인하기"):
                st.switch_page("pages/2_📋_plan.py")
else:
    st.info("이번 주 미션을 수행하면 다음 주 맞춤 플랜을 생성할 수 있습니다.")

# 회고 작성
st.markdown("---")
st.markdown("### ✍️ 이번 주 회고")

reflection = st.text_area(
    "이번 주를 돌아보며...",
    placeholder="잘한 점, 아쉬운 점, 다음 주 다짐 등을 자유롭게 작성해보세요.",
    height=100
)

if st.button("회고 저장"):
    st.session_state.weekly_reflection = reflection
    st.success("✅ 회고가 저장되었습니다!")

# 빠른 네비게이션
st.markdown("---")
col1, col2, col3 = st.columns(3)

with col1:
    if st.button("📅 캘린더 보기", use_container_width=True):
        st.switch_page("pages/3_📅_calendar.py")

with col2:
    if st.button("✅ 오늘의 미션", use_container_width=True, type="primary"):
        st.switch_page("pages/4_✅_daily.py")

with col3:
    if st.button("📋 플랜 수정", use_container_width=True):
        st.switch_page("pages/2_📋_plan.py")

# 사이드바: 이전 주 기록
with st.sidebar:
    st.markdown("### 📅 주차별 기록")

    for week in range(current_week, 0, -1):
        if week == current_week:
            st.markdown(f"**{week}주차** (현재)")
        else:
            st.markdown(f"{week}주차")
        st.progress(0.75)  # 데모 데이터
        st.caption("75% 달성")

    st.markdown("---")

    st.markdown("### 💡 팁")
    st.markdown("""
    - 주간 리뷰는 일요일에 해보세요
    - 회고를 작성하면 동기부여가 됩니다
    - 작은 성취도 축하해주세요!
    """)
