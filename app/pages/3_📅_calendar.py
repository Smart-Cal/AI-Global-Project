"""
3단계: 통합 캘린더
- 개인 일정 관리 (CRUD)
- 건강 목표 플랜 표시
- AI 일정 조율 제안
"""
import streamlit as st
from datetime import date, datetime, timedelta
import os
import sys

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.session import init_session_state
from utils.datetime_utils import (
    get_current_week_dates,
    get_month_calendar,
    format_date_korean,
    get_weekday_korean,
    is_today,
    is_past
)
from database.connection import is_connected
from database.queries import (
    get_events_by_date,
    get_events_by_date_range,
    get_week_events,
    get_month_events,
    create_event,
    update_event,
    delete_event,
    get_event
)

# 세션 초기화
init_session_state()

st.set_page_config(
    page_title="캘린더 - AI 캘린더",
    page_icon="📅",
    layout="wide"
)

st.title("📅 내 캘린더")

# 로그인 체크
if not st.session_state.get('logged_in'):
    st.warning("로그인이 필요합니다.")
    if st.button("🔐 로그인하러 가기", type="primary"):
        st.switch_page("main.py")
    st.stop()

user_id = st.session_state.get('user_id')

# 카테고리 색상 및 아이콘
CATEGORY_CONFIG = {
    'work': {'icon': '💼', 'label': '업무', 'color': '#FF6B6B'},
    'personal': {'icon': '👤', 'label': '개인', 'color': '#4ECDC4'},
    'social': {'icon': '👥', 'label': '약속', 'color': '#45B7D1'},
    'health': {'icon': '💪', 'label': '건강', 'color': '#96CEB4'},
    'other': {'icon': '📌', 'label': '기타', 'color': '#DDA0DD'}
}

PRIORITY_CONFIG = {
    'high': {'icon': '🔴', 'label': '높음'},
    'normal': {'icon': '🟡', 'label': '보통'},
    'low': {'icon': '🟢', 'label': '낮음'}
}


