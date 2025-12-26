"""
포맷팅 함수들
"""
from typing import Optional


# 목표 유형 매핑
GOAL_TYPE_MAP = {
    "weight": {"label": "🏃 체중/체형 관리", "icon": "🏃", "short": "체중"},
    "exercise": {"label": "💪 운동 습관 만들기", "icon": "💪", "short": "운동"},
    "diet": {"label": "🥗 식단 관리", "icon": "🥗", "short": "식단"},
    "sleep": {"label": "😴 수면 패턴 개선", "icon": "😴", "short": "수면"}
}

# 미션 유형 매핑
MISSION_TYPE_MAP = {
    "exercise": {"label": "운동", "icon": "🏋️", "color": "#FF6B6B"},
    "diet": {"label": "식단", "icon": "🥗", "color": "#4ECDC4"},
    "sleep": {"label": "수면", "icon": "😴", "color": "#9B59B6"}
}


def format_goal_type(goal_type: str, format_type: str = "label") -> str:
    """
    목표 유형 포맷팅

    Args:
        goal_type: 목표 유형 (weight, exercise, diet, sleep)
        format_type: 포맷 타입 (label, icon, short)

    Returns:
        포맷팅된 문자열
    """
    if goal_type not in GOAL_TYPE_MAP:
        return goal_type

    return GOAL_TYPE_MAP[goal_type].get(format_type, goal_type)


def format_mission_type(mission_type: str, format_type: str = "label") -> str:
    """
    미션 유형 포맷팅

    Args:
        mission_type: 미션 유형 (exercise, diet, sleep)
        format_type: 포맷 타입 (label, icon, color)

    Returns:
        포맷팅된 문자열
    """
    if mission_type not in MISSION_TYPE_MAP:
        return mission_type

    return MISSION_TYPE_MAP[mission_type].get(format_type, mission_type)


def format_completion_rate(rate: float) -> str:
    """완료율 포맷팅 (예: 85.5%)"""
    return f"{rate:.1f}%"


def format_duration_weeks(weeks: int) -> str:
    """기간 포맷팅 (예: 12주 (약 3개월))"""
    months = weeks // 4
    if months > 0:
        return f"{weeks}주 (약 {months}개월)"
    return f"{weeks}주"


def get_progress_emoji(rate: float) -> str:
    """완료율에 따른 이모지 반환"""
    if rate >= 90:
        return "🔥"
    elif rate >= 70:
        return "👍"
    elif rate >= 50:
        return "💪"
    elif rate >= 30:
        return "🚶"
    else:
        return "😓"


def format_streak(days: int) -> str:
    """연속 달성일 포맷팅"""
    if days == 0:
        return "아직 시작 전"
    elif days == 1:
        return "1일째 도전 중!"
    else:
        return f"{days}일 연속 달성 중! 🔥"


def truncate_text(text: str, max_length: int = 50) -> str:
    """텍스트 자르기"""
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + "..."


def format_time_ago(seconds: float) -> str:
    """경과 시간 포맷팅"""
    if seconds < 60:
        return "방금 전"
    elif seconds < 3600:
        minutes = int(seconds // 60)
        return f"{minutes}분 전"
    elif seconds < 86400:
        hours = int(seconds // 3600)
        return f"{hours}시간 전"
    else:
        days = int(seconds // 86400)
        return f"{days}일 전"
