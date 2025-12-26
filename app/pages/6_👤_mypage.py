"""
마이페이지
- 사용자 정보 확인
- 로그아웃 기능
- 계정 설정
"""
import streamlit as st
import os
import sys

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.session import init_session_state

# 세션 초기화
init_session_state()

st.set_page_config(
    page_title="마이페이지 - AI 캘린더",
    page_icon="👤",
    layout="wide"
)

st.title("👤 마이페이지")

# 로그인 체크
if not st.session_state.get('logged_in'):
    st.warning("로그인이 필요합니다.")
    if st.button("🔐 로그인하러 가기", type="primary"):
        st.switch_page("main.py")
    st.stop()

# 사용자 정보
nickname = st.session_state.get('nickname', '사용자')
name = st.session_state.get('name', '-')
phone = st.session_state.get('phone', '-')

st.markdown(f"### 안녕하세요, **{nickname}**님!")
st.markdown("---")

# 내 정보 섹션
st.markdown("### 📋 내 정보")

col1, col2 = st.columns(2)

with col1:
    st.markdown("**이름 (실명)**")
    st.info(name)

with col2:
    st.markdown("**닉네임**")
    st.info(nickname)

st.markdown("**전화번호**")
# 전화번호 마스킹 (앞 3자리, 뒤 4자리만 표시)
if phone and len(phone) >= 10:
    masked_phone = phone[:3] + "****" + phone[-4:]
else:
    masked_phone = phone
st.info(masked_phone)

st.markdown("---")

# 목표 정보
st.markdown("### 🎯 현재 목표")

goal = st.session_state.get('goal', {})
if goal:
    col1, col2, col3 = st.columns(3)

    with col1:
        goal_type_labels = {
            'weight': '🏃 체중/체형 관리',
            'exercise': '💪 운동 습관',
            'diet': '🥗 식단 관리',
            'sleep': '😴 수면 개선'
        }
        st.metric("목표 유형", goal_type_labels.get(goal.get('type', ''), '-'))

    with col2:
        st.metric("목표 기간", f"{goal.get('duration_weeks', '-')}주")

    with col3:
        current_week = st.session_state.get('current_week', 1)
        st.metric("현재 주차", f"{current_week}주차")

    st.markdown("**목표 내용**")
    st.info(goal.get('target_description', '목표가 설정되지 않았습니다.'))
else:
    st.info("아직 설정된 목표가 없습니다.")
    if st.button("🎯 목표 설정하러 가기"):
        st.switch_page("pages/1_🎯_onboarding.py")

st.markdown("---")

# 플랜 상태
st.markdown("### 📋 플랜 상태")

if st.session_state.get('plan'):
    st.success("✅ 플랜이 생성되어 있습니다.")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("📋 플랜 확인하기", use_container_width=True):
            st.switch_page("pages/2_📋_plan.py")
    with col2:
        if st.button("📅 캘린더 보기", use_container_width=True):
            st.switch_page("pages/3_📅_calendar.py")
else:
    st.warning("⚠️ 아직 플랜이 생성되지 않았습니다.")
    if st.button("📋 플랜 생성하러 가기"):
        st.switch_page("pages/2_📋_plan.py")

st.markdown("---")

# 로그아웃 섹션
st.markdown("### 🚪 계정")

col1, col2, col3 = st.columns([1, 1, 1])

with col2:
    if st.button("🚪 로그아웃", use_container_width=True, type="primary"):
        # 세션 상태 초기화
        for key in list(st.session_state.keys()):
            del st.session_state[key]
        st.success("로그아웃되었습니다.")
        st.switch_page("main.py")

st.markdown("---")

# 앱 정보
with st.expander("ℹ️ 앱 정보"):
    st.markdown("""
    **AI 캘린더** v1.0

    당신의 건강한 습관을 만들어드리는 AI 플래너

    - 🎯 맞춤 목표 설정
    - 📋 AI 기반 플랜 생성
    - 💬 AI 코치 상담
    - 📅 스마트 캘린더 관리

    ---
    문의: support@ai-calendar.com
    """)

# 사이드바
with st.sidebar:
    st.markdown("### 📌 빠른 메뉴")

    if st.button("🏠 홈", use_container_width=True):
        st.switch_page("main.py")

    if st.button("✅ 오늘의 미션", use_container_width=True):
        st.switch_page("pages/4_✅_daily.py")

    if st.button("📊 주간 리뷰", use_container_width=True):
        st.switch_page("pages/5_📊_review.py")

    st.markdown("---")

    st.markdown("### 💡 팁")
    st.markdown("""
    - 매일 미션을 체크하면 동기부여가 됩니다
    - 주간 리뷰로 진행 상황을 확인하세요
    - AI 코치에게 플랜 수정을 요청할 수 있어요
    """)