def show_event_form(event_date: date = None, edit_event=None):
    """일정 추가/수정 폼"""
    is_edit = edit_event is not None
    form_key = f"event_form_{edit_event.id if is_edit else 'new'}"

    with st.form(form_key):
        st.subheader("✏️ 일정 수정" if is_edit else "➕ 새 일정 추가")

        # 제목
        title = st.text_input(
            "일정 제목 *",
            value=edit_event.title if is_edit else "",
            placeholder="예: 팀 미팅, 친구 만남"
        )

        # 날짜
        default_date = edit_event.event_date if is_edit else (event_date or date.today())
        selected_date = st.date_input("날짜 *", value=default_date)

        # 종일 일정 여부
        is_all_day = st.checkbox(
            "종일 일정",
            value=edit_event.is_all_day if is_edit else False
        )

        # 시간 (종일이 아닌 경우)
        col1, col2 = st.columns(2)
        if not is_all_day:
            with col1:
                default_start = "09:00"
                if is_edit and edit_event.start_time:
                    default_start = str(edit_event.start_time)[:5]
                start_time = st.text_input("시작 시간", value=default_start, placeholder="09:00")

            with col2:
                default_end = "10:00"
                if is_edit and edit_event.end_time:
                    default_end = str(edit_event.end_time)[:5]
                end_time = st.text_input("종료 시간", value=default_end, placeholder="10:00")
        else:
            start_time = None
            end_time = None

        # 카테고리
        category_options = list(CATEGORY_CONFIG.keys())
        default_idx = category_options.index(edit_event.category) if is_edit and edit_event.category in category_options else 1
        selected_category = st.selectbox(
            "카테고리",
            options=category_options,
            format_func=lambda x: f"{CATEGORY_CONFIG[x]['icon']} {CATEGORY_CONFIG[x]['label']}",
            index=default_idx
        )

        # 우선순위
        priority_options = list(PRIORITY_CONFIG.keys())
        default_priority_idx = priority_options.index(edit_event.priority) if is_edit and edit_event.priority in priority_options else 1
        selected_priority = st.selectbox(
            "우선순위",
            options=priority_options,
            format_func=lambda x: f"{PRIORITY_CONFIG[x]['icon']} {PRIORITY_CONFIG[x]['label']}",
            index=default_priority_idx
        )

        # 장소
        location = st.text_input(
            "장소 (선택)",
            value=edit_event.location if is_edit and edit_event.location else "",
            placeholder="예: 회사 회의실, 강남역 스타벅스"
        )

        # 설명
        description = st.text_area(
            "메모 (선택)",
            value=edit_event.description if is_edit and edit_event.description else "",
            placeholder="추가 메모를 입력하세요"
        )

        # 버튼
        col1, col2 = st.columns(2)
        with col1:
            submit = st.form_submit_button(
                "수정 완료" if is_edit else "일정 추가",
                use_container_width=True,
                type="primary"
            )
        with col2:
            if is_edit:
                delete_btn = st.form_submit_button("🗑️ 삭제", use_container_width=True)
            else:
                delete_btn = False

        if submit:
            if not title:
                st.error("일정 제목을 입력해주세요.")
            else:
                if is_edit:
                    # 수정
                    result = update_event(
                        edit_event.id,
                        title=title,
                        event_date=selected_date,
                        start_time=start_time if not is_all_day else None,
                        end_time=end_time if not is_all_day else None,
                        is_all_day=is_all_day,
                        category=selected_category,
                        priority=selected_priority,
                        location=location if location else None,
                        description=description if description else None
                    )
                    if result:
                        st.success("✅ 일정이 수정되었습니다!")
                        st.session_state.editing_event = None
                        st.rerun()
                    else:
                        st.error("일정 수정에 실패했습니다.")
                else:
                    # 추가
                    result = create_event(
                        user_id=user_id,
                        title=title,
                        event_date=selected_date,
                        start_time=start_time if not is_all_day else None,
                        end_time=end_time if not is_all_day else None,
                        is_all_day=is_all_day,
                        category=selected_category,
                        priority=selected_priority,
                        location=location if location else None,
                        description=description if description else None
                    )
                    if result:
                        st.success("✅ 일정이 추가되었습니다!")
                        st.session_state.show_add_form = False
                        st.rerun()
                    else:
                        st.error("일정 추가에 실패했습니다.")

        if delete_btn and is_edit:
            if delete_event(edit_event.id):
                st.success("🗑️ 일정이 삭제되었습니다!")
                st.session_state.editing_event = None
                st.rerun()
            else:
                st.error("일정 삭제에 실패했습니다.")


def render_event_card(event, show_date=False):
    """일정 카드 렌더링"""
    category = CATEGORY_CONFIG.get(event.category, CATEGORY_CONFIG['other'])
    priority = PRIORITY_CONFIG.get(event.priority, PRIORITY_CONFIG['normal'])

    # 시간 표시
    if event.is_all_day:
        time_str = "종일"
    elif event.start_time and event.end_time:
        start = str(event.start_time)[:5] if event.start_time else ""
        end = str(event.end_time)[:5] if event.end_time else ""
        time_str = f"{start} - {end}"
    else:
        time_str = ""

    col1, col2, col3 = st.columns([0.1, 0.7, 0.2])

    with col1:
        st.markdown(f"### {category['icon']}")

    with col2:
        date_prefix = f"**{format_date_korean(event.event_date)}** " if show_date else ""
        st.markdown(f"{date_prefix}**{event.title}**")
        details = []
        if time_str:
            details.append(f"🕐 {time_str}")
        if event.location:
            details.append(f"📍 {event.location}")
        if details:
            st.caption(" | ".join(details))

    with col3:
        if st.button("✏️", key=f"edit_{event.id}"):
            st.session_state.editing_event = event.id
            st.rerun()


def render_health_plan(d: date):
    """건강 플랜 표시 (운동/식단/수면)"""
    plan = st.session_state.get('plan', {})
    if not plan:
        return

    weekday = get_weekday_korean(d)

    # 운동 플랜
    exercise_plan = plan.get('exercise', {})
    if isinstance(exercise_plan, dict):
        for day_plan in exercise_plan.get('weekly_plan', []):
            if isinstance(day_plan, dict) and day_plan.get('day') == weekday:
                workout = day_plan.get('workout', '')
                if workout and workout != '완전 휴식':
                    st.markdown(f"🏋️ **운동**: {workout}")

    # 수면 플랜 (오늘만)
    if is_today(d):
        sleep_plan = plan.get('sleep', {})
        if isinstance(sleep_plan, dict):
            schedule = sleep_plan.get('sleep_schedule', {})
            if schedule:
                st.markdown(f"😴 **취침 목표**: {schedule.get('target_bedtime', '23:00')}")


