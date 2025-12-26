"""
날짜/시간 유틸리티
"""
from datetime import date, datetime, timedelta
from typing import Tuple, List


# 요일 한글 변환
WEEKDAY_KOREAN = {
    0: "월",
    1: "화",
    2: "수",
    3: "목",
    4: "금",
    5: "토",
    6: "일"
}


def get_weekday_korean(d: date) -> str:
    """날짜의 한글 요일 반환"""
    return WEEKDAY_KOREAN.get(d.weekday(), "")


def format_date_korean(d: date) -> str:
    """날짜를 한글 형식으로 포맷 (예: 12월 25일 (월))"""
    weekday = get_weekday_korean(d)
    return f"{d.month}월 {d.day}일 ({weekday})"


def format_date_short(d: date) -> str:
    """날짜를 짧은 형식으로 포맷 (예: 12/25)"""
    return f"{d.month}/{d.day}"


def get_current_week_dates() -> Tuple[date, date]:
    """현재 주의 시작일(월요일)과 종료일(일요일) 반환"""
    today = date.today()
    start_of_week = today - timedelta(days=today.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    return start_of_week, end_of_week


def get_week_dates(reference_date: date) -> Tuple[date, date]:
    """특정 날짜가 속한 주의 시작일과 종료일 반환"""
    start_of_week = reference_date - timedelta(days=reference_date.weekday())
    end_of_week = start_of_week + timedelta(days=6)
    return start_of_week, end_of_week


def get_week_number(start_date: date, current_date: date = None) -> int:
    """시작일 기준 현재 주차 계산"""
    if current_date is None:
        current_date = date.today()

    days_elapsed = (current_date - start_date).days
    return (days_elapsed // 7) + 1


def get_dates_in_range(start_date: date, end_date: date) -> List[date]:
    """날짜 범위 내의 모든 날짜 리스트 반환"""
    dates = []
    current = start_date
    while current <= end_date:
        dates.append(current)
        current += timedelta(days=1)
    return dates


def get_month_calendar(year: int, month: int) -> List[List[date]]:
    """해당 월의 캘린더 (주별 리스트) 반환"""
    import calendar

    cal = calendar.Calendar(firstweekday=0)  # 월요일 시작
    month_days = cal.monthdayscalendar(year, month)

    result = []
    for week in month_days:
        week_dates = []
        for day in week:
            if day == 0:
                week_dates.append(None)
            else:
                week_dates.append(date(year, month, day))
        result.append(week_dates)

    return result


def is_today(d: date) -> bool:
    """오늘인지 확인"""
    return d == date.today()


def is_past(d: date) -> bool:
    """과거인지 확인"""
    return d < date.today()


def is_future(d: date) -> bool:
    """미래인지 확인"""
    return d > date.today()


def days_until(target_date: date) -> int:
    """목표 날짜까지 남은 일수"""
    return (target_date - date.today()).days


def days_since(past_date: date) -> int:
    """과거 날짜로부터 경과한 일수"""
    return (date.today() - past_date).days
