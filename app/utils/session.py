"""
세션 상태 관리
"""
import time
import streamlit as st
from typing import Any, Optional


def init_session_state():
    """세션 상태 초기화"""
    defaults = {
        # 인증 정보
        'logged_in': False,
        'user_id': None,
        'nickname': None,
        'name': None,
        'phone': None,

        # 현재 단계
        'current_step': 'landing',  # landing, onboarding, plan, calendar, daily, review

        # 목표 관련
        'goal': None,
        'goal_saved': False,

        # 플랜 관련
        'plan': None,
        'plan_revision_count': 0,

        # 대화 관련
        'messages': [],

        # 감시자 관련
        'last_input_time': time.time(),
        'watcher_triggered': False,
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value


def update_last_input_time():
    """마지막 입력 시간 업데이트"""
    st.session_state.last_input_time = time.time()


def get_session_value(key: str, default: Any = None) -> Any:
    """세션 값 조회"""
    return st.session_state.get(key, default)


def set_session_value(key: str, value: Any):
    """세션 값 설정"""
    st.session_state[key] = value


def clear_session():
    """세션 초기화"""
    for key in list(st.session_state.keys()):
        del st.session_state[key]
    init_session_state()


def is_logged_in() -> bool:
    """로그인 여부 확인"""
    return st.session_state.get('logged_in', False) and st.session_state.get('user_id') is not None


def is_onboarding_complete() -> bool:
    """온보딩 완료 여부 확인"""
    return is_logged_in() and st.session_state.get('goal_saved', False)


def is_plan_created() -> bool:
    """플랜 생성 완료 여부 확인"""
    return st.session_state.get('plan') is not None


def add_message(role: str, content: str, agent_type: str = None):
    """대화 메시지 추가"""
    if 'messages' not in st.session_state:
        st.session_state.messages = []

    st.session_state.messages.append({
        'role': role,
        'content': content,
        'agent_type': agent_type,
        'timestamp': time.time()
    })


def get_messages() -> list:
    """대화 메시지 조회"""
    return st.session_state.get('messages', [])


def increment_plan_revision():
    """플랜 수정 횟수 증가"""
    if 'plan_revision_count' not in st.session_state:
        st.session_state.plan_revision_count = 0
    st.session_state.plan_revision_count += 1


def get_plan_revision_count() -> int:
    """플랜 수정 횟수 조회"""
    return st.session_state.get('plan_revision_count', 0)