# 뷰 모드 선택
col1, col2, col3 = st.columns([1, 1, 2])
with col1:
    view_mode = st.radio("보기 모드", ["주간", "월간"], horizontal=True, label_visibility="collapsed")
with col3:
    if st.button("➕ 새 일정 추가", type="primary"):
        st.session_state.show_add_form = True
        st.session_state.editing_event = None

st.markdown("---")

# 일정 추가 폼 표시
if st.session_state.get('show_add_form'):
    show_event_form()
    if st.button("취소"):
        st.session_state.show_add_form = False
        st.rerun()
    st.markdown("---")

# 일정 수정 폼 표시
if st.session_state.get('editing_event'):
    event = get_event(st.session_state.editing_event)
    if event:
        show_event_form(edit_event=event)
        if st.button("취소", key="cancel_edit"):
            st.session_state.editing_event = None
            st.rerun()
        st.markdown("---")

# 주간 뷰
if view_mode == "주간":
    week_start, week_end = get_current_week_dates()

    # 주간 네비게이션
    col1, col2, col3 = st.columns([1, 3, 1])
    with col1:
        if st.button("◀ 이전 주"):
            st.session_state.selected_week_offset = st.session_state.get('selected_week_offset', 0) - 1
            st.rerun()
    with col2:
        week_offset = st.session_state.get('selected_week_offset', 0)
        display_start = week_start + timedelta(weeks=week_offset)
        display_end = week_end + timedelta(weeks=week_offset)
        st.markdown(f"### 📆 {format_date_korean(display_start)} ~ {format_date_korean(display_end)}")
    with col3:
        if st.button("다음 주 ▶"):
            st.session_state.selected_week_offset = st.session_state.get('selected_week_offset', 0) + 1
            st.rerun()

    # 주 오프셋 적용
    week_offset = st.session_state.get('selected_week_offset', 0)
    week_start = week_start + timedelta(weeks=week_offset)

    st.markdown("---")

    # 주간 일정 조회
    week_events = get_week_events(user_id, week_start) if is_connected() else []

    # 요일별 표시
    for i in range(7):
        current_date = week_start + timedelta(days=i)
        weekday = get_weekday_korean(current_date)

        # 날짜 헤더
        if is_today(current_date):
            st.markdown(f"### 📌 {format_date_korean(current_date)} ({weekday}) - 오늘")
        else:
            st.markdown(f"### {format_date_korean(current_date)} ({weekday})")

        # 해당 날짜의 일정
        day_events = [e for e in week_events if e.event_date == current_date]

        if day_events:
            for event in day_events:
                render_event_card(event)
        else:
            st.caption("일정 없음")

        # 건강 플랜 표시
        if st.session_state.get('plan'):
            with st.expander("🎯 오늘의 건강 목표", expanded=is_today(current_date)):
                render_health_plan(current_date)

        # 빠른 일정 추가
        if st.button(f"➕ 일정 추가", key=f"add_{current_date}"):
            st.session_state.show_add_form = True
            st.session_state.add_date = current_date
            st.rerun()

        st.markdown("---")

