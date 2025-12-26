"""
채팅 UI 컴포넌트
"""
import streamlit as st
from typing import List, Dict, Optional, Callable


def render_chat_message(role: str, content: str, avatar: str = None, agent_type: str = None):
    """
    채팅 메시지 렌더링

    Args:
        role: 역할 ('user', 'assistant', 'system')
        content: 메시지 내용
        avatar: 아바타 이모지/이미지 (선택)
        agent_type: 에이전트 타입 (선택)
    """
    # 기본 아바타 설정
    if avatar is None:
        if role == "user":
            avatar = "👤"
        elif role == "assistant":
            # 에이전트 타입에 따른 아바타
            agent_avatars = {
                "orchestrator": "🤖",
                "pt": "🏋️",
                "diet": "🥗",
                "sleep": "😴",
                "watcher": "👁️"
            }
            avatar = agent_avatars.get(agent_type, "🤖")
        else:
            avatar = "💬"

    with st.chat_message(role, avatar=avatar):
        st.markdown(content)

        # 에이전트 타입 표시 (선택적)
        if agent_type and role == "assistant":
            agent_labels = {
                "orchestrator": "AI 코치",
                "pt": "PT 코치",
                "diet": "영양 코치",
                "sleep": "수면 코치",
                "watcher": "감시자"
            }
            label = agent_labels.get(agent_type, agent_type)
            st.caption(f"by {label}")


def render_chat_input(
    placeholder: str = "메시지를 입력하세요...",
    key: str = "chat_input",
    on_submit: Callable[[str], None] = None
) -> Optional[str]:
    """
    채팅 입력창 렌더링

    Args:
        placeholder: 플레이스홀더 텍스트
        key: 입력창 키
        on_submit: 제출 콜백 함수

    Returns:
        입력된 메시지 또는 None
    """
    user_input = st.chat_input(placeholder, key=key)

    if user_input and on_submit:
        on_submit(user_input)

    return user_input


def render_chat_history(messages: List[Dict], max_messages: int = None):
    """
    채팅 히스토리 렌더링

    Args:
        messages: 메시지 리스트
        max_messages: 최대 표시 메시지 수 (None이면 전체)
    """
    if max_messages:
        messages = messages[-max_messages:]

    for msg in messages:
        render_chat_message(
            role=msg.get("role", "user"),
            content=msg.get("content", ""),
            avatar=msg.get("avatar"),
            agent_type=msg.get("agent_type")
        )


def render_intervention(message: str, options: List[Dict], on_select: Callable[[str], None] = None) -> Optional[str]:
    """
    감시자 개입 메시지 렌더링

    Args:
        message: 개입 메시지
        options: 선택지 리스트 [{"id": str, "label": str, "action": str}, ...]
        on_select: 선택 콜백 함수

    Returns:
        선택된 액션 또는 None
    """
    with st.chat_message("assistant", avatar="👁️"):
        st.markdown(message)

        if options:
            cols = st.columns(len(options))
            for i, opt in enumerate(options):
                with cols[i]:
                    if st.button(opt.get("label", "선택"), key=f"intervention_{opt.get('id', i)}"):
                        action = opt.get("action")
                        if on_select:
                            on_select(action)
                        return action

    return None


def render_quick_replies(replies: List[str], on_select: Callable[[str], None] = None) -> Optional[str]:
    """
    빠른 답장 버튼 렌더링

    Args:
        replies: 빠른 답장 텍스트 리스트
        on_select: 선택 콜백 함수

    Returns:
        선택된 답장 또는 None
    """
    cols = st.columns(len(replies))
    for i, reply in enumerate(replies):
        with cols[i]:
            if st.button(reply, key=f"quick_reply_{i}", use_container_width=True):
                if on_select:
                    on_select(reply)
                return reply
    return None


def render_typing_indicator():
    """타이핑 인디케이터 렌더링"""
    with st.chat_message("assistant", avatar="🤖"):
        st.markdown("⏳ 생각하고 있어요...")


def create_chat_container(height: int = 400):
    """
    스크롤 가능한 채팅 컨테이너 생성

    Args:
        height: 컨테이너 높이 (px)

    Returns:
        Streamlit 컨테이너
    """
    return st.container(height=height)


class ChatManager:
    """채팅 관리 클래스"""

    def __init__(self, session_key: str = "chat_messages"):
        self.session_key = session_key
        self._init_messages()

    def _init_messages(self):
        """메시지 초기화"""
        if self.session_key not in st.session_state:
            st.session_state[self.session_key] = []

    @property
    def messages(self) -> List[Dict]:
        """메시지 리스트 반환"""
        return st.session_state.get(self.session_key, [])

    def add_message(self, role: str, content: str, agent_type: str = None):
        """메시지 추가"""
        self.messages.append({
            "role": role,
            "content": content,
            "agent_type": agent_type
        })

    def add_user_message(self, content: str):
        """사용자 메시지 추가"""
        self.add_message("user", content)

    def add_assistant_message(self, content: str, agent_type: str = None):
        """어시스턴트 메시지 추가"""
        self.add_message("assistant", content, agent_type)

    def clear(self):
        """메시지 초기화"""
        st.session_state[self.session_key] = []

    def render(self, max_messages: int = None):
        """채팅 히스토리 렌더링"""
        render_chat_history(self.messages, max_messages)

    def get_last_message(self) -> Optional[Dict]:
        """마지막 메시지 반환"""
        if self.messages:
            return self.messages[-1]
        return None
