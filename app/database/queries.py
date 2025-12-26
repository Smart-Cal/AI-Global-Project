"""
DB 쿼리 함수들
"""
import hashlib
from datetime import date, datetime, timedelta
from typing import Optional, List
from .connection import get_supabase
from .models import User, Goal, Plan, Mission, GoalType, MissionType, Event, ScheduleAdjustment


# ============== 비밀번호 해싱 ==============

def hash_password(password: str) -> str:
    """비밀번호 해싱 (SHA256)"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """비밀번호 검증"""
    return hash_password(password) == password_hash


# ============== 사용자 관련 쿼리 ==============

def check_phone_exists(phone: str) -> bool:
    """전화번호 중복 확인"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        result = supabase.table("users").select("id").eq("phone", phone).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"전화번호 확인 실패: {e}")
        return False


def register_user(phone: str, password: str, name: str, nickname: str) -> Optional[User]:
    """새 사용자 회원가입"""
    supabase = get_supabase()
    if not supabase:
        return None

    # 전화번호 중복 확인
    if check_phone_exists(phone):
        print("이미 등록된 전화번호입니다.")
        return None

    try:
        result = supabase.table("users").insert({
            "phone": phone,
            "password_hash": hash_password(password),
            "name": name,
            "nickname": nickname,
            "is_active": True
        }).execute()

        if result.data:
            user_data = result.data[0]
            return User(**user_data)
        return None
    except Exception as e:
        print(f"회원가입 실패: {e}")
        return None


def login_user(phone: str, password: str) -> Optional[User]:
    """사용자 로그인"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("users").select("*").eq("phone", phone).eq("is_active", True).execute()

        if not result.data:
            return None

        user_data = result.data[0]

        # 비밀번호 확인
        if not verify_password(password, user_data.get("password_hash", "")):
            return None

        # 마지막 로그인 시간 업데이트
        supabase.table("users").update({
            "last_login_at": datetime.now().isoformat()
        }).eq("id", user_data["id"]).execute()

        return User(**user_data)
    except Exception as e:
        print(f"로그인 실패: {e}")
        return None


def create_user(phone: str, password: str, name: str, nickname: str) -> Optional[User]:
    """새 사용자 생성 (register_user의 별칭)"""
    return register_user(phone, password, name, nickname)


def get_user(user_id: str) -> Optional[User]:
    """사용자 조회"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("users").select("*").eq("id", user_id).execute()

        if result.data:
            return User(**result.data[0])
        return None
    except Exception as e:
        print(f"사용자 조회 실패: {e}")
        return None


def get_user_by_phone(phone: str) -> Optional[User]:
    """전화번호로 사용자 조회"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("users").select("*").eq("phone", phone).execute()

        if result.data:
            return User(**result.data[0])
        return None
    except Exception as e:
        print(f"사용자 조회 실패: {e}")
        return None


def get_user_by_nickname(nickname: str) -> Optional[User]:
    """닉네임으로 사용자 조회"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("users").select("*").eq("nickname", nickname).execute()

        if result.data:
            return User(**result.data[0])
        return None
    except Exception as e:
        print(f"사용자 조회 실패: {e}")
        return None


def update_user_nickname(user_id: str, nickname: str) -> bool:
    """사용자 닉네임 업데이트"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        result = supabase.table("users").update({
            "nickname": nickname,
            "updated_at": datetime.now().isoformat()
        }).eq("id", user_id).execute()

        return len(result.data) > 0
    except Exception as e:
        print(f"닉네임 업데이트 실패: {e}")
        return False


# ============== 목표 관련 쿼리 ==============

def save_goal(user_id: str, goal_type: str, target_description: str, duration_weeks: int) -> Optional[Goal]:
    """목표 저장"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        start_date = date.today()
        end_date = start_date + timedelta(weeks=duration_weeks)

        result = supabase.table("goals").insert({
            "user_id": user_id,
            "goal_type": goal_type,
            "target_description": target_description,
            "duration_weeks": duration_weeks,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "status": "active"
        }).execute()

        if result.data:
            return Goal(**result.data[0])
        return None
    except Exception as e:
        print(f"목표 저장 실패: {e}")
        return None


