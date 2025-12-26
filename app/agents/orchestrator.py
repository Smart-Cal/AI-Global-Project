"""
중앙 컨트롤러 Agent (Orchestrator)
- 사용자 입력 분석
- 적절한 Agent 라우팅
- 응답 통합
"""
import os
import re
from typing import List, Dict, Optional
from openai import OpenAI
from .prompts import get_orchestrator_prompt
from .pt_agent import PTAgent, get_pt_agent
from .diet_agent import DietAgent, get_diet_agent
from .sleep_agent import SleepAgent, get_sleep_agent


class Orchestrator:
    """오케스트레이터 - AI 에이전트 중앙 컨트롤러"""

    def __init__(self):
        self.client = None
        self.model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        self._init_client()

        # 하위 에이전트들
        self.pt_agent = get_pt_agent()
        self.diet_agent = get_diet_agent()
        self.sleep_agent = get_sleep_agent()

    def _init_client(self):
        """OpenAI 클라이언트 초기화"""
        try:
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key and api_key != "sk-xxxxx":
                self.client = OpenAI(api_key=api_key)
        except Exception as e:
            print(f"OpenAI 클라이언트 초기화 실패: {e}")
            self.client = None

    def process(self, user_input: str, context: dict) -> dict:
        """
        사용자 입력 처리 및 응답 생성

        Args:
            user_input: 사용자 입력
            context: 사용자 컨텍스트

        Returns:
            통합 응답 딕셔너리
        """
        # 1. 어떤 Agent를 호출할지 결정
        agents_to_call = self._determine_agents(user_input, context)

        # 2. Agent들 호출
        responses = []
        for agent_name in agents_to_call:
            response = self._call_agent(agent_name, user_input, context)
            if response:
                responses.append(response)

        # 3. 응답 통합
        return self._integrate_responses(user_input, responses, context)

    def _determine_agents(self, user_input: str, context: dict) -> List[str]:
        """호출할 Agent 결정"""
        agents = []
        input_lower = user_input.lower()

        # 키워드 기반 Agent 선택
        pt_keywords = ['운동', '헬스', '체중', '다이어트', '근육', '유산소', '근력', '스쿼트', '푸시업', '런닝', '조깅', '걷기']
        diet_keywords = ['식단', '음식', '먹', '칼로리', '영양', '단백질', '탄수화물', '야식', '간식', '물', '식사']
        sleep_keywords = ['수면', '잠', '취침', '기상', '피곤', '컨디션', '휴식', '졸', '불면']

        if any(keyword in input_lower for keyword in pt_keywords):
            agents.append('PT')

        if any(keyword in input_lower for keyword in diet_keywords):
            agents.append('DIET')

        if any(keyword in input_lower for keyword in sleep_keywords):
            agents.append('SLEEP')

        # 특정 Agent가 선택되지 않은 경우 목표 유형에 따라 결정
        if not agents:
            goal_type = context.get('goal_type', '')
            if goal_type in ['weight', 'exercise']:
                agents.append('PT')
            if goal_type in ['weight', 'diet']:
                agents.append('DIET')
            if goal_type == 'sleep':
                agents.append('SLEEP')

        # 여전히 없으면 모든 Agent 호출
        if not agents:
            agents = ['PT', 'DIET', 'SLEEP']

        return agents

    def _call_agent(self, agent_name: str, user_input: str, context: dict) -> Optional[dict]:
        """특정 Agent 호출"""
        try:
            if agent_name == 'PT':
                return self.pt_agent.generate(user_input, context)
            elif agent_name == 'DIET':
                return self.diet_agent.generate(user_input, context)
            elif agent_name == 'SLEEP':
                return self.sleep_agent.generate(user_input, context)
        except Exception as e:
            print(f"{agent_name} Agent 호출 실패: {e}")
        return None

    def _integrate_responses(self, user_input: str, responses: List[dict], context: dict) -> dict:
        """여러 Agent 응답 통합"""
        if not responses:
            return self._get_default_response(context)

        # 단일 응답인 경우 그대로 반환
        if len(responses) == 1:
            return {
                "message": responses[0].get("message", ""),
                "agents_called": [responses[0].get("agent", "")],
                "plans": {responses[0].get("agent", ""): responses[0].get("plan", {})},
                "success": responses[0].get("success", False)
            }

        # 여러 응답 통합
        if self.client:
            integrated_message = self._ai_integrate(user_input, responses, context)
        else:
            integrated_message = self._simple_integrate(responses)

        plans = {}
        agents_called = []
        for resp in responses:
            agent = resp.get("agent", "")
            if agent:
                agents_called.append(agent)
                if resp.get("plan"):
                    plans[agent] = resp["plan"]

        return {
            "message": integrated_message,
            "agents_called": agents_called,
            "plans": plans,
            "success": True
        }

    def _ai_integrate(self, user_input: str, responses: List[dict], context: dict) -> str:
        """AI를 사용한 응답 통합"""
        integration_prompt = f"""
        다음은 사용자의 질문에 대한 여러 전문가의 응답입니다.
        이를 자연스럽게 통합하여 하나의 응답으로 만들어주세요.

        사용자 질문: {user_input}

        전문가 응답들:
        """

        for resp in responses:
            integration_prompt += f"\n[{resp.get('agent', '')} 전문가]\n{resp.get('message', '')}\n"

        integration_prompt += """

        위 내용을 바탕으로 사용자에게 친근하고 도움이 되는 통합 응답을 작성해주세요.
        중복되는 내용은 정리하고, 핵심 정보만 전달해주세요.
        """

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=[{"role": "user", "content": integration_prompt}]
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"응답 통합 실패: {e}")
            return self._simple_integrate(responses)

    def _simple_integrate(self, responses: List[dict]) -> str:
        """간단한 응답 통합 (AI 없이)"""
        result = []
        for resp in responses:
            agent = resp.get("agent", "")
            message = resp.get("message", "")
            if agent and message:
                icon = {"PT": "🏋️", "DIET": "🥗", "SLEEP": "😴"}.get(agent, "💡")
                result.append(f"{icon} **{agent} 코치**\n{message}")

        return "\n\n---\n\n".join(result)

    def _get_default_response(self, context: dict) -> dict:
        """기본 응답"""
        nickname = context.get("nickname", "회원")
        return {
            "message": f"{nickname}님, 무엇을 도와드릴까요? 운동, 식단, 수면 관련 질문을 해주세요! 💪",
            "agents_called": [],
            "plans": {},
            "success": False
        }

    def generate_full_plan(self, context: dict, week_number: int = 1) -> dict:
        """
        전체 주간 플랜 생성 (운동 + 식단 + 수면)

        Args:
            context: 사용자 컨텍스트
            week_number: 주차

        Returns:
            통합 플랜 딕셔너리
        """
        exercise_plan = self.pt_agent.generate_weekly_plan(context, week_number)
        diet_plan = self.diet_agent.generate_weekly_plan(context, week_number)
        sleep_plan = self.sleep_agent.generate_weekly_plan(context, week_number)

        return {
            "week_number": week_number,
            "exercise": exercise_plan,
            "diet": diet_plan,
            "sleep": sleep_plan
        }

    def generate_next_week_plan(self, context: dict, current_week: int, weekly_stats: dict, previous_plan: dict) -> dict:
        """
        이전 주 진행상황을 바탕으로 다음 주 플랜 생성

        Args:
            context: 사용자 컨텍스트
            current_week: 현재 주차 (완료된 주)
            weekly_stats: 주간 통계 (달성률 등)
            previous_plan: 이전 주 플랜

        Returns:
            다음 주 플랜 딕셔너리
        """
        next_week = current_week + 1

        # 달성률에 따른 난이도 조정
        overall_rate = weekly_stats.get('overall', {}).get('rate', 50)
        exercise_rate = weekly_stats.get('exercise', {}).get('rate', 50)
        diet_rate = weekly_stats.get('diet', {}).get('rate', 50)
        sleep_rate = weekly_stats.get('sleep', {}).get('rate', 50)

        # 난이도 조정 컨텍스트 추가
        adjusted_context = context.copy()
        adjusted_context['previous_week'] = current_week
        adjusted_context['previous_stats'] = weekly_stats
        adjusted_context['previous_plan'] = previous_plan

        # 운동 플랜 조정
        if exercise_rate >= 80:
            adjusted_context['exercise_adjustment'] = 'increase'  # 강도 증가
            adjusted_context['exercise_note'] = '지난주 운동을 잘 수행했으므로 강도를 조금 높입니다.'
        elif exercise_rate >= 50:
            adjusted_context['exercise_adjustment'] = 'maintain'  # 유지
            adjusted_context['exercise_note'] = '지난주 페이스를 유지합니다.'
        else:
            adjusted_context['exercise_adjustment'] = 'decrease'  # 강도 감소
            adjusted_context['exercise_note'] = '지난주 수행률이 낮아 강도를 조금 낮춥니다.'

        # 식단 플랜 조정
        if diet_rate >= 80:
            adjusted_context['diet_adjustment'] = 'increase'
            adjusted_context['diet_note'] = '식단 관리를 잘 하고 있어 조금 더 엄격한 식단을 제안합니다.'
        elif diet_rate >= 50:
            adjusted_context['diet_adjustment'] = 'maintain'
            adjusted_context['diet_note'] = '현재 식단을 유지합니다.'
        else:
            adjusted_context['diet_adjustment'] = 'decrease'
            adjusted_context['diet_note'] = '식단 조절이 어려웠으므로 더 쉬운 옵션을 제안합니다.'

        # 수면 플랜 조정
        if sleep_rate >= 80:
            adjusted_context['sleep_adjustment'] = 'increase'
            adjusted_context['sleep_note'] = '수면 패턴이 안정적이므로 더 최적화된 스케줄을 제안합니다.'
        elif sleep_rate >= 50:
            adjusted_context['sleep_adjustment'] = 'maintain'
            adjusted_context['sleep_note'] = '현재 수면 스케줄을 유지합니다.'
        else:
            adjusted_context['sleep_adjustment'] = 'decrease'
            adjusted_context['sleep_note'] = '수면 패턴 개선이 어려웠으므로 더 유연한 목표를 설정합니다.'

        # 새 플랜 생성
        return self.generate_full_plan(adjusted_context, next_week)

    def chat(self, user_input: str, context: dict, conversation_history: List[dict] = None) -> dict:
        """
        대화형 응답 생성

        Args:
            user_input: 사용자 입력
            context: 사용자 컨텍스트
            conversation_history: 이전 대화 기록

        Returns:
            응답 딕셔너리
        """
        if not self.client:
            return self.process(user_input, context)

        # 시스템 프롬프트 생성
        system_prompt = get_orchestrator_prompt(context)

        # 메시지 구성
        messages = [{"role": "system", "content": system_prompt}]

        # 이전 대화 기록 추가
        if conversation_history:
            for msg in conversation_history[-10:]:  # 최근 10개만
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })

        # 현재 입력 추가
        messages.append({"role": "user", "content": user_input})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                max_tokens=1024,
                messages=messages
            )

            response_text = response.choices[0].message.content

            # Agent 호출 지시 확인
            agent_calls = re.findall(r'\[CALL: (\w+)\]', response_text)

            if agent_calls:
                # 추가 Agent 호출
                agent_responses = []
                for agent_name in agent_calls:
                    agent_name = agent_name.replace('_AGENT', '')
                    resp = self._call_agent(agent_name, user_input, context)
                    if resp:
                        agent_responses.append(resp)

                # 호출 지시 제거
                clean_message = re.sub(r'\[CALL: \w+\]', '', response_text).strip()

                return {
                    "message": clean_message,
                    "agents_called": agent_calls,
                    "agent_responses": agent_responses,
                    "success": True
                }

            return {
                "message": response_text,
                "agents_called": [],
                "success": True
            }

        except Exception as e:
            print(f"대화 생성 실패: {e}")
            return self.process(user_input, context)


# 싱글톤 인스턴스
_orchestrator_instance = None


def get_orchestrator() -> Orchestrator:
    """Orchestrator 싱글톤 인스턴스 반환"""
    global _orchestrator_instance
    if _orchestrator_instance is None:
        _orchestrator_instance = Orchestrator()
    return _orchestrator_instance
