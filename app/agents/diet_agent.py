"""
Diet Agent - 식단 관리
"""
import os
import json
import re
from typing import Optional
from openai import OpenAI
from .prompts import get_diet_agent_prompt


class DietAgent:
    """영양사 에이전트"""

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
        식단 관련 응답 생성

        Args:
            user_input: 사용자 입력
            context: 사용자 컨텍스트 (닉네임, 목표 등)

        Returns:
            응답 딕셔너리 {"agent": "DIET", "message": str, "plan": dict}
        """
        if not self.client:
            return self._get_fallback_response(context)

        prompt = get_diet_agent_prompt(context)

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
                "agent": "DIET",
                "message": response_text,
                "plan": plan,
                "success": True
            }

        except Exception as e:
            print(f"Diet Agent 응답 생성 실패: {e}")
            return self._get_fallback_response(context)

    def generate_weekly_plan(self, context: dict, week_number: int = 1) -> dict:
        """
        주간 식단 플랜 생성

        Args:
            context: 사용자 컨텍스트
            week_number: 주차

        Returns:
            주간 플랜 딕셔너리
        """
        goal_type = context.get("goal_type", "weight")
        user_input = f"""
        {week_number}주차 식단 플랜을 생성해주세요.
        목표: {context.get('goal', '건강한 식단')}
        목표 유형: {goal_type}

        JSON 형식으로 식단 계획을 제공해주세요.
        """

        result = self.generate(user_input, context)
        return result.get("plan", self._get_default_plan(goal_type))

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
        goal_type = context.get("goal_type", "weight")
        return {
            "agent": "DIET",
            "message": f"{nickname}님, 맞춤 식단을 준비 중입니다!",
            "plan": self._get_default_plan(goal_type),
            "success": False
        }

    def _get_default_plan(self, goal_type: str = "weight") -> dict:
        """기본 식단 플랜"""
        if goal_type == "weight":
            return {
                "daily_plan": {
                    "breakfast": "계란 2개 + 통곡물 빵 1장 + 샐러드",
                    "lunch": "닭가슴살 150g + 현미밥 2/3공기 + 채소 반찬",
                    "dinner": "생선구이 + 두부 + 채소 위주",
                    "snack": "그릭요거트 또는 과일 소량"
                },
                "nutrition_tips": [
                    "단백질을 매 끼니 포함시키세요",
                    "채소를 먼저 드세요 (포만감 증가)",
                    "천천히 꼭꼭 씹어 드세요"
                ],
                "foods_to_avoid": ["야식", "단음료", "튀김류", "과자", "빵류"],
                "hydration": "하루 2L 이상 물 마시기",
                "calories_guide": "일일 권장 칼로리에서 300-500kcal 적게"
            }
        else:
            return {
                "daily_plan": {
                    "breakfast": "단백질 위주 아침 (계란, 닭가슴살 등)",
                    "lunch": "균형 잡힌 점심 (탄단지 1:1:1)",
                    "dinner": "가벼운 저녁 (단백질 + 채소)",
                    "snack": "과일 또는 견과류"
                },
                "nutrition_tips": [
                    "규칙적인 식사 시간을 유지하세요",
                    "가공식품 대신 자연식품을 선택하세요",
                    "배부르기 전에 멈추세요"
                ],
                "foods_to_avoid": ["과도한 나트륨", "설탕", "가공식품"],
                "hydration": "하루 2L 이상 물 마시기"
            }


# 싱글톤 인스턴스
_diet_agent_instance = None


def get_diet_agent() -> DietAgent:
    """Diet Agent 싱글톤 인스턴스 반환"""
    global _diet_agent_instance
    if _diet_agent_instance is None:
        _diet_agent_instance = DietAgent()
    return _diet_agent_instance
