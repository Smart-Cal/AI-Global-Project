"""
캘린더 UI 컴포넌트
"""
import streamlit as st
from datetime import date, timedelta
from typing import List, Dict, Optional, Callable
import calendar


def render_calendar(
    year: int = None,
    month: int = None,
    events: Dict[str, List[Dict]] = None,
    on_date_click: Callable[[date], None] = None
):
    """
    월간 캘린더 렌더링

    Args:
        year: 년도 (기본: 현재)
        month: 월 (기본: 현재)
        events: 날짜별 이벤트 {"2024-01-15": [{"type": "exercise", "title": "..."}]}
        on_date_click: 날짜 클릭 콜백
    """
    today = date.today()
    year = year or today.year
    month = month or today.month
    events = events or {}

    # 요일 헤더
    weekdays = ["월", "화", "수", "목", "금", "토", "일"]
    cols = st.columns(7)
    for i, col in enumerate(cols):
        with col:
            color = "#E53935" if i == 6 else ("#1976D2" if i == 5 else "#333")
            st.markdown(f"<div style='text-align: center; color: {color}; font-weight: bold;'>{weekdays[i]}</div>", unsafe_allow_html=True)

    # 월별 날짜 계산
    cal = calendar.Calendar(firstweekday=0)
    month_days = cal.monthdayscalendar(year, month)

    # 날짜 렌더링
    for week in month_days:
        cols = st.columns(7)
        for i, day in enumerate(week):
            with cols[i]:
                if day == 0:
                    st.markdown("")
                else:
                    current_date = date(year, month, day)
                    date_str = current_date.isoformat()
                    day_events = events.get(date_str, [])

                    render_day_cell(
                        current_date,
                        day_events,
                        is_today=(current_date == today),
                        on_click=on_date_click
                    )


def render_day_cell(
    d: date,
    events: List[Dict] = None,
    is_today: bool = False,
    on_click: Callable[[date], None] = None
):
    """
    날짜 셀 렌더링

    Args:
        d: 날짜
        events: 해당 날짜의 이벤트
        is_today: 오늘 여부
        on_click: 클릭 콜백
    """
    events = events or []

    # 스타일 결정
    bg_color = "#E3F2FD" if is_today else "#FFFFFF"
    border = "2px solid #1976D2" if is_today else "1px solid #E0E0E0"
    text_color = "#1976D2" if is_today else "#333"

    # 이벤트 아이콘
    event_icons = []
    for event in events[:3]:  # 최대 3개
        event_type = event.get("type", "")
        icon = {"exercise": "🏋️", "diet": "🥗", "sleep": "😴"}.get(event_type, "📌")
        event_icons.append(icon)

    icons_html = " ".join(event_icons) if event_icons else ""

    # 렌더링
    st.markdown(f"""
    <div style="
        background-color: {bg_color};
        border: {border};
        border-radius: 8px;
        padding: 8px;
        text-align: center;
        min-height: 60px;
        cursor: pointer;
    ">
        <div style="font-weight: bold; color: {text_color};">{d.day}</div>
        <div style="font-size: 0.8em;">{icons_html}</div>
    </div>
    """, unsafe_allow_html=True)


def render_day_card(
    d: date,
    schedule: Dict,
    compact: bool = False,
    show_details: bool = True
):
    """
    일일 카드 렌더링

    Args:
        d: 날짜
        schedule: 일정 정보
        compact: 컴팩트 모드
        show_details: 상세 정보 표시
    """
    today = date.today()
    is_today = d == today
    is_past = d < today

    # 배경색
    if is_today:
        bg_color = "#E3F2FD"
    elif is_past:
        bg_color = "#F5F5F5"
    else:
        bg_color = "#FFFFFF"

    # 운동 강도 표시
    intensity = schedule.get("exercise_intensity", "rest")
    intensity_icon = {
        "low": "🟢",
        "medium": "🟡",
        "high": "🔴",
        "rest": "⚪"
    }.get(intensity, "⚪")

    if compact:
        st.markdown(f"""
        <div style="
            background-color: {bg_color};
            padding: 8px;
            border-radius: 8px;
            border: {'2px solid #1976D2' if is_today else '1px solid #E0E0E0'};
            min-height: 60px;
        ">
            <div style="font-weight: bold;">{d.day}</div>
            <div style="font-size: 0.8em;">{intensity_icon}</div>
        </div>
        """, unsafe_allow_html=True)
    else:
        # 상세 카드
        weekdays = ["월", "화", "수", "목", "금", "토", "일"]
        weekday = weekdays[d.weekday()]

        title = f"📌 {d.month}/{d.day} ({weekday})" if is_today else f"{d.month}/{d.day} ({weekday})"

        with st.container():
            st.markdown(f"### {title}")

            if show_details:
                st.markdown(f"""
                **🏋️ 운동**: {schedule.get('exercise', '휴식')}

                **🥗 식단**: 플랜대로 진행

                **😴 수면**: {schedule.get('sleep', {}).get('target_bedtime', '23:00')} 취침
                """)


def render_week_view(
    start_date: date,
    schedules: Dict[str, Dict],
    on_date_click: Callable[[date], None] = None
):
    """
    주간 뷰 렌더링

    Args:
        start_date: 주 시작일 (월요일)
        schedules: 날짜별 일정 {"2024-01-15": {...}}
        on_date_click: 날짜 클릭 콜백
    """
    cols = st.columns(7)

    for i in range(7):
        current_date = start_date + timedelta(days=i)
        date_str = current_date.isoformat()
        schedule = schedules.get(date_str, {})

        with cols[i]:
            render_day_card(current_date, schedule)


def render_month_navigation(
    current_year: int,
    current_month: int,
    on_prev: Callable[[], None] = None,
    on_next: Callable[[], None] = None
):
    """
    월 네비게이션 렌더링

    Args:
        current_year: 현재 년도
        current_month: 현재 월
        on_prev: 이전 월 콜백
        on_next: 다음 월 콜백
    """
    col1, col2, col3 = st.columns([1, 2, 1])

    with col1:
        if st.button("◀ 이전"):
            if on_prev:
                on_prev()

    with col2:
        st.markdown(f"### {current_year}년 {current_month}월")

    with col3:
        if st.button("다음 ▶"):
            if on_next:
                on_next()


def get_week_dates(reference_date: date) -> List[date]:
    """
    주간 날짜 리스트 반환

    Args:
        reference_date: 기준 날짜

    Returns:
        월요일부터 일요일까지의 날짜 리스트
    """
    start = reference_date - timedelta(days=reference_date.weekday())
    return [start + timedelta(days=i) for i in range(7)]
