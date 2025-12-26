"""
데이터 모델 (Pydantic)
"""
from datetime import date, datetime, time
from typing import Optional, List, Any
from pydantic import BaseModel, Field
from enum import Enum


class GoalType(str, Enum):
    """목표 유형"""
    WEIGHT = "weight"
    EXERCISE = "exercise"
    DIET = "diet"
    SLEEP = "sleep"


class GoalStatus(str, Enum):
    """목표 상태"""
    ACTIVE = "active"
    COMPLETED = "completed"
    PAUSED = "paused"
    CANCELLED = "cancelled"


class MissionType(str, Enum):
    """미션 유형"""
    EXERCISE = "exercise"
    DIET = "diet"
    SLEEP = "sleep"


class User(BaseModel):
    """사용자 모델"""
    id: Optional[str] = None
    phone: str  # 전화번호 (로그인 ID)
    password_hash: Optional[str] = None  # 비밀번호 해시 (응답에서 제외 가능)
    name: str  # 실명
    nickname: str  # 닉네임
    is_active: bool = True  # 계정 활성화 상태
    last_login_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Goal(BaseModel):
    """목표 모델"""
    id: Optional[str] = None
    user_id: str
    goal_type: GoalType
    target_description: str
    duration_weeks: int = 12
    start_date: date = Field(default_factory=date.today)
    end_date: Optional[date] = None
    status: GoalStatus = GoalStatus.ACTIVE
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Plan(BaseModel):
    """플랜 모델"""
    id: Optional[str] = None
    user_id: str
    goal_id: str
    week_number: int
    plan_type: MissionType
    plan_content: dict  # JSON 형태의 플랜 내용
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Mission(BaseModel):
    """미션 모델"""
    id: Optional[str] = None
    user_id: str
    plan_id: Optional[str] = None
    mission_date: date
    mission_type: MissionType
    title: str
    description: Optional[str] = None
    completed: bool = False
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None


class MissionLog(BaseModel):
    """미션 로그 모델"""
    id: Optional[str] = None
    mission_id: str
    user_id: str
    action: str  # 'check' or 'uncheck'
    logged_at: Optional[datetime] = None


class Conversation(BaseModel):
    """대화 기록 모델"""
    id: Optional[str] = None
    user_id: str
    role: str  # 'user', 'assistant', 'system'
    content: str
    agent_type: Optional[str] = None  # 'orchestrator', 'pt', 'diet', 'sleep', 'watcher'
    created_at: Optional[datetime] = None


class WatcherIntervention(BaseModel):
    """감시자 개입 기록 모델"""
    id: Optional[str] = None
    user_id: str
    intervention_type: str  # 'onboarding_stuck', 'plan_dissatisfaction', 'execution_dropout'
    intervention_message: Optional[str] = None
    user_response: Optional[str] = None
    created_at: Optional[datetime] = None


class WeeklyReview(BaseModel):
    """주간 리뷰 모델"""
    id: Optional[str] = None
    user_id: str
    goal_id: str
    week_number: int
    week_start_date: date
    week_end_date: date
    exercise_completion_rate: Optional[float] = None
    diet_completion_rate: Optional[float] = None
    sleep_completion_rate: Optional[float] = None
    overall_completion_rate: Optional[float] = None
    ai_feedback: Optional[str] = None
    user_reflection: Optional[str] = None
    created_at: Optional[datetime] = None


# 응답용 모델
class DailyMissionSummary(BaseModel):
    """일일 미션 요약"""
    date: date
    total_missions: int
    completed_missions: int
    completion_rate: float
    missions: List[Mission]


class WeeklyPlanSummary(BaseModel):
    """주간 플랜 요약"""
    week_number: int
    exercise_plan: Optional[dict] = None
    diet_plan: Optional[dict] = None
    sleep_plan: Optional[dict] = None


class EventCategory(str, Enum):
    """일정 카테고리"""
    WORK = "work"
    PERSONAL = "personal"
    SOCIAL = "social"
    HEALTH = "health"
    OTHER = "other"


class EventPriority(str, Enum):
    """일정 우선순위"""
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class Event(BaseModel):
    """개인 일정 모델"""
    id: Optional[str] = None
    user_id: str
    title: str
    description: Optional[str] = None
    event_date: date
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_all_day: bool = False
    category: EventCategory = EventCategory.PERSONAL
    priority: EventPriority = EventPriority.NORMAL
    location: Optional[str] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None
    reminder_minutes: Optional[int] = None
    color: str = "#3788d8"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ScheduleAdjustment(BaseModel):
    """AI 일정 조율 로그 모델"""
    id: Optional[str] = None
    user_id: str
    event_id: Optional[str] = None
    adjustment_date: date
    original_plan: Optional[dict] = None
    adjusted_plan: Optional[dict] = None
    reason: Optional[str] = None
    ai_suggestion: Optional[str] = None
    user_approved: bool = False
    created_at: Optional[datetime] = None
