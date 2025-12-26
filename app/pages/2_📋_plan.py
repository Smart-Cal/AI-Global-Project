"""
2단계: AI 플랜 생성 & AI 코치 상담
- 목표 기반 맞춤 플랜 생성
- 운동/식단/수면 플랜 통합
- AI 챗봇을 통한 플랜 수정 상담
"""
import streamlit as st
import time
import os
import sys
import json

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents.orchestrator import get_orchestrator
from database.connection import is_connected
from database.queries import save_plan
from utils.session import init_session_state, increment_plan_revision, get_plan_revision_count
from config import settings

# 세션 초기화
init_session_state()


def get_coach_response(user_message: str, current_plan: dict, goal: dict, chat_history: list) -> str:
    """AI 코치 응답 생성"""
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # 현재 플랜 요약
        plan_summary = ""
        if current_plan:
            exercise = current_plan.get('exercise', {})
            diet = current_plan.get('diet', {})
            sleep = current_plan.get('sleep', {})

            if isinstance(exercise, dict) and exercise.get('weekly_plan'):
                plan_summary += "**현재 운동 플랜:**\n"
                for day in exercise.get('weekly_plan', []):
                    if isinstance(day, dict):
                        plan_summary += f"- {day.get('day', '')}: {day.get('workout', '')}\n"

            if isinstance(diet, dict) and diet.get('daily_plan'):
                plan_summary += "\n**현재 식단 플랜:**\n"
                daily = diet.get('daily_plan', {})
                for meal, content in daily.items():
                    meal_kr = {'breakfast': '아침', 'lunch': '점심', 'dinner': '저녁', 'snack': '간식'}.get(meal, meal)
                    plan_summary += f"- {meal_kr}: {content}\n"

            if isinstance(sleep, dict) and sleep.get('sleep_schedule'):
                schedule = sleep.get('sleep_schedule', {})
                plan_summary += f"\n**현재 수면 플랜:**\n"
                plan_summary += f"- 취침: {schedule.get('target_bedtime', '23:00')}\n"
                plan_summary += f"- 기상: {schedule.get('target_waketime', '07:00')}\n"

        # 목표 정보
        goal_info = f"""
사용자 목표: {goal.get('target_description', '목표 미설정')}
목표 유형: {goal.get('type', '-')}
목표 기간: {goal.get('duration_weeks', 12)}주
"""

        system_prompt = f"""당신은 건강 및 피트니스 AI 코치입니다. 사용자의 플랜 수정 요청을 도와주세요.

{goal_info}

{plan_summary}

다음 규칙을 따라주세요:
1. 사용자가 플랜 수정을 요청하면 가능 여부를 판단하세요.
2. 수정이 목표 달성에 도움이 되면 긍정적으로 대안을 제시하세요.
3. 수정이 목표에 부정적이면, 이유를 설명하고 더 나은 대안을 제시하세요.
4. 친근하고 격려하는 톤을 유지하세요.
5. 응답은 한국어로, 간결하게 작성하세요.
6. 구체적인 변경 사항을 제안할 때는 명확하게 표시하세요.

예시 응답 형식:
- 가능한 요청: "좋은 생각이에요! [수정 내용]으로 변경하면 [이유]로 더 효과적일 수 있어요."
- 주의가 필요한 요청: "그 변경은 [이유]로 권장하지 않아요. 대신 [대안]은 어떨까요?"
"""

        # 이전 대화 히스토리 구성
        messages = [{"role": "system", "content": system_prompt}]

        # 최근 대화 히스토리 추가 (최대 10개)
        for msg in chat_history[-10:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        # 현재 메시지 추가
        messages.append({"role": "user", "content": user_message})

        # API 호출
        response = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            temperature=0.7,
            max_tokens=500
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"죄송합니다, 응답을 생성하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (오류: {str(e)})"

st.set_page_config(
    page_title="플랜 생성 - AI 캘린더",
    page_icon="📋",
    layout="wide"
)

st.title("📋 AI 맞춤 플랜 & 코치 상담")

# 로그인 체크
if not st.session_state.get('logged_in'):
    st.warning("로그인이 필요합니다.")
    if st.button("🔐 로그인하러 가기", type="primary"):
        st.switch_page("main.py")
    st.stop()

# 목표 설정 확인
if not st.session_state.get('goal_saved'):
    st.warning("⚠️ 먼저 목표를 설정해주세요!")
    if st.button("🎯 목표 설정하러 가기"):
        st.switch_page("pages/1_🎯_onboarding.py")
    st.stop()

# 사용자 정보 표시
goal = st.session_state.get('goal', {})
nickname = st.session_state.get('nickname', '사용자')

st.info(f"""
**{nickname}**님의 목표
- 📌 {goal.get('target_description', '목표 미설정')}
- ⏱️ {goal.get('duration_weeks', 12)}주 동안 진행
""")

st.markdown("---")

# 이미 플랜이 있는 경우
if st.session_state.get('plan'):
    st.success("✅ 플랜이 이미 생성되어 있습니다!")

    plan = st.session_state.get('plan', {})

    # 플랜 표시
    col1, col2, col3 = st.columns(3)

    with col1:
        st.markdown("### 🏋️ 운동 플랜")
        exercise_plan = plan.get('exercise', {})
        if isinstance(exercise_plan, dict):
            weekly_plan = exercise_plan.get('weekly_plan', [])
            if weekly_plan:
                for day_plan in weekly_plan:
                    if isinstance(day_plan, dict):
                        st.markdown(f"**{day_plan.get('day', '')}**: {day_plan.get('workout', '')}")

    with col2:
        st.markdown("### 🥗 식단 플랜")
        diet_plan = plan.get('diet', {})
        if isinstance(diet_plan, dict):
            daily_plan = diet_plan.get('daily_plan', {})
            if daily_plan:
                for meal, content in daily_plan.items():
                    meal_kr = {'breakfast': '아침', 'lunch': '점심', 'dinner': '저녁', 'snack': '간식'}.get(meal, meal)
                    st.markdown(f"**{meal_kr}**: {content}")

    with col3:
        st.markdown("### 😴 수면 플랜")
        sleep_plan = plan.get('sleep', {})
        if isinstance(sleep_plan, dict):
            schedule = sleep_plan.get('sleep_schedule', {})
            if schedule:
                st.markdown(f"**취침**: {schedule.get('target_bedtime', '23:00')}")
                st.markdown(f"**기상**: {schedule.get('target_waketime', '07:00')}")
                st.markdown(f"**수면시간**: {schedule.get('sleep_duration', '8시간')}")

    st.markdown("---")

    col1, col2, col3 = st.columns([1, 1, 1])
    with col1:
        if st.button("📅 캘린더 보기", use_container_width=True, type="primary"):
            st.switch_page("pages/3_📅_calendar.py")
    with col2:
        if st.button("✅ 오늘의 미션", use_container_width=True):
            st.switch_page("pages/4_✅_daily.py")
    with col3:
        if st.button("🔄 플랜 다시 생성", use_container_width=True):
            st.session_state.plan = None
            increment_plan_revision()
            st.rerun()

    st.markdown("---")

    # AI 코치 챗봇 섹션
    st.markdown("### 💬 AI 코치와 상담하기")
    st.markdown("플랜 수정이 필요하시면 AI 코치에게 말씀해주세요!")

    # 채팅 메시지 초기화
    if 'chat_messages' not in st.session_state:
        st.session_state.chat_messages = []

    # 채팅 히스토리 표시
    chat_container = st.container()
    with chat_container:
        for message in st.session_state.chat_messages:
            with st.chat_message(message["role"]):
                st.markdown(message["content"])

    # 채팅 입력
    user_input = st.chat_input("예: 월요일 운동을 수요일로 옮기고 싶어요")

    if user_input:
        # 사용자 메시지 추가
        st.session_state.chat_messages.append({"role": "user", "content": user_input})

        # AI 응답 생성
        with st.spinner("AI 코치가 답변을 준비하고 있습니다..."):
            response = get_coach_response(
                user_input,
                st.session_state.plan,
                st.session_state.get('goal', {}),
                st.session_state.chat_messages
            )

        # AI 응답 추가
        st.session_state.chat_messages.append({"role": "assistant", "content": response})
        st.rerun()

    # 채팅 초기화 버튼
    if st.session_state.chat_messages:
        if st.button("🗑️ 대화 초기화"):
            st.session_state.chat_messages = []
            st.rerun()

    st.stop()

# 플랜 생성 UI
st.markdown("### 🤖 AI가 맞춤 플랜을 생성합니다")

# 추가 정보 입력
with st.expander("📝 추가 정보 입력 (선택사항)", expanded=True):
    col1, col2 = st.columns(2)

    with col1:
        fitness_level = st.select_slider(
            "현재 체력 수준",
            options=["초급", "중급", "상급"],
            value="초급"
        )

        available_time = st.selectbox(
            "하루 운동 가능 시간",
            ["30분 미만", "30분~1시간", "1시간~2시간", "2시간 이상"]
        )

    with col2:
        dietary_restrictions = st.multiselect(
            "식이 제한",
            ["없음", "채식", "알러지 있음", "당뇨", "고혈압"]
        )

        sleep_issues = st.multiselect(
            "수면 관련 고민",
            ["없음", "잠들기 어려움", "자주 깸", "아침에 일어나기 힘듦", "주말에 늦잠"]
        )

# 컨텍스트 구성
context = {
    "nickname": nickname,
    "goal": goal.get('target_description', ''),
    "goal_type": goal.get('type', 'weight'),
    "duration_weeks": goal.get('duration_weeks', 12),
    "current_week": 1,
    "fitness_level": fitness_level,
    "available_time": available_time,
    "dietary_restrictions": dietary_restrictions,
    "sleep_issues": sleep_issues
}

st.markdown("---")

# 플랜 생성 버튼
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    generate_button = st.button("🚀 플랜 생성하기", use_container_width=True, type="primary")

if generate_button:
    with st.spinner("🤖 AI가 맞춤 플랜을 생성하고 있습니다..."):
        # 프로그레스 바
        progress_bar = st.progress(0)
        status_text = st.empty()

        # 오케스트레이터로 플랜 생성
        orchestrator = get_orchestrator()

        status_text.text("🏋️ 운동 플랜 생성 중...")
        progress_bar.progress(25)
        time.sleep(0.5)

        status_text.text("🥗 식단 플랜 생성 중...")
        progress_bar.progress(50)
        time.sleep(0.5)

        status_text.text("😴 수면 플랜 생성 중...")
        progress_bar.progress(75)
        time.sleep(0.5)

        # 전체 플랜 생성
        full_plan = orchestrator.generate_full_plan(context, week_number=1)

        status_text.text("✨ 플랜 통합 중...")
        progress_bar.progress(100)
        time.sleep(0.3)

        # 세션에 저장
        st.session_state.plan = full_plan

        # DB에 저장 (연결된 경우)
        if is_connected() and st.session_state.get('user_id') and st.session_state.get('goal', {}).get('id'):
            user_id = st.session_state.user_id
            goal_id = st.session_state.goal['id']

            # 각 플랜 저장
            if full_plan.get('exercise'):
                save_plan(user_id, goal_id, 1, 'exercise', full_plan['exercise'])
            if full_plan.get('diet'):
                save_plan(user_id, goal_id, 1, 'diet', full_plan['diet'])
            if full_plan.get('sleep'):
                save_plan(user_id, goal_id, 1, 'sleep', full_plan['sleep'])

        progress_bar.empty()
        status_text.empty()

        st.success("🎉 플랜이 생성되었습니다!")
        st.rerun()

# 플랜 수정 횟수 체크 (감시자 기능)
revision_count = get_plan_revision_count()
if revision_count >= 2:
    st.warning("""
    💭 플랜이 마음에 들지 않으시나요?

    어떤 부분이 불편하신지 말씀해주시면 더 맞춤화된 플랜을 제안드릴 수 있어요!
    """)

    feedback = st.text_area("플랜에 대한 피드백을 입력해주세요", placeholder="예: 운동 시간이 너무 길어요 / 식단이 너무 엄격해요")

    if feedback:
        if st.button("피드백 반영하여 재생성"):
            context['user_feedback'] = feedback
            st.session_state.plan = None
            st.rerun()

# 사이드바
with st.sidebar:
    st.markdown("### 💡 플랜 생성 안내")
    st.markdown("""
    AI가 다음 정보를 바탕으로 플랜을 생성합니다:

    1. **목표 정보** - 설정한 목표와 기간
    2. **체력 수준** - 운동 강도 조절
    3. **가용 시간** - 일정에 맞춘 계획
    4. **식이 제한** - 맞춤 식단 추천
    5. **수면 패턴** - 개선점 제안

    플랜이 마음에 들지 않으면 언제든 다시 생성할 수 있어요!
    """)

    st.markdown("---")

    st.markdown("### 📊 진행 상태")
    st.markdown(f"- 플랜 수정 횟수: {revision_count}회")
