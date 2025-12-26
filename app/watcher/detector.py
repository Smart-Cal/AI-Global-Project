"""
이탈/막힘 감지 로직
- 3분 정체 감지
- 플랜 수정 반복 감지
- 3일 미체크 감지
"""
import time
from datetime import datetime, timedelta, date
from typing import Optional, Dict, Any
import streamlit as st


class WatcherDetector:
    """사용자 이탈/막힘 감지기"""

    # 감지 임계값
    ONBOARDING_STUCK_TIMEOUT = 180  # 3분 (초)
    PLAN_REVISION_THRESHOLD = 2  # 플랜 수정 횟수
    EXECUTION_DROPOUT_DAYS = 3  # 연속 미체크 일수

    def __init__(self):
        self.last_check_time = time.time()

    def check_all(self, session_state: Dict[str, Any], db=None) -> Optional[str]:
        """
        모든 이탈/막힘 상황 체크

        Args:
            session_state: Streamlit 세션 상태
            db: 데이터베이스 연결 (선택)

        Returns:
            감지된 상황 타입 또는 None
        """
        # 온보딩 정체 체크
        if self.check_onboarding_stuck(session_state):
            return "onboarding_stuck"

        # 플랜 불만족 체크
        if self.check_plan_dissatisfaction(session_state):
            return "plan_dissatisfaction"

        # 실행 이탈 체크
        if db:
            user_id = session_state.get('user_id')
            if user_id and self.check_execution_dropout(user_id, db):
                return "execution_dropout"

        return None

    def check_onboarding_stuck(self, session_state: Dict[str, Any]) -> bool:
        """
        온보딩 3분 정체 감지

        사용자가 온보딩 화면에서 3분 이상 아무 입력이 없을 때 감지

        Args:
            session_state: 세션 상태

        Returns:
            정체 여부
        """
        # 이미 목표가 설정되었으면 체크 불필요
        if session_state.get('goal_saved'):
            return False

        # 현재 단계가 온보딩이 아니면 체크 불필요
        current_step = session_state.get('current_step', 'landing')
        if current_step not in ['landing', 'onboarding']:
            return False

        # 마지막 입력 시간 확인
        last_input = session_state.get('last_input_time')
        if last_input is None:
            return False

        # 3분 이상 경과 체크
        elapsed = time.time() - last_input
        if elapsed > self.ONBOARDING_STUCK_TIMEOUT:
            # 이미 개입했는지 확인
            if not session_state.get('onboarding_intervention_shown'):
                return True

        return False

    def check_plan_dissatisfaction(self, session_state: Dict[str, Any]) -> bool:
        """
        플랜 불만족 감지

        사용자가 플랜을 2회 이상 수정 요청했을 때 감지

        Args:
            session_state: 세션 상태

        Returns:
            불만족 감지 여부
        """
        revision_count = session_state.get('plan_revision_count', 0)

        if revision_count >= self.PLAN_REVISION_THRESHOLD:
            # 이미 개입했는지 확인
            if not session_state.get('plan_intervention_shown'):
                return True

        return False

    def check_execution_dropout(self, user_id: str, db) -> bool:
        """
        3일 연속 미체크 감지

        Args:
            user_id: 사용자 ID
            db: 데이터베이스 연결

        Returns:
            이탈 감지 여부
        """
        try:
            # 최근 3일간의 미션 체크 여부 확인
            from database.queries import get_uncompleted_missions_count

            uncompleted = get_uncompleted_missions_count(user_id, days=self.EXECUTION_DROPOUT_DAYS)

            # 모든 미션이 미완료인 경우
            if uncompleted > 0:
                return True

        except Exception as e:
            print(f"실행 이탈 체크 실패: {e}")

        return False

    def check_inactivity(self, session_state: Dict[str, Any], timeout_seconds: int = 300) -> bool:
        """
        일반적인 비활성 감지

        Args:
            session_state: 세션 상태
            timeout_seconds: 타임아웃 (초)

        Returns:
            비활성 여부
        """
        last_input = session_state.get('last_input_time')
        if last_input is None:
            return False

        return time.time() - last_input > timeout_seconds

    def reset_intervention_flags(self, session_state: Dict[str, Any], intervention_type: str):
        """
        개입 플래그 리셋

        Args:
            session_state: 세션 상태
            intervention_type: 개입 타입
        """
        flag_map = {
            'onboarding_stuck': 'onboarding_intervention_shown',
            'plan_dissatisfaction': 'plan_intervention_shown',
            'execution_dropout': 'execution_intervention_shown'
        }

        flag = flag_map.get(intervention_type)
        if flag:
            session_state[flag] = False

    def mark_intervention_shown(self, session_state: Dict[str, Any], intervention_type: str):
        """
        개입 표시 완료 마킹

        Args:
            session_state: 세션 상태
            intervention_type: 개입 타입
        """
        flag_map = {
            'onboarding_stuck': 'onboarding_intervention_shown',
            'plan_dissatisfaction': 'plan_intervention_shown',
            'execution_dropout': 'execution_intervention_shown'
        }

        flag = flag_map.get(intervention_type)
        if flag:
            session_state[flag] = True


# 싱글톤 인스턴스
_detector_instance = None


def get_detector() -> WatcherDetector:
    """WatcherDetector 싱글톤 인스턴스 반환"""
    global _detector_instance
    if _detector_instance is None:
        _detector_instance = WatcherDetector()
    return _detector_instance
