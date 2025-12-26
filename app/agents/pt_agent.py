"""
PT Agent - 운동/체형 관리
"""
import os
import json
import re
from typing import Optional
from openai import OpenAI
from .prompts import get_pt_agent_prompt


class PTAgent:
    """퍼스널 트레이너 에이전트"""

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
        운동 관련 응답 생성

        Args:
            user_input: 사용자 입력
            context: 사용자 컨텍스트 (닉네임, 목표 등)

        Returns:
            응답 딕셔너리 {"agent": "PT", "message": str, "plan": dict}
        """
        if not self.client:
            return self._get_fallback_response(context)

        prompt = get_pt_agent_prompt(context)

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
                "agent": "PT",
                "message": response_text,
                "plan": plan,
                "success": True
            }

        except Exception as e:
            print(f"PT Agent 응답 생성 실패: {e}")
            return self._get_fallback_response(context)

    def generate_weekly_plan(self, context: dict, week_number: int = 1) -> dict:
        """
        주간 운동 플랜 생성

        Args:
            context: 사용자 컨텍스트
            week_number: 주차

        Returns:
            주간 플랜 딕셔너리
        """
        user_input = f"""
        {week_number}주차 운동 플랜을 생성해주세요.
        목표: {context.get('goal', '건강한 생활')}

        JSON 형식으로 주간 운동 계획을 제공해주세요.
        """

        result = self.generate(user_input, context)
        return result.get("plan", self._get_default_plan(week_number))

    def _extract_json(self, text: str) -> Optional[dict]:
        """텍스트에서 JSON 추출"""
        try:
            # JSON 블록 찾기
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
            "agent": "PT",
            "message": f"{nickname}님, 운동 플랜을 준비 중입니다. 잠시만 기다려주세요!",
            "plan": self._get_default_plan(1),
            "success": False
        }

    def _get_default_plan(self, week_number: int) -> dict:
        """기본 운동 플랜"""
        return {
            "week": week_number,
            "weekly_plan": [
                {"day": "월", "workout": "유산소 운동 30분 (걷기/조깅)", "duration": "30분", "intensity": "low"},
                {"day": "화", "workout": "상체 근력운동 (푸시업, 덤벨)", "duration": "40분", "intensity": "medium"},
                {"day": "수", "workout": "휴식 또는 가벼운 스트레칭", "duration": "15분", "intensity": "low"},
                {"day": "목", "workout": "유산소 운동 30분", "duration": "30분", "intensity": "medium"},
                {"day": "금", "workout": "하체 근력운동 (스쿼트, 런지)", "duration": "40분", "intensity": "medium"},
                {"day": "토", "workout": "자유 운동 또는 야외 활동", "duration": "자유", "intensity": "low"},
                {"day": "일", "workout": "완전 휴식", "duration": "-", "intensity": "rest"}
            ],
            "tips": [
                "운동 전 5분 워밍업을 꼭 해주세요",
                "충분한 수분 섭취를 잊지 마세요",
                "무리하지 말고 본인 페이스에 맞춰 진행하세요"
            ],
            "motivation": "꾸준함이 가장 중요해요. 오늘도 화이팅! 💪"
        }


# 싱글톤 인스턴스
_pt_agent_instance = None


def get_pt_agent() -> PTAgent:
    """PT Agent 싱글톤 인스턴스 반환"""
    global _pt_agent_instance
    if _pt_agent_instance is None:
        _pt_agent_instance = PTAgent()
    return _pt_agent_instance