# 월간 뷰
else:
    today = date.today()
    year = st.session_state.get('selected_year', today.year)
    month = st.session_state.get('selected_month', today.month)

    # 월 네비게이션
    col1, col2, col3 = st.columns([1, 3, 1])
    with col1:
        if st.button("◀ 이전 달"):
            if month == 1:
                st.session_state.selected_month = 12
                st.session_state.selected_year = year - 1
            else:
                st.session_state.selected_month = month - 1
            st.rerun()

    with col2:
        st.markdown(f"### 📆 {year}년 {month}월")

    with col3:
        if st.button("다음 달 ▶"):
            if month == 12:
                st.session_state.selected_month = 1
                st.session_state.selected_year = year + 1
            else:
                st.session_state.selected_month = month + 1
            st.rerun()

    year = st.session_state.get('selected_year', today.year)
    month = st.session_state.get('selected_month', today.month)

    st.markdown("---")

    # 월간 일정 조회
    month_events = get_month_events(user_id, year, month) if is_connected() else []

    # 요일 헤더
    weekdays = ["월", "화", "수", "목", "금", "토", "일"]
    cols = st.columns(7)
    for i, col in enumerate(cols):
        with col:
            color = "red" if i == 6 else ("blue" if i == 5 else "black")
            st.markdown(f"<p style='text-align:center; color:{color};'><b>{weekdays[i]}</b></p>", unsafe_allow_html=True)

    # 월간 캘린더
    month_calendar = get_month_calendar(year, month)

    for week in month_calendar:
        cols = st.columns(7)
        for i, d in enumerate(week):
            with cols[i]:
                if d is None:
                    st.markdown("")
                else:
                    # 날짜별 일정 수
                    day_events = [e for e in month_events if e.event_date == d]
                    event_count = len(day_events)

                    # 배경색 설정
                    if is_today(d):
                        bg_color = "#E3F2FD"
                        border = "2px solid #1976D2"
                    elif is_past(d):
                        bg_color = "#F5F5F5"
                        border = "1px solid #E0E0E0"
                    else:
                        bg_color = "#FFFFFF"
                        border = "1px solid #E0E0E0"

                    # 일정이 있는 날 표시
                    event_dots = ""
                    if event_count > 0:
                        dots = min(event_count, 3)
                        event_dots = "🔵" * dots
                        if event_count > 3:
                            event_dots += f"+{event_count - 3}"

                    st.markdown(f"""
                    <div style="
                        background-color: {bg_color};
                        padding: 8px;
                        border-radius: 8px;
                        margin: 2px;
                        min-height: 60px;
                        border: {border};
                        text-align: center;
                    ">
                        <div style="font-weight: bold;">{d.day}</div>
                        <div style="font-size: 0.7em;">{event_dots}</div>
                    </div>
                    """, unsafe_allow_html=True)

    st.markdown("---")

    # 선택된 날짜의 일정 (오늘 기본)
    st.markdown("### 📋 오늘의 일정")

    today_events = [e for e in month_events if e.event_date == today] if month_events else (get_events_by_date(user_id, today) if is_connected() else [])

    if today_events:
        for event in today_events:
            render_event_card(event)
    else:
        st.info("오늘 예정된 일정이 없습니다.")

    # 건강 플랜
    if st.session_state.get('plan'):
        st.markdown("### 🎯 오늘의 건강 목표")
        render_health_plan(today)

# 빠른 네비게이션
st.markdown("---")
col1, col2, col3 = st.columns(3)
with col1:
    if st.button("✅ 오늘의 미션", use_container_width=True, type="primary"):
        st.switch_page("pages/4_✅_daily.py")
with col2:
    if st.button("📊 주간 리뷰", use_container_width=True):
        st.switch_page("pages/5_📊_review.py")
with col3:
    if st.button("📋 플랜 & AI 상담", use_container_width=True):
        st.switch_page("pages/2_📋_plan.py")

# 사이드바
with st.sidebar:
    st.markdown("### 📌 카테고리")
    for cat_id, cat_info in CATEGORY_CONFIG.items():
        st.markdown(f"{cat_info['icon']} {cat_info['label']}")

    st.markdown("---")

    st.markdown("### 📊 이번 주 요약")

    week_start, _ = get_current_week_dates()
    week_offset = st.session_state.get('selected_week_offset', 0)
    week_start = week_start + timedelta(weeks=week_offset)

    week_events = get_week_events(user_id, week_start) if is_connected() else []

    st.metric("총 일정", f"{len(week_events)}개")

    # 카테고리별 통계
    cat_counts = {}
    for event in week_events:
        cat = event.category
        cat_counts[cat] = cat_counts.get(cat, 0) + 1

    for cat_id, count in cat_counts.items():
        if cat_id in CATEGORY_CONFIG:
            st.caption(f"{CATEGORY_CONFIG[cat_id]['icon']} {CATEGORY_CONFIG[cat_id]['label']}: {count}개")

    st.markdown("---")

    st.markdown("### 💡 팁")
    st.markdown("""
    - 일정을 추가하면 AI가 건강 플랜을 자동 조율해요
    - 중요한 일정은 우선순위를 '높음'으로 설정하세요
    - 종일 일정은 시간 충돌 없이 추가됩니다
    """)