def get_user_goals(user_id: str, status: str = None) -> List[Goal]:
    """사용자의 목표 목록 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        query = supabase.table("goals").select("*").eq("user_id", user_id)

        if status:
            query = query.eq("status", status)

        result = query.order("created_at", desc=True).execute()

        return [Goal(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"목표 조회 실패: {e}")
        return []


def get_active_goal(user_id: str) -> Optional[Goal]:
    """활성화된 목표 조회"""
    goals = get_user_goals(user_id, status="active")
    return goals[0] if goals else None


# ============== 플랜 관련 쿼리 ==============

def save_plan(user_id: str, goal_id: str, week_number: int, plan_type: str, plan_content: dict) -> Optional[Plan]:
    """플랜 저장"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("plans").insert({
            "user_id": user_id,
            "goal_id": goal_id,
            "week_number": week_number,
            "plan_type": plan_type,
            "plan_content": plan_content
        }).execute()

        if result.data:
            return Plan(**result.data[0])
        return None
    except Exception as e:
        print(f"플랜 저장 실패: {e}")
        return None


def get_user_plans(user_id: str, goal_id: str = None) -> List[Plan]:
    """사용자의 플랜 목록 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        query = supabase.table("plans").select("*").eq("user_id", user_id)

        if goal_id:
            query = query.eq("goal_id", goal_id)

        result = query.order("week_number", desc=False).execute()

        return [Plan(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"플랜 조회 실패: {e}")
        return []


def get_current_week_plans(user_id: str, goal_id: str) -> List[Plan]:
    """현재 주차 플랜 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    goal = get_active_goal(user_id)
    if not goal:
        return []

    # 현재 주차 계산
    days_elapsed = (date.today() - goal.start_date).days
    current_week = (days_elapsed // 7) + 1

    try:
        result = supabase.table("plans").select("*").eq("user_id", user_id).eq("goal_id", goal_id).eq("week_number", current_week).execute()

        return [Plan(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"플랜 조회 실패: {e}")
        return []


def get_latest_plan(user_id: str, goal_id: str) -> Optional[dict]:
    """가장 최근 주차의 통합 플랜 조회"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        # 가장 최근 주차 플랜들 조회
        result = supabase.table("plans").select("*").eq("user_id", user_id).eq("goal_id", goal_id).order("week_number", desc=True).execute()

        if not result.data:
            return None

        # 가장 큰 week_number 찾기
        latest_week = result.data[0]["week_number"]

        # 해당 주차의 모든 플랜 통합
        full_plan = {"week_number": latest_week}
        for plan_data in result.data:
            if plan_data["week_number"] == latest_week:
                plan_type = plan_data["plan_type"]
                full_plan[plan_type] = plan_data["plan_content"]

        return full_plan
    except Exception as e:
        print(f"최신 플랜 조회 실패: {e}")
        return None


def get_current_week_number(user_id: str) -> int:
    """현재 주차 계산"""
    goal = get_active_goal(user_id)
    if not goal:
        return 1

    days_elapsed = (date.today() - goal.start_date).days
    current_week = (days_elapsed // 7) + 1
    return current_week


# ============== 미션 관련 쿼리 ==============

def save_mission(user_id: str, plan_id: str, mission_date: date, mission_type: str, title: str, description: str = None) -> Optional[Mission]:
    """미션 저장"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("missions").insert({
            "user_id": user_id,
            "plan_id": plan_id,
            "mission_date": mission_date.isoformat(),
            "mission_type": mission_type,
            "title": title,
            "description": description,
            "completed": False
        }).execute()

        if result.data:
            return Mission(**result.data[0])
        return None
    except Exception as e:
        print(f"미션 저장 실패: {e}")
        return None


def get_missions_by_date(user_id: str, mission_date: date) -> List[Mission]:
    """특정 날짜의 미션 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        result = supabase.table("missions").select("*").eq("user_id", user_id).eq("mission_date", mission_date.isoformat()).execute()

        return [Mission(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"미션 조회 실패: {e}")
        return []


def get_today_missions(user_id: str) -> List[Mission]:
    """오늘의 미션 조회"""
    return get_missions_by_date(user_id, date.today())


def update_mission_status(mission_id: str, completed: bool) -> bool:
    """미션 완료 상태 업데이트"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        update_data = {"completed": completed}
        if completed:
            update_data["completed_at"] = datetime.now().isoformat()
        else:
            update_data["completed_at"] = None

        result = supabase.table("missions").update(update_data).eq("id", mission_id).execute()

        return len(result.data) > 0
    except Exception as e:
        print(f"미션 상태 업데이트 실패: {e}")
        return False


