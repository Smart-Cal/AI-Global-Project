"""
1단계: 온보딩 + 목표 설정
- 목표 유형 선택
- 목표 상세 입력
- 기간 설정
(로그인 후 닉네임은 이미 설정됨)
"""
import streamlit as st
import time
import json
import os
import sys

# 상위 디렉토리를 path에 추가
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import get_supabase, is_connected
from database.queries import save_goal
from utils.session import init_session_state, update_last_input_time

# 세션 초기화
init_session_state()

st.set_page_config(
    page_title="목표 설정 - AI 캘린더",
    page_icon="🎯",
    layout="wide"
)

# 로그인 체크
if not st.session_state.get('logged_in'):
    st.warning("로그인이 필요합니다.")
    if st.button("🔐 로그인하러 가기", type="primary"):
        st.switch_page("main.py")
    st.stop()

st.title("🎯 목표 설정")
st.markdown(f"안녕하세요, **{st.session_state.get('nickname', '사용자')}**님! 목표를 설정해볼까요?")

# 이미 온보딩 완료된 경우
if st.session_state.get('goal_saved'):
    st.success("✅ 이미 목표가 설정되어 있습니다!")
    st.markdown(f"**목표**: {st.session_state.get('goal', {}).get('target_description', '')}")

    col1, col2 = st.columns(2)
    with col1:
        if st.button("📋 플랜 생성하러 가기", use_container_width=True, type="primary"):
            st.switch_page("pages/2_📋_plan.py")
    with col2:
        if st.button("🔄 목표 다시 설정하기", use_container_width=True):
            st.session_state.goal_saved = False
            st.session_state.goal = None
            st.rerun()
    st.stop()

# 샘플 목표 데이터 로드
data_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "sample_goals.json")
try:
    with open(data_path, "r", encoding="utf-8") as f:
        goal_data = json.load(f)
except FileNotFoundError:
    goal_data = {
        "goal_types": [
            {"id": "weight", "label": "🏃 체중/체형 관리", "examples": ["3개월 안에 10kg 감량"]},
            {"id": "exercise", "label": "💪 운동 습관 만들기", "examples": ["주 3회 이상 운동하기"]},
            {"id": "diet", "label": "🥗 식단 관리", "examples": ["야식 끊기"]},
            {"id": "sleep", "label": "😴 수면 패턴 개선", "examples": ["매일 밤 11시 전 취침"]}
        ],
        "duration_options": [
            {"weeks": 4, "label": "4주 (1개월)"},
            {"weeks": 8, "label": "8주 (2개월)"},
            {"weeks": 12, "label": "12주 (3개월)"},
            {"weeks": 16, "label": "16주 (4개월)"}
        ]
    }

st.markdown("---")

# 진행 상태 표시
progress_col1, progress_col2, progress_col3 = st.columns(3)
with progress_col1:
    st.markdown("**1️⃣ 목표 유형**")
with progress_col2:
    st.markdown("2️⃣ 목표 상세")
with progress_col3:
    st.markdown("3️⃣ 기간 설정")

st.markdown("---")

# 닉네임은 로그인 시 이미 설정됨
nickname = st.session_state.get('nickname', '')

# Step 1: 목표 유형 선택
st.subheader("1️⃣ 어떤 목표를 가지고 계신가요?")

goal_types = goal_data.get("goal_types", [])
goal_labels = [g["label"] for g in goal_types]

selected_goal_label = st.selectbox(
    "목표 유형 선택",
    options=goal_labels,
    index=0,
    label_visibility="collapsed"
)

# 선택된 목표 유형 찾기
selected_goal_type = None
for g in goal_types:
    if g["label"] == selected_goal_label:
        selected_goal_type = g
        break

if selected_goal_type:
    update_last_input_time()
    st.info(f"💡 예시: {', '.join(selected_goal_type.get('examples', []))}")

st.markdown("---")

# Step 2: 목표 상세 입력
st.subheader("2️⃣ 구체적으로 어떤 목표인가요?")
target_description = st.text_area(
    "목표 상세",
    placeholder="예: 3개월 안에 10kg 감량하고 싶어요!",
    height=100,
    label_visibility="collapsed"
)

if target_description:
    update_last_input_time()

st.markdown("---")

# Step 3: 기간 설정
st.subheader("3️⃣ 목표 달성 기간을 설정해주세요")

duration_options = goal_data.get("duration_options", [])
duration_labels = [d["label"] for d in duration_options]
duration_values = [d["weeks"] for d in duration_options]

selected_duration_label = st.select_slider(
    "기간 선택",
    options=duration_labels,
    value=duration_labels[2] if len(duration_labels) > 2 else duration_labels[0],
    label_visibility="collapsed"
)

# 선택된 기간 찾기
selected_weeks = 12
for d in duration_options:
    if d["label"] == selected_duration_label:
        selected_weeks = d["weeks"]
        break

update_last_input_time()

st.markdown("---")

# 입력 검증
is_valid = bool(nickname and selected_goal_type and target_description)

# 목표 설정 완료 버튼
col1, col2, col3 = st.columns([1, 2, 1])
with col2:
    if st.button("🎯 목표 설정 완료", use_container_width=True, type="primary", disabled=not is_valid):
        with st.spinner("목표를 저장하는 중..."):
            # 이미 로그인되어 user_id가 있음
            user_id = st.session_state.get('user_id')

            # DB 연결 확인
            if is_connected() and user_id:
                # 목표 저장
                goal = save_goal(
                    user_id=user_id,
                    goal_type=selected_goal_type["id"],
                    target_description=target_description,
                    duration_weeks=selected_weeks
                )

                if goal:
                    st.session_state.goal = {
                        "id": goal.id,
                        "type": selected_goal_type["id"],
                        "target_description": target_description,
                        "duration_weeks": selected_weeks
                    }
                    st.session_state.goal_saved = True
                else:
                    st.error("목표 저장에 실패했습니다.")
            else:
                # DB 연결이 없는 경우 세션에만 저장 (데모 모드)
                import uuid
                if not user_id:
                    st.session_state.user_id = str(uuid.uuid4())
                st.session_state.goal = {
                    "id": str(uuid.uuid4()),
                    "type": selected_goal_type["id"],
                    "target_description": target_description,
                    "duration_weeks": selected_weeks
                }
                st.session_state.goal_saved = True
                st.warning("⚠️ 데이터베이스 연결 없이 데모 모드로 진행합니다.")

            if st.session_state.goal_saved:
                st.success("🎉 목표가 설정되었어요!")
                time.sleep(1)
                st.switch_page("pages/2_📋_plan.py")

if not is_valid:
    st.caption("⚠️ 모든 항목을 입력해주세요")

# 사이드바: 도움말
with st.sidebar:
    st.markdown(f"### 👤 {st.session_state.get('nickname', '사용자')}님")

    st.markdown("---")

    st.markdown("### 💡 목표 설정 팁")
    st.markdown("""
    **좋은 목표의 조건:**
    - ✅ 구체적이고 측정 가능해요
    - ✅ 달성 가능한 수준이에요
    - ✅ 기한이 명확해요

    **예시:**
    - ❌ "살 빼기" (모호함)
    - ✅ "3개월 안에 5kg 감량" (구체적)
    """)

    st.markdown("---")

    st.markdown("### 📊 현재 입력 상태")
    st.markdown(f"- 목표 유형: {'✅' if selected_goal_type else '❌'}")
    st.markdown(f"- 목표 상세: {'✅' if target_description else '❌'}")
    st.markdown(f"- 기간: {selected_weeks}주")
