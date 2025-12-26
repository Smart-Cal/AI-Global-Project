"""
개입 메시지 & 선택지
"""
from typing import Dict, List, Optional


# 개입 타입별 메시지 및 선택지
INTERVENTION_OPTIONS = {
    "onboarding_stuck": {
        "message": """
        🤔 목표 설정이 어려우신가요?

        괜찮아요! 처음엔 누구나 어려워요.
        제가 도와드릴게요!
        """,
        "options": [
            {
                "id": "show_examples",
                "label": "📝 목표 예시 보여주세요",
                "action": "show_goal_examples"
            },
            {
                "id": "start_simple",
                "label": "🌱 간단한 목표로 시작할래요",
                "action": "set_simple_goal"
            },
            {
                "id": "come_back_later",
                "label": "⏰ 나중에 다시 올게요",
                "action": "dismiss"
            }
        ]
    },

    "plan_dissatisfaction": {
        "message": """
        💭 플랜이 마음에 들지 않으시나요?

        어떤 부분이 불편하신지 알려주시면
        더 맞춤화된 플랜을 제안드릴 수 있어요!
        """,
        "options": [
            {
                "id": "too_hard",
                "label": "😓 너무 어려워요",
                "action": "reduce_difficulty"
            },
            {
                "id": "too_easy",
                "label": "💪 더 도전적으로 해주세요",
                "action": "increase_difficulty"
            },
            {
                "id": "specific_feedback",
                "label": "✍️ 구체적으로 말씀드릴게요",
                "action": "get_feedback"
            },
            {
                "id": "keep_current",
                "label": "👍 이대로 진행할게요",
                "action": "dismiss"
            }
        ]
    },

    "execution_dropout": {
        "message": """
        👋 {nickname}님, 잘 지내고 계신가요?

        3일 동안 미션 체크가 없어서 걱정됐어요.
        바쁘셨나요? 괜찮아요, 다시 시작하면 돼요!
        """,
        "options": [
            {
                "id": "restart_easy",
                "label": "🌱 가벼운 미션부터 다시 시작",
                "action": "set_easy_missions"
            },
            {
                "id": "adjust_goal",
                "label": "🎯 목표 조정이 필요해요",
                "action": "adjust_goal"
            },
            {
                "id": "was_busy",
                "label": "💼 바빴어요, 이제 다시 할게요",
                "action": "resume"
            },
            {
                "id": "need_break",
                "label": "😴 잠시 쉬고 싶어요",
                "action": "pause"
            }
        ]
    }
}

# 목표 예시
GOAL_EXAMPLES = {
    "weight": [
        "3개월 안에 5kg 감량하기",
        "여름까지 뱃살 빼기",
        "건강한 체중 유지하기"
    ],
    "exercise": [
        "주 3회 이상 운동하기",
        "매일 아침 30분 산책하기",
        "한 달에 100km 걷기"
    ],
    "diet": [
        "야식 끊기",
        "하루 물 2L 마시기",
        "주 5일 집밥 먹기"
    ],
    "sleep": [
        "밤 11시 전 취침하기",
        "하루 7시간 이상 자기",
        "주말에도 같은 시간에 일어나기"
    ]
}

# 간단한 목표 (초보자용)
SIMPLE_GOALS = {
    "weight": "한 달에 2kg 감량하기",
    "exercise": "일주일에 3번 30분 운동하기",
    "diet": "하루에 물 8잔 마시기",
    "sleep": "밤 12시 전에 잠자리 들기"
}


def get_intervention_message(intervention_type: str, context: Dict = None) -> Dict:
    """
    개입 메시지 및 선택지 반환

    Args:
        intervention_type: 개입 타입
        context: 추가 컨텍스트 (닉네임 등)

    Returns:
        메시지와 선택지 딕셔너리
    """
    intervention = INTERVENTION_OPTIONS.get(intervention_type)

    if not intervention:
        return {
            "message": "무엇을 도와드릴까요?",
            "options": []
        }

    message = intervention["message"]

    # 컨텍스트 변수 치환
    if context:
        for key, value in context.items():
            message = message.replace(f"{{{key}}}", str(value))

    return {
        "message": message,
        "options": intervention["options"]
    }


def get_goal_examples(goal_type: str = None) -> List[str]:
    """
    목표 예시 반환

    Args:
        goal_type: 목표 유형 (없으면 전체)

    Returns:
        예시 목록
    """
    if goal_type and goal_type in GOAL_EXAMPLES:
        return GOAL_EXAMPLES[goal_type]

    # 전체 예시 반환
    all_examples = []
    for examples in GOAL_EXAMPLES.values():
        all_examples.extend(examples)
    return all_examples


def get_simple_goal(goal_type: str) -> str:
    """
    간단한 목표 반환

    Args:
        goal_type: 목표 유형

    Returns:
        간단한 목표 문자열
    """
    return SIMPLE_GOALS.get(goal_type, "하루 30분 건강한 습관 만들기")


def process_intervention_action(action: str, session_state: Dict, context: Dict = None) -> Dict:
    """
    개입 선택 처리

    Args:
        action: 선택된 액션
        session_state: 세션 상태
        context: 추가 컨텍스트

    Returns:
        처리 결과
    """
    result = {
        "success": True,
        "message": "",
        "next_action": None
    }

    if action == "show_goal_examples":
        goal_type = context.get("goal_type") if context else None
        examples = get_goal_examples(goal_type)
        result["message"] = "다음 예시들을 참고해보세요:\n" + "\n".join(f"• {ex}" for ex in examples[:5])
        result["examples"] = examples

    elif action == "set_simple_goal":
        goal_type = context.get("goal_type", "exercise") if context else "exercise"
        simple_goal = get_simple_goal(goal_type)
        result["message"] = f"'{simple_goal}'로 시작해볼까요?"
        result["suggested_goal"] = simple_goal

    elif action == "reduce_difficulty":
        result["message"] = "플랜 난이도를 낮춰드릴게요. 무리하지 않는 게 중요해요!"
        result["next_action"] = "regenerate_plan_easy"

    elif action == "increase_difficulty":
        result["message"] = "좋아요! 더 도전적인 플랜으로 바꿔드릴게요! 💪"
        result["next_action"] = "regenerate_plan_hard"

    elif action == "get_feedback":
        result["message"] = "어떤 부분이 마음에 들지 않으셨나요?"
        result["next_action"] = "show_feedback_form"

    elif action == "set_easy_missions":
        result["message"] = "가벼운 미션으로 다시 시작해볼게요!"
        result["next_action"] = "reset_with_easy_missions"

    elif action == "adjust_goal":
        result["message"] = "목표를 다시 설정해볼까요?"
        result["next_action"] = "goto_onboarding"

    elif action == "resume":
        result["message"] = "다시 시작하는 것만으로도 대단해요! 화이팅! 💪"
        result["next_action"] = "goto_daily"

    elif action == "pause":
        result["message"] = "괜찮아요, 쉴 때 쉬어야 해요. 준비되면 언제든 돌아오세요!"
        session_state["goal_paused"] = True

    elif action == "dismiss":
        result["message"] = "알겠어요! 필요하시면 언제든 말씀해주세요."

    else:
        result["message"] = "선택해주셔서 감사해요!"

    return result
