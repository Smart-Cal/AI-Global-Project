"""
사용자 행동 추적
"""
import time
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Any
from collections import defaultdict


class UserTracker:
    """사용자 행동 추적기"""

    def __init__(self):
        self.events: List[Dict] = []
        self.session_start = time.time()
        self.page_views: Dict[str, int] = defaultdict(int)
        self.action_counts: Dict[str, int] = defaultdict(int)

    def track_event(self, event_type: str, data: Dict = None):
        """
        이벤트 추적

        Args:
            event_type: 이벤트 타입
            data: 추가 데이터
        """
        event = {
            "type": event_type,
            "timestamp": time.time(),
            "datetime": datetime.now().isoformat(),
            "data": data or {}
        }
        self.events.append(event)

        # 액션 카운트 업데이트
        self.action_counts[event_type] += 1

    def track_page_view(self, page_name: str):
        """
        페이지 뷰 추적

        Args:
            page_name: 페이지 이름
        """
        self.page_views[page_name] += 1
        self.track_event("page_view", {"page": page_name})

    def track_mission_check(self, mission_id: str, completed: bool):
        """
        미션 체크 추적

        Args:
            mission_id: 미션 ID
            completed: 완료 여부
        """
        self.track_event("mission_check", {
            "mission_id": mission_id,
            "completed": completed
        })

    def track_plan_revision(self, revision_count: int, feedback: str = None):
        """
        플랜 수정 추적

        Args:
            revision_count: 수정 횟수
            feedback: 사용자 피드백
        """
        self.track_event("plan_revision", {
            "revision_count": revision_count,
            "feedback": feedback
        })

    def track_chat_message(self, role: str, message_length: int):
        """
        채팅 메시지 추적

        Args:
            role: 역할 (user/assistant)
            message_length: 메시지 길이
        """
        self.track_event("chat_message", {
            "role": role,
            "length": message_length
        })

    def track_intervention(self, intervention_type: str, user_response: str = None):
        """
        감시자 개입 추적

        Args:
            intervention_type: 개입 타입
            user_response: 사용자 응답
        """
        self.track_event("intervention", {
            "type": intervention_type,
            "response": user_response
        })

    def get_session_duration(self) -> float:
        """세션 지속 시간 (초) 반환"""
        return time.time() - self.session_start

    def get_session_duration_formatted(self) -> str:
        """세션 지속 시간 포맷팅"""
        duration = self.get_session_duration()
        minutes = int(duration // 60)
        seconds = int(duration % 60)
        return f"{minutes}분 {seconds}초"

    def get_events_by_type(self, event_type: str) -> List[Dict]:
        """특정 타입의 이벤트 조회"""
        return [e for e in self.events if e["type"] == event_type]

    def get_recent_events(self, count: int = 10) -> List[Dict]:
        """최근 이벤트 조회"""
        return self.events[-count:]

    def get_stats(self) -> Dict:
        """통계 반환"""
        return {
            "total_events": len(self.events),
            "session_duration": self.get_session_duration(),
            "page_views": dict(self.page_views),
            "action_counts": dict(self.action_counts)
        }

    def get_engagement_score(self) -> float:
        """
        참여도 점수 계산 (0-100)

        기준:
        - 페이지 뷰 수
        - 미션 체크 수
        - 세션 시간
        - 채팅 메시지 수
        """
        score = 0

        # 페이지 뷰 점수 (최대 20점)
        total_views = sum(self.page_views.values())
        score += min(total_views * 2, 20)

        # 미션 체크 점수 (최대 30점)
        mission_checks = self.action_counts.get("mission_check", 0)
        score += min(mission_checks * 5, 30)

        # 세션 시간 점수 (최대 20점)
        duration_minutes = self.get_session_duration() / 60
        score += min(duration_minutes * 2, 20)

        # 채팅 메시지 점수 (최대 20점)
        chat_messages = self.action_counts.get("chat_message", 0)
        score += min(chat_messages * 2, 20)

        # 플랜 수정 감점 (최대 -10점)
        plan_revisions = self.action_counts.get("plan_revision", 0)
        score -= min(plan_revisions * 5, 10)

        return max(0, min(100, score))

    def get_behavior_insights(self) -> Dict:
        """행동 인사이트 반환"""
        insights = []

        # 자주 방문한 페이지
        most_visited = max(self.page_views.items(), key=lambda x: x[1], default=(None, 0))
        if most_visited[0]:
            insights.append(f"가장 자주 방문한 페이지: {most_visited[0]}")

        # 미션 완료율
        mission_events = self.get_events_by_type("mission_check")
        if mission_events:
            completed = sum(1 for e in mission_events if e["data"].get("completed"))
            rate = completed / len(mission_events) * 100
            insights.append(f"미션 완료율: {rate:.1f}%")

        # 활동 패턴
        if self.get_session_duration() > 600:  # 10분 이상
            insights.append("장시간 활동 중")
        elif self.get_session_duration() < 60:  # 1분 미만
            insights.append("짧은 방문")

        return {
            "insights": insights,
            "engagement_score": self.get_engagement_score(),
            "stats": self.get_stats()
        }

    def clear(self):
        """추적 데이터 초기화"""
        self.events.clear()
        self.page_views.clear()
        self.action_counts.clear()
        self.session_start = time.time()


# 싱글톤 인스턴스
_tracker_instance = None


def get_tracker() -> UserTracker:
    """UserTracker 싱글톤 인스턴스 반환"""
    global _tracker_instance
    if _tracker_instance is None:
        _tracker_instance = UserTracker()
    return _tracker_instance
