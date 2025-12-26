"""
Sleep Agent - 수면 관리
"""
import os
import json
import re
from typing import Optional
from openai import OpenAI
from .prompts import get_sleep_agent_prompt


class SleepAgent:
    """수면 코치 에이전트"""

    def __init__(self):
        self.client = None
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._init_client()

    def _init_client(self):
        """OpenAI 클라이언트 초기화"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key and api_key != "sk-xxxxx":
                self.client = OpenAI(api_key=api_key)
        except Exception as e:
            print(f"OpenAI 클라이언트 초기화 실패: {e}")
            self.client = None

    def generate(self, user_input: str, context: dict) -> dict:
        """
        수면 관련 응답 생성

        Args:
            user_input: 사용자 입력
            context: 사용자 컨텍스트 (닉네임, 목표 등)

        Returns:
            응답 딕셔너리 {"agent": "SLEEP", "message": str, "plan": dict}
        """
        if not self.client:
            return self._get_fallback_response(context)

        prompt = get_sleep_agent_prompt(context)

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=2048,
                messages=[
                    {"role": "system", "content": prompt},
                    {"role": "user", "content": user_input}
                ]
            )

            response_text = response.choices[0].message.content

            # JSON 추출 시도
            plan = self._extract_json(response_text)

            return {
                "agent": "SLEEP",
                "message": response_text,
                "plan": plan,
                "success": True
            }

        except Exception as e:
            print(f"Sleep Agent 응답 생성 실패: {e}")
            return self._get_fallback_response(context)

    def generate_weekly_plan(self, context: dict, week_number: int = 1) -> dict:
        """
        주간 수면 플랜 생성

        Args:
            context: 사용자 컨텍스트
            week_number: 주차

        Returns:
            주간 플랜 딕셔너리
        """
        user_input = f"""
        {week_number}주차 수면 개선 플랜을 생성해주세요.
        목표: {context.get('goal', '수면 패턴 개선')}

        JSON 형식으로 수면 계획을 제공해주세요.
        """

        result = self.generate(user_input, context)
        return result.get("plan", self._get_default_plan())

    def _extract_json(self, text: str) -> Optional[dict]:
        """텍스트에서 JSON 추출"""
        try:
            json_match = re.search(r'\{[\s\S]*\}', text)
            if json_match:
                return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass
        return None

    def _get_fallback_response(self, context: dict) -> dict:
        """API 호출 실패 시 기본 응답"""
        nickname = context.get("nickname", "회원")
        return {
            "agent": "SLEEP",
            "message": f"{nickname}님, 수면 플랜을 준비 중입니다! 😴",
            "plan": self._get_default_plan(),
            "success": False
        }

    def _get_default_plan(self) -> dict:
        """기본 수면 플랜"""
        return {
            "sleep_schedule": {
                "target_bedtime": "23:00",
                "target_waketime": "07:00",
                "sleep_duration": "8시간"
            },
            "pre_sleep_routine": [
                "취침 2시간 전: 카페인 섭취 중단",
                "취침 1시간 전: 스마트폰/PC 사용 줄이기",
                "취침 30분 전: 가벼운 스트레칭 또는 명상",
                "취침 직전: 따뜻한 물 한 잔"
            ],
            "sleep_environment": [
                "침실 온도: 18-22도 유지",
                "조명: 완전히 어둡게",
                "소음: 조용한 환경 또는 백색소음"
            ],
            "sleep_tips": [
                "매일 같은 시간에 자고 일어나세요",
                "주말에도 기상 시간을 유지하세요",
                "낮잠은 20분 이내로 제한하세요",
                "침대는 수면과 휴식만을 위해 사용하세요"
            ],
            "things_to_avoid": [
                "취침 전 격한 운동",
                "늦은 시간 과식",
                "취침 전 알코올",
                "밤새 고민하기"
            ],
            "morning_routine": [
                "기상 직후 햇빛 쬐기",
                "가벼운 스트레칭",
                "아침 식사 챙기기"
            ]
        }


# 싱글톤 인스턴스
_sleep_agent_instance = None


def get_sleep_agent() -> SleepAgent:
    """Sleep Agent 싱글톤 인스턴스 반환"""
    global _sleep_agent_instance
    if _sleep_agent_instance is None:
        _sleep_agent_instance = SleepAgent()
    return _sleep_agent_instance
