"""
미션 카드 UI 컴포넌트
"""
import streamlit as st
from typing import List, Dict, Optional, Callable


# 미션 타입별 스타일
MISSION_STYLES = {
    "exercise": {
        "icon": "🏋️",
        "label": "운동",
        "color": "#FF6B6B",
        "bg_color": "#FFE5E5"
    },
    "diet": {
        "icon": "🥗",
        "label": "식단",
        "color": "#4ECDC4",
        "bg_color": "#E5F9F6"
    },
    "sleep": {
        "icon": "😴",
        "label": "수면",
        "color": "#9B59B6",
        "bg_color": "#F3E5F5"
    }
}


def render_mission_card(
    mission: Dict,
    index: int = 0,
    on_check: Callable[[str, bool], None] = None,
    show_description: bool = True
) -> bool:
    """
    개별 미션 카드 렌더링

    Args:
        mission: 미션 데이터
        index: 인덱스 (키 생성용)
        on_check: 체크 콜백 함수 (mission_id, completed)
        show_description: 설명 표시 여부

    Returns:
        완료 여부
    """
    mission_type = mission.get("type", "exercise")
    style = MISSION_STYLES.get(mission_type, MISSION_STYLES["exercise"])

    mission_id = mission.get("id", f"mission_{index}")
    title = mission.get("title", "미션")
    description = mission.get("description", "")
    completed = mission.get("completed", False)

    # 카드 컨테이너
    col1, col2 = st.columns([0.08, 0.92])

    with col1:
        # 체크박스
        new_completed = st.checkbox(
            "",
            value=completed,
            key=f"check_{mission_id}_{index}"
        )

        # 상태 변경 감지
        if new_completed != completed and on_check:
            on_check(mission_id, new_completed)

    with col2:
        # 미션 내용
        if new_completed:
            st.markdown(f"~~{style['icon']} **{title}**~~")
            if show_description and description:
                st.caption(f"~~{description}~~ ✅")
        else:
            st.markdown(f"{style['icon']} **{title}**")
            if show_description and description:
                st.caption(description)

    return new_completed


def render_mission_list(
    missions: List[Dict],
    on_check: Callable[[str, bool], None] = None,
    group_by_type: bool = True
) -> Dict[str, int]:
    """
    미션 리스트 렌더링

    Args:
        missions: 미션 리스트
        on_check: 체크 콜백 함수
        group_by_type: 타입별 그룹화 여부

    Returns:
        완료 통계 {"total": int, "completed": int}
    """
    if not missions:
        st.info("📌 오늘의 미션이 없습니다.")
        return {"total": 0, "completed": 0}

    completed_count = 0

    if group_by_type:
        # 타입별 그룹화
        grouped = {"exercise": [], "diet": [], "sleep": []}
        for mission in missions:
            mission_type = mission.get("type", "exercise")
            if mission_type in grouped:
                grouped[mission_type].append(mission)

        for mission_type, type_missions in grouped.items():
            if type_missions:
                style = MISSION_STYLES.get(mission_type)
                st.markdown(f"### {style['icon']} {style['label']}")

                for i, mission in enumerate(type_missions):
                    if render_mission_card(mission, missions.index(mission), on_check):
                        completed_count += 1

                st.markdown("---")
    else:
        # 순서대로 표시
        for i, mission in enumerate(missions):
            if render_mission_card(mission, i, on_check):
                completed_count += 1

    return {"total": len(missions), "completed": completed_count}


def render_mission_summary(total: int, completed: int):
    """
    미션 요약 렌더링

    Args:
        total: 전체 미션 수
        completed: 완료 미션 수
    """
    if total == 0:
        return

    rate = (completed / total) * 100

    col1, col2, col3 = st.columns(3)

    with col1:
        st.metric("전체", f"{total}개")

    with col2:
        st.metric("완료", f"{completed}개")

    with col3:
        emoji = get_completion_emoji(rate)
        st.metric("달성률", f"{rate:.0f}% {emoji}")

    st.progress(rate / 100)


def get_completion_emoji(rate: float) -> str:
    """완료율에 따른 이모지 반환"""
    if rate >= 100:
        return "🎉"
    elif rate >= 80:
        return "🔥"
    elif rate >= 60:
        return "👍"
    elif rate >= 40:
        return "💪"
    elif rate >= 20:
        return "🚶"
    else:
        return "🌱"


def render_add_mission_form(on_add: Callable[[Dict], None] = None):
    """
    미션 추가 폼 렌더링

    Args:
        on_add: 추가 콜백 함수
    """
    with st.expander("➕ 미션 추가"):
        col1, col2 = st.columns([3, 1])

        with col1:
            title = st.text_input("미션 이름", placeholder="예: 계단 오르기", key="new_mission_title")

        with col2:
            mission_type = st.selectbox(
                "카테고리",
                options=["exercise", "diet", "sleep"],
                format_func=lambda x: MISSION_STYLES[x]["label"],
                key="new_mission_type"
            )

        description = st.text_input("설명 (선택)", placeholder="예: 5층까지 계단으로", key="new_mission_desc")

        if st.button("추가", key="add_mission_btn"):
            if title:
                new_mission = {
                    "type": mission_type,
                    "title": title,
                    "description": description,
                    "completed": False
                }
                if on_add:
                    on_add(new_mission)
                st.success(f"✅ '{title}' 미션이 추가되었습니다!")
                return new_mission

    return None


def render_mission_badge(mission_type: str, count: int):
    """
    미션 타입 뱃지 렌더링

    Args:
        mission_type: 미션 타입
        count: 개수
    """
    style = MISSION_STYLES.get(mission_type, MISSION_STYLES["exercise"])

    st.markdown(f"""
    <div style="
        display: inline-block;
        background-color: {style['bg_color']};
        color: {style['color']};
        padding: 4px 12px;
        border-radius: 16px;
        font-size: 0.9em;
        margin: 2px;
    ">
        {style['icon']} {style['label']} {count}개
    </div>
    """, unsafe_allow_html=True)
