# 🗓️ AI 캘린더 MVP

AI 기반 건강 습관 형성 플랫폼입니다. 운동, 식단, 수면 관리를 위한 맞춤형 플랜을 제공하고 일일 미션을 통해 목표 달성을 도와줍니다.

## ✨ 주요 기능

- **🎯 맞춤 목표 설정** - 체중관리, 운동습관, 식단관리, 수면개선 중 선택
- **📋 AI 플랜 생성** - PT, 영양사, 수면 코치 AI가 맞춤 플랜 제공
- **📅 캘린더 관리** - 월간/주간 뷰로 일정 확인
- **✅ 일일 미션** - 매일 해야 할 일을 체크하며 진행
- **📊 주간 리뷰** - 성과 분석 및 AI 피드백
- **👁️ 감시자 시스템** - 이탈 감지 및 자동 개입

## 🏗️ 기술 스택

- **Frontend**: Streamlit
- **AI**: Claude API (Anthropic)
- **Database**: Supabase (PostgreSQL)
- **Language**: Python 3.10+

## 📁 프로젝트 구조

```
ai-calendar/
├── app/
│   ├── main.py              # 메인 진입점
│   ├── config.py            # 설정 관리
│   ├── pages/               # Streamlit 멀티페이지
│   │   ├── 1_🎯_onboarding.py
│   │   ├── 2_📋_plan.py
│   │   ├── 3_📅_calendar.py
│   │   ├── 4_✅_daily.py
│   │   └── 5_📊_review.py
│   ├── agents/              # AI 에이전트
│   │   ├── orchestrator.py
│   │   ├── pt_agent.py
│   │   ├── diet_agent.py
│   │   ├── sleep_agent.py
│   │   └── prompts.py
│   ├── watcher/             # 감시자 시스템
│   │   ├── detector.py
│   │   ├── interventions.py
│   │   └── tracker.py
│   ├── database/            # 데이터베이스
│   │   ├── connection.py
│   │   ├── models.py
│   │   └── queries.py
│   ├── components/          # UI 컴포넌트
│   │   ├── chat.py
│   │   ├── calendar_view.py
│   │   ├── mission_card.py
│   │   └── progress_bar.py
│   └── utils/               # 유틸리티
│       ├── session.py
│       ├── datetime_utils.py
│       └── formatters.py
├── data/                    # 샘플 데이터
├── sql/                     # SQL 스키마
├── docs/                    # 문서
├── requirements.txt
├── .env.example
└── README.md
```

## 🚀 시작하기

### 1. 환경 설정

```bash
# 프로젝트 클론
git clone <repository-url>
cd ai-calendar

# 가상환경 생성 및 활성화
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 패키지 설치
pip install -r requirements.txt
```

### 2. 환경변수 설정

```bash
# .env 파일 생성
cp .env.example .env
```

`.env` 파일을 열고 다음 값들을 설정합니다:

```
ANTHROPIC_API_KEY=sk-ant-your-api-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-key
```

### 3. 데이터베이스 설정 (선택)

Supabase 대시보드에서 `sql/schema.sql` 스크립트를 실행합니다.

> **참고**: Supabase 설정 없이도 데모 모드로 앱을 사용할 수 있습니다.

### 4. 앱 실행

```bash
cd app
streamlit run main.py
```

브라우저에서 `http://localhost:8501`로 접속합니다.

## 🔧 AI 에이전트 구조

### Orchestrator (오케스트레이터)
- 사용자 입력 분석 및 적절한 에이전트 라우팅
- 여러 에이전트 응답 통합

### PT Agent (운동 코치)
- 체력 수준에 맞는 운동 플랜 생성
- 주간 운동 루틴 제공

### Diet Agent (영양 코치)
- 목표에 맞는 식단 플랜 생성
- 영양 조언 제공

### Sleep Agent (수면 코치)
- 수면 패턴 개선 플랜 생성
- 취침 루틴 제안

## 👁️ 감시자 시스템

사용자의 이탈을 감지하고 적절히 개입합니다:

1. **온보딩 정체 감지**: 3분 이상 목표 설정 미완료 시
2. **플랜 불만족 감지**: 2회 이상 플랜 수정 요청 시
3. **실행 이탈 감지**: 3일 연속 미션 미체크 시

## 📊 데이터베이스 스키마

- `users`: 사용자 정보
- `goals`: 목표 설정
- `plans`: AI 생성 플랜
- `missions`: 일일 미션
- `mission_logs`: 미션 체크 기록
- `conversations`: 대화 기록
- `watcher_interventions`: 감시자 개입 기록
- `weekly_reviews`: 주간 리뷰

## 🛠️ 개발 가이드

### 새 에이전트 추가

1. `app/agents/` 폴더에 새 에이전트 파일 생성
2. `prompts.py`에 시스템 프롬프트 추가
3. `orchestrator.py`에 라우팅 로직 추가

### 새 페이지 추가

1. `app/pages/` 폴더에 `번호_아이콘_이름.py` 형식으로 파일 생성
2. 세션 상태 관리를 위해 `utils/session.py` 활용

## 📝 라이선스

MIT License

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