def get_uncompleted_missions_count(user_id: str, days: int = 3) -> int:
    """최근 N일간 미완료 미션 수 조회"""
    supabase = get_supabase()
    if not supabase:
        return 0

    try:
        start_date = date.today() - timedelta(days=days)

        result = supabase.table("missions").select("id", count="exact").eq("user_id", user_id).eq("completed", False).gte("mission_date", start_date.isoformat()).lt("mission_date", date.today().isoformat()).execute()

        return result.count if result.count else 0
    except Exception as e:
        print(f"미완료 미션 수 조회 실패: {e}")
        return 0


# ============== 대화 기록 관련 쿼리 ==============

def save_conversation(user_id: str, role: str, content: str, agent_type: str = None) -> bool:
    """대화 기록 저장"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        supabase.table("conversations").insert({
            "user_id": user_id,
            "role": role,
            "content": content,
            "agent_type": agent_type
        }).execute()

        return True
    except Exception as e:
        print(f"대화 기록 저장 실패: {e}")
        return False


def get_recent_conversations(user_id: str, limit: int = 20) -> list:
    """최근 대화 기록 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        result = supabase.table("conversations").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()

        return result.data[::-1] if result.data else []  # 시간순 정렬
    except Exception as e:
        print(f"대화 기록 조회 실패: {e}")
        return []


# ============== 주간 리뷰 관련 쿼리 ==============

def calculate_weekly_completion_rate(user_id: str, week_start: date, week_end: date) -> dict:
    """주간 완료율 계산"""
    supabase = get_supabase()
    if not supabase:
        return {}

    try:
        result = supabase.table("missions").select("mission_type, completed").eq("user_id", user_id).gte("mission_date", week_start.isoformat()).lte("mission_date", week_end.isoformat()).execute()

        if not result.data:
            return {}

        # 유형별 완료율 계산
        stats = {"exercise": {"total": 0, "completed": 0}, "diet": {"total": 0, "completed": 0}, "sleep": {"total": 0, "completed": 0}}

        for mission in result.data:
            mission_type = mission["mission_type"]
            if mission_type in stats:
                stats[mission_type]["total"] += 1
                if mission["completed"]:
                    stats[mission_type]["completed"] += 1

        rates = {}
        for mission_type, data in stats.items():
            if data["total"] > 0:
                rates[f"{mission_type}_completion_rate"] = round(data["completed"] / data["total"] * 100, 2)
            else:
                rates[f"{mission_type}_completion_rate"] = 0

        # 전체 완료율
        total = sum(s["total"] for s in stats.values())
        completed = sum(s["completed"] for s in stats.values())
        rates["overall_completion_rate"] = round(completed / total * 100, 2) if total > 0 else 0

        return rates
    except Exception as e:
        print(f"주간 완료율 계산 실패: {e}")
        return {}


# ============== 일정(Events) 관련 쿼리 ==============

