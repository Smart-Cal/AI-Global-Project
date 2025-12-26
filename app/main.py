"""
Streamlit 메인 앱
- 로그인/회원가입 통합 시작화면
- 사이드바 네비게이션
- 세션 상태 초기화
"""
import streamlit as st
import re
from config import settings

# 페이지 설정
st.set_page_config(
    page_title=settings.APP_NAME,
    page_icon=settings.APP_ICON,
    layout="wide",
    initial_sidebar_state="expanded"
)

# 데이터베이스 imports (로그인/회원가입용)
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database.connection import is_connected
from database.queries import (
    login_user, register_user, check_phone_exists,
    get_active_goal, get_latest_plan, get_current_week_number
)


def init_session_state():
    """세션 상태 초기화"""
    defaults = {
        'logged_in': False,
        'user_id': None,
        'nickname': None,
        'name': None,
        'phone': None,
        'current_step': 'landing',
        'goal': None,
        'goal_saved': False,
        'plan': None,
        'current_week': 1,
        'week_start_date': None,
        'last_input_time': None,
        'plan_revision_count': 0,
        'messages': [],
        'chat_messages': [],
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def validate_phone(phone: str) -> bool:
    """전화번호 유효성 검사"""
    phone_digits = re.sub(r'[^0-9]', '', phone)
    return len(phone_digits) >= 10 and len(phone_digits) <= 11


def normalize_phone(phone: str) -> str:
    """전화번호 정규화"""
    return re.sub(r'[^0-9]', '', phone)


def show_auth_page():
    """로그인/회원가입 통합 시작화면"""
    st.title("🗓️ AI 캘린더")
    st.markdown("### 당신의 건강한 습관을 만들어드려요")

    st.markdown("""
    ---
    **AI 캘린더**는 당신의 건강 목표 달성을 도와주는 스마트한 플래너입니다.

    - 🎯 **맞춤 목표 설정** - AI가 당신에게 맞는 목표를 제안해요
    - 📋 **스마트 플랜 생성** - PT, 식단, 수면 전문 AI가 플랜을 짜드려요
    - 💬 **AI 코치 상담** - 플랜 수정이 필요하면 AI와 상담하세요
    - 📅 **캘린더 관리** - 일정을 한눈에 보고 관리해요
    ---
    """)

    # DB 연결 상태 확인
    if not is_connected():
        st.warning("⚠️ 데이터베이스 연결이 필요합니다. `.env` 파일에서 Supabase 설정을 확인해주세요.")

    # 로그인/회원가입 탭
    login_tab, register_tab = st.tabs(["🔑 로그인", "📝 회원가입"])

    # 로그인 탭
    with login_tab:
        with st.form("login_form"):
            login_phone = st.text_input("전화번호", placeholder="01012345678")
            login_password = st.text_input("비밀번호", type="password", placeholder="비밀번호 입력")
            login_submit = st.form_submit_button("로그인", use_container_width=True, type="primary")

            if login_submit:
                if not login_phone or not login_password:
                    st.error("전화번호와 비밀번호를 모두 입력해주세요.")
                elif not validate_phone(login_phone):
                    st.error("올바른 전화번호 형식이 아닙니다.")
                else:
                    normalized_phone = normalize_phone(login_phone)
                    with st.spinner("로그인 중..."):
                        user = login_user(normalized_phone, login_password)
                        if user:
                            st.session_state.logged_in = True
                            st.session_state.user_id = user.id
                            st.session_state.nickname = user.nickname
                            st.session_state.name = user.name
                            st.session_state.phone = user.phone
                            st.session_state.current_step = 'home'

                            # 기존 목표 불러오기
                            active_goal = get_active_goal(user.id)
                            if active_goal:
                                st.session_state.goal = {
                                    "id": active_goal.id,
                                    "type": active_goal.goal_type,
                                    "target_description": active_goal.target_description,
                                    "duration_weeks": active_goal.duration_weeks
                                }
                                st.session_state.goal_saved = True

                                # 기존 플랜 불러오기
                                latest_plan = get_latest_plan(user.id, active_goal.id)
                                if latest_plan:
                                    st.session_state.plan = latest_plan
                                    st.session_state.current_week = latest_plan.get('week_number', 1)
                                else:
                                    # 플랜이 없으면 현재 주차 계산
                                    st.session_state.current_week = get_current_week_number(user.id)

                            st.success(f"환영합니다, {user.nickname}님!")
                            st.rerun()
                        else:
                            st.error("전화번호 또는 비밀번호가 올바르지 않습니다.")

    # 회원가입 탭
    with register_tab:
        with st.form("register_form"):
            reg_name = st.text_input("이름 (실명)", placeholder="홍길동", max_chars=20)
            reg_nickname = st.text_input("닉네임", placeholder="운동왕", max_chars=20)
            reg_phone = st.text_input("전화번호", placeholder="01012345678")
            reg_password = st.text_input("비밀번호", type="password", placeholder="6자 이상")
            reg_password_confirm = st.text_input("비밀번호 확인", type="password")
            agree_terms = st.checkbox("개인정보 처리방침에 동의합니다")
            register_submit = st.form_submit_button("회원가입", use_container_width=True, type="primary")

            if register_submit:
                errors = []
                if not reg_name or len(reg_name) < 2:
                    errors.append("이름은 2자 이상 입력해주세요.")
                if not reg_nickname or len(reg_nickname) < 2:
                    errors.append("닉네임은 2자 이상 입력해주세요.")
                if not reg_phone or not validate_phone(reg_phone):
                    errors.append("올바른 전화번호 형식이 아닙니다.")
                if len(reg_password) < 6:
                    errors.append("비밀번호는 6자 이상이어야 합니다.")
                if reg_password != reg_password_confirm:
                    errors.append("비밀번호가 일치하지 않습니다.")
                if not agree_terms:
                    errors.append("개인정보 처리방침에 동의해주세요.")

                if errors:
                    for error in errors:
                        st.error(error)
                else:
                    normalized_phone = normalize_phone(reg_phone)
                    if check_phone_exists(normalized_phone):
                        st.error("이미 등록된 전화번호입니다.")
                    else:
                        with st.spinner("회원가입 처리 중..."):
                            user = register_user(normalized_phone, reg_password, reg_name, reg_nickname)
                            if user:
                                st.session_state.logged_in = True
                                st.session_state.user_id = user.id
                                st.session_state.nickname = user.nickname
                                st.session_state.name = user.name
                                st.session_state.phone = user.phone
                                st.session_state.current_step = 'home'
                                st.success(f"회원가입을 축하합니다, {user.nickname}님!")
                                st.balloons()
                                st.rerun()
                            else:
                                st.error("회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.")


def show_sidebar():
    """사이드바 네비게이션 (로그인 후)"""
    with st.sidebar:
        st.title(f"{settings.APP_ICON} {settings.APP_NAME}")
        st.markdown(f"안녕하세요, **{st.session_state.nickname}**님!")
        st.markdown("---")

        # 네비게이션 메뉴
        st.markdown("### 📌 메뉴")

        menu_items = [
            ("🏠 홈", "home", "pages/1_🎯_onboarding.py"),
            ("🎯 목표 설정", "onboarding", "pages/1_🎯_onboarding.py"),
            ("📋 플랜 & AI 상담", "plan", "pages/2_📋_plan.py"),
            ("📅 캘린더", "calendar", "pages/3_📅_calendar.py"),
            ("✅ 오늘의 미션", "daily", "pages/4_✅_daily.py"),
            ("📊 주간 리뷰", "review", "pages/5_📊_review.py"),
            ("👤 마이페이지", "mypage", "pages/6_👤_mypage.py"),
        ]

        for label, step, page in menu_items:
            if st.button(label, use_container_width=True):
                st.switch_page(page)

        st.markdown("---")

        # 설정 검증 상태
        if not settings.validate():
            st.warning("⚠️ API 키 설정 필요")


def show_home():
    """홈 화면 (로그인 후 메인)"""
    show_sidebar()

    st.title(f"안녕하세요, {st.session_state.nickname}님! 👋")

    # 현재 상태에 따라 다른 내용 표시
    if not st.session_state.get('goal_saved'):
        st.info("🎯 아직 목표가 설정되지 않았어요. 목표를 설정해보세요!")
        if st.button("목표 설정하러 가기", type="primary"):
            st.switch_page("pages/1_🎯_onboarding.py")
    elif not st.session_state.get('plan'):
        st.info("📋 목표는 설정되었지만 플랜이 없어요. AI에게 플랜을 요청해보세요!")
        if st.button("플랜 생성하러 가기", type="primary"):
            st.switch_page("pages/2_📋_plan.py")
    else:
        # 대시보드
        st.markdown("### 📊 오늘의 현황")

        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("현재 주차", f"{st.session_state.get('current_week', 1)}주차")
        with col2:
            goal = st.session_state.get('goal', {})
            st.metric("목표 기간", f"{goal.get('duration_weeks', 12)}주")
        with col3:
            st.metric("목표", goal.get('type', '-'))

        st.markdown("---")

        col1, col2 = st.columns(2)
        with col1:
            if st.button("✅ 오늘의 미션 체크하기", use_container_width=True, type="primary"):
                st.switch_page("pages/4_✅_daily.py")
        with col2:
            if st.button("💬 AI 코치와 상담하기", use_container_width=True):
                st.switch_page("pages/2_📋_plan.py")


def main():
    """메인 함수"""
    init_session_state()

    # 로그인 상태 확인
    if not st.session_state.get('logged_in'):
        show_auth_page()
    else:
        show_home()


if __name__ == "__main__":
    main()
