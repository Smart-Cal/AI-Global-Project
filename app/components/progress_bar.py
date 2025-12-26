"""
진행률 표시 UI 컴포넌트
"""
import streamlit as st
from typing import Optional


def render_progress_bar(
    value: float,
    label: str = None,
    show_percentage: bool = True,
    color: str = None
):
    """
    진행률 바 렌더링

    Args:
        value: 진행률 (0-100)
        label: 라벨 텍스트
        show_percentage: 퍼센트 표시 여부
        color: 바 색상
    """
    # 값 정규화
    value = max(0, min(100, value))

    if label:
        if show_percentage:
            st.markdown(f"**{label}**: {value:.1f}%")
        else:
            st.markdown(f"**{label}**")

    # 기본 Streamlit 프로그레스 바
    st.progress(value / 100)


def render_progress_ring(
    value: float,
    size: int = 100,
    label: str = None,
    color: str = "#1976D2"
):
    """
    원형 진행률 표시 렌더링 (CSS 기반)

    Args:
        value: 진행률 (0-100)
        size: 크기 (px)
        label: 중앙 라벨
        color: 색상
    """
    value = max(0, min(100, value))

    # CSS 원형 진행률
    st.markdown(f"""
    <div style="
        width: {size}px;
        height: {size}px;
        border-radius: 50%;
        background: conic-gradient(
            {color} {value * 3.6}deg,
            #E0E0E0 {value * 3.6}deg
        );
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 10px auto;
    ">
        <div style="
            width: {size - 20}px;
            height: {size - 20}px;
            border-radius: 50%;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-direction: column;
        ">
            <span style="font-size: {size // 4}px; font-weight: bold; color: {color};">
                {value:.0f}%
            </span>
            {f'<span style="font-size: {size // 8}px; color: #666;">{label}</span>' if label else ''}
        </div>
    </div>
    """, unsafe_allow_html=True)


def render_multi_progress(
    values: dict,
    labels: dict = None,
    colors: dict = None
):
    """
    여러 진행률 한 번에 렌더링

    Args:
        values: {"key": value} 형태
        labels: {"key": "라벨"} 형태
        colors: {"key": "#color"} 형태
    """
    labels = labels or {}
    colors = colors or {}

    default_colors = {
        "exercise": "#FF6B6B",
        "diet": "#4ECDC4",
        "sleep": "#9B59B6",
        "overall": "#1976D2"
    }

    cols = st.columns(len(values))
    for i, (key, value) in enumerate(values.items()):
        with cols[i]:
            label = labels.get(key, key)
            color = colors.get(key, default_colors.get(key, "#1976D2"))
            render_progress_ring(value, size=80, label=label, color=color)


def render_streak_counter(days: int, label: str = "연속"):
    """
    연속 달성 카운터 렌더링

    Args:
        days: 연속 일수
        label: 라벨
    """
    if days == 0:
        emoji = "🌱"
        message = "시작해볼까요?"
    elif days < 7:
        emoji = "🔥"
        message = f"{days}일 연속!"
    elif days < 30:
        emoji = "⚡"
        message = f"{days}일 연속!"
    else:
        emoji = "🏆"
        message = f"{days}일 연속!"

    st.markdown(f"""
    <div style="
        text-align: center;
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 16px;
        color: white;
    ">
        <div style="font-size: 48px;">{emoji}</div>
        <div style="font-size: 24px; font-weight: bold;">{message}</div>
        <div style="font-size: 14px; opacity: 0.8;">{label}</div>
    </div>
    """, unsafe_allow_html=True)


def render_goal_progress(
    current_week: int,
    total_weeks: int,
    label: str = "목표 진행률"
):
    """
    목표 진행률 렌더링

    Args:
        current_week: 현재 주차
        total_weeks: 전체 주차
        label: 라벨
    """
    progress = (current_week / total_weeks) * 100 if total_weeks > 0 else 0
    remaining = total_weeks - current_week

    col1, col2 = st.columns([3, 1])

    with col1:
        st.markdown(f"**{label}**")
        st.progress(progress / 100)

    with col2:
        st.metric("진행", f"{current_week}/{total_weeks}주")

    if remaining > 0:
        st.caption(f"🎯 목표까지 {remaining}주 남았습니다!")
    else:
        st.success("🎉 목표 기간을 완료했습니다!")


def render_completion_badge(rate: float):
    """
    완료율 뱃지 렌더링

    Args:
        rate: 완료율 (0-100)
    """
    if rate >= 90:
        color = "#4CAF50"
        label = "완벽!"
        emoji = "🏆"
    elif rate >= 70:
        color = "#8BC34A"
        label = "훌륭해요!"
        emoji = "🔥"
    elif rate >= 50:
        color = "#FFC107"
        label = "좋아요!"
        emoji = "👍"
    elif rate >= 30:
        color = "#FF9800"
        label = "화이팅!"
        emoji = "💪"
    else:
        color = "#F44336"
        label = "시작이 반!"
        emoji = "🌱"

    st.markdown(f"""
    <div style="
        display: inline-block;
        background-color: {color};
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
    ">
        {emoji} {rate:.0f}% - {label}
    </div>
    """, unsafe_allow_html=True)


def render_weekly_chart(data: dict):
    """
    주간 차트 렌더링 (간단한 막대 그래프)

    Args:
        data: {"월": 80, "화": 90, ...}
    """
    cols = st.columns(len(data))

    for i, (day, value) in enumerate(data.items()):
        with cols[i]:
            # 막대 높이 계산 (최대 100px)
            height = int(value)

            st.markdown(f"""
            <div style="text-align: center;">
                <div style="
                    width: 30px;
                    height: {height}px;
                    background: linear-gradient(to top, #667eea, #764ba2);
                    border-radius: 4px;
                    margin: 0 auto {100 - height}px auto;
                "></div>
                <div style="font-size: 12px; color: #666;">{day}</div>
                <div style="font-size: 10px; color: #999;">{value}%</div>
            </div>
            """, unsafe_allow_html=True)