def create_event(
    user_id: str,
    title: str,
    event_date: date,
    description: str = None,
    start_time: str = None,
    end_time: str = None,
    is_all_day: bool = False,
    category: str = "personal",
    priority: str = "normal",
    location: str = None,
    color: str = "#3788d8"
) -> Optional[Event]:
    """일정 생성"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        event_data = {
            "user_id": user_id,
            "title": title,
            "event_date": event_date.isoformat(),
            "is_all_day": is_all_day,
            "category": category,
            "priority": priority,
            "color": color
        }

        if description:
            event_data["description"] = description
        if start_time:
            event_data["start_time"] = start_time
        if end_time:
            event_data["end_time"] = end_time
        if location:
            event_data["location"] = location

        result = supabase.table("events").insert(event_data).execute()

        if result.data:
            return Event(**result.data[0])
        return None
    except Exception as e:
        print(f"일정 생성 실패: {e}")
        return None


def get_events_by_date(user_id: str, event_date: date) -> List[Event]:
    """특정 날짜의 일정 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        result = supabase.table("events").select("*").eq("user_id", user_id).eq("event_date", event_date.isoformat()).order("start_time").execute()

        return [Event(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"일정 조회 실패: {e}")
        return []


def get_events_by_date_range(user_id: str, start_date: date, end_date: date) -> List[Event]:
    """날짜 범위의 일정 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        result = supabase.table("events").select("*").eq("user_id", user_id).gte("event_date", start_date.isoformat()).lte("event_date", end_date.isoformat()).order("event_date").order("start_time").execute()

        return [Event(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"일정 범위 조회 실패: {e}")
        return []


def get_event(event_id: str) -> Optional[Event]:
    """일정 단건 조회"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        result = supabase.table("events").select("*").eq("id", event_id).execute()

        if result.data:
            return Event(**result.data[0])
        return None
    except Exception as e:
        print(f"일정 조회 실패: {e}")
        return None


def update_event(event_id: str, **kwargs) -> Optional[Event]:
    """일정 수정"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        # 날짜/시간 필드 처리
        update_data = {}
        for key, value in kwargs.items():
            if value is not None:
                if isinstance(value, date):
                    update_data[key] = value.isoformat()
                else:
                    update_data[key] = value

        update_data["updated_at"] = datetime.now().isoformat()

        result = supabase.table("events").update(update_data).eq("id", event_id).execute()

        if result.data:
            return Event(**result.data[0])
        return None
    except Exception as e:
        print(f"일정 수정 실패: {e}")
        return None


def delete_event(event_id: str) -> bool:
    """일정 삭제"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        result = supabase.table("events").delete().eq("id", event_id).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"일정 삭제 실패: {e}")
        return False


def get_today_events(user_id: str) -> List[Event]:
    """오늘의 일정 조회"""
    return get_events_by_date(user_id, date.today())


def get_week_events(user_id: str, week_start: date = None) -> List[Event]:
    """주간 일정 조회"""
    if week_start is None:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

    week_end = week_start + timedelta(days=6)
    return get_events_by_date_range(user_id, week_start, week_end)


def get_month_events(user_id: str, year: int, month: int) -> List[Event]:
    """월간 일정 조회"""
    from calendar import monthrange

    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    return get_events_by_date_range(user_id, first_day, last_day)


def check_event_conflict(user_id: str, event_date: date, start_time: str, end_time: str, exclude_event_id: str = None) -> List[Event]:
    """일정 충돌 확인 (같은 시간대에 다른 일정이 있는지)"""
    events = get_events_by_date(user_id, event_date)

    conflicting_events = []
    for event in events:
        # 수정 중인 이벤트는 제외
        if exclude_event_id and event.id == exclude_event_id:
            continue

        # 종일 일정은 충돌로 간주하지 않음
        if event.is_all_day:
            continue

        # 시간이 없는 이벤트는 건너뜀
        if not event.start_time or not event.end_time:
            continue

        event_start = event.start_time.strftime("%H:%M") if hasattr(event.start_time, 'strftime') else str(event.start_time)[:5]
        event_end = event.end_time.strftime("%H:%M") if hasattr(event.end_time, 'strftime') else str(event.end_time)[:5]

        # 시간 겹침 확인
        if not (end_time <= event_start or start_time >= event_end):
            conflicting_events.append(event)

    return conflicting_events


# ============== 일정 조율 관련 쿼리 ==============

def save_schedule_adjustment(
    user_id: str,
    adjustment_date: date,
    original_plan: dict = None,
    adjusted_plan: dict = None,
    reason: str = None,
    ai_suggestion: str = None,
    event_id: str = None
) -> Optional[ScheduleAdjustment]:
    """일정 조율 기록 저장"""
    supabase = get_supabase()
    if not supabase:
        return None

    try:
        data = {
            "user_id": user_id,
            "adjustment_date": adjustment_date.isoformat(),
            "user_approved": False
        }

        if event_id:
            data["event_id"] = event_id
        if original_plan:
            data["original_plan"] = original_plan
        if adjusted_plan:
            data["adjusted_plan"] = adjusted_plan
        if reason:
            data["reason"] = reason
        if ai_suggestion:
            data["ai_suggestion"] = ai_suggestion

        result = supabase.table("schedule_adjustments").insert(data).execute()

        if result.data:
            return ScheduleAdjustment(**result.data[0])
        return None
    except Exception as e:
        print(f"일정 조율 기록 저장 실패: {e}")
        return None


def get_pending_adjustments(user_id: str) -> List[ScheduleAdjustment]:
    """승인 대기 중인 일정 조율 조회"""
    supabase = get_supabase()
    if not supabase:
        return []

    try:
        result = supabase.table("schedule_adjustments").select("*").eq("user_id", user_id).eq("user_approved", False).gte("adjustment_date", date.today().isoformat()).order("adjustment_date").execute()

        return [ScheduleAdjustment(**item) for item in result.data] if result.data else []
    except Exception as e:
        print(f"일정 조율 조회 실패: {e}")
        return []


def approve_adjustment(adjustment_id: str) -> bool:
    """일정 조율 승인"""
    supabase = get_supabase()
    if not supabase:
        return False

    try:
        result = supabase.table("schedule_adjustments").update({"user_approved": True}).eq("id", adjustment_id).execute()
        return len(result.data) > 0
    except Exception as e:
        print(f"일정 조율 승인 실패: {e}")
        return False
