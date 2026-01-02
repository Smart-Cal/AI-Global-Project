# PALM - AI Calendar App

AI 기반 스마트 일정 및 목표 관리 애플리케이션

## 주요 기능

### AI 어시스턴트
- **자연어 일정 추가**: "내일 3시에 강남역에서 미팅" 같은 자연어로 일정 생성
- **스마트 질문**: 시간, 장소, 기간 등 정보가 부족하면 AI가 질문
- **일정/TODO/Goal 자동 분류**: 입력 내용에 따라 자동으로 적절한 유형으로 분류
- **채팅 모드 선택**: 자동, 일정, TODO, Goal, 브리핑 모드 지원

### 일정 관리 (Events)
- 월별 캘린더 뷰
- 일정 생성/수정/삭제
- 카테고리별 분류 (약속, 회의, 운동, 공부 등)
- 시간 충돌 감지

### 할 일 관리 (TODO)
- TODO 생성/수정/삭제
- 우선순위 설정 (높음/보통/낮음)
- 카테고리 분류
- Goal 연결

### 목표 관리 (Goal)
- 목표 설정 및 추적
- 목표를 TODO로 자동 분해
- 진행률 관리
- Chronotype 기반 스케줄링

### PALM 기능
- **Goal 분해**: 큰 목표를 작은 TODO로 자동 분해
- **Chronotype 스케줄링**: 아침형/저녁형에 맞는 최적 시간대 추천
- **브리핑**: 오늘의 일정 및 할 일 요약

## 기술 스택

### Frontend
- **React 18** + **TypeScript**
- **Vite** - 빌드 도구
- **React Router v6** - 라우팅
- **Zustand** - 상태 관리

### Backend
- **Node.js** + **Express** + **TypeScript**
- **Supabase** - 데이터베이스 및 인증
- **OpenAI GPT-4o-mini** - AI 에이전트

## 프로젝트 구조

```
ai-calendar-app/
├── src/                         # Frontend 소스
│   ├── components/              # UI 컴포넌트
│   │   ├── views/               # 메인 뷰 컴포넌트
│   │   │   ├── AssistantView.tsx    # AI 어시스턴트 뷰
│   │   │   ├── CalendarView.tsx     # 캘린더 뷰
│   │   │   ├── ScheduleView.tsx     # 일정 목록 뷰
│   │   │   └── GoalView.tsx         # 목표 관리 뷰
│   │   ├── tabs/                # 탭 컴포넌트
│   │   ├── DatePicker.tsx       # 날짜 선택기
│   │   ├── TimePicker.tsx       # 시간 선택기
│   │   ├── ChatPanel.tsx        # 채팅 패널
│   │   └── ...
│   ├── pages/                   # 페이지 컴포넌트
│   │   ├── AuthPage.tsx         # 로그인/회원가입
│   │   └── AuthCallback.tsx     # OAuth 콜백
│   ├── services/                # API 서비스
│   │   └── api.ts               # Backend API 호출
│   ├── store/                   # Zustand 스토어
│   │   ├── authStore.ts         # 인증 상태
│   │   └── eventStore.ts        # 일정/TODO/Goal 상태
│   ├── types/                   # TypeScript 타입
│   └── styles/                  # CSS 스타일
│
├── backend/                     # Backend 소스
│   └── src/
│       ├── agents/              # AI 에이전트
│       │   ├── agentLoop.ts     # OpenAI Function Calling 기반 Agent
│       │   ├── orchestrator.ts  # 에이전트 조율
│       │   ├── parserAgent.ts   # 자연어 파싱
│       │   ├── schedulerAgent.ts # 스케줄링
│       │   ├── plannerAgent.ts  # 계획 생성
│       │   └── tools/           # 에이전트 도구
│       │       ├── calendarTools.ts  # 캘린더 관련 도구
│       │       └── palmTools.ts      # PALM 도구 (Goal 분해, Chronotype 등)
│       ├── routes/              # API 라우트
│       │   ├── auth.ts          # 인증 API
│       │   ├── events.ts        # 일정 API
│       │   ├── todos.ts         # TODO API
│       │   ├── goals.ts         # Goal API
│       │   ├── categories.ts    # 카테고리 API
│       │   └── chat.ts          # AI 채팅 API
│       ├── services/            # 서비스
│       │   └── database.ts      # Supabase 데이터베이스
│       ├── middleware/          # 미들웨어
│       │   └── auth.ts          # JWT 인증
│       └── types/               # 타입 정의
│           └── index.ts         # 전체 타입
```

## 설치 및 실행

### 요구 사항
- Node.js 18+
- npm 또는 yarn

### Frontend 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

### Backend 설치 및 실행

```bash
cd backend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
npm start
```

## 환경 변수 설정

### Frontend (.env)

```env
VITE_API_URL=http://localhost:3001/api
```

### Backend (.env)

```env
PORT=3001
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_KEY=your-supabase-service-key
OPENAI_API_KEY=your-openai-api-key
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
```

## 데이터베이스 스키마 (Supabase)

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| email | text | 이메일 (unique) |
| name | text | 이름 |
| nickname | text | 닉네임 |
| avatar_url | text | 프로필 이미지 |
| is_active | boolean | 활성 상태 |
| last_login_at | timestamp | 마지막 로그인 |
| created_at | timestamp | 생성일 |

### events
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK (users.id) |
| category_id | uuid | FK (categories.id) |
| title | text | 일정 제목 |
| description | text | 설명 |
| event_date | date | 날짜 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |
| is_all_day | boolean | 종일 여부 |
| location | text | 장소 |
| is_completed | boolean | 완료 여부 |
| completed_at | timestamp | 완료 시간 |
| created_at | timestamp | 생성일 |

### todos
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK (users.id) |
| category_id | uuid | FK (categories.id) |
| goal_id | uuid | FK (goals.id) |
| title | text | 할 일 제목 |
| description | text | 설명 |
| deadline | date | 마감일 |
| duration | integer | 예상 소요 시간 (분) |
| priority | text | 우선순위 (high/medium/low) |
| is_completed | boolean | 완료 여부 |
| completed_at | timestamp | 완료 시간 |
| created_at | timestamp | 생성일 |

### goals
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK (users.id) |
| category_id | uuid | FK (categories.id) |
| title | text | 목표 제목 |
| description | text | 설명 |
| target_date | date | 목표 날짜 |
| priority | text | 우선순위 (high/medium/low) |
| progress | integer | 진행률 (0-100) |
| is_active | boolean | 활성 여부 |
| created_at | timestamp | 생성일 |
| updated_at | timestamp | 수정일 |

### categories
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK (users.id) |
| name | text | 카테고리 이름 |
| color | text | 색상 코드 |
| is_default | boolean | 기본 카테고리 여부 |
| created_at | timestamp | 생성일 |

## API 엔드포인트

### 인증
- `POST /api/auth/google` - Google OAuth 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 일정
- `GET /api/events` - 일정 목록 조회
- `POST /api/events` - 일정 생성
- `PUT /api/events/:id` - 일정 수정
- `DELETE /api/events/:id` - 일정 삭제
- `PATCH /api/events/:id/complete` - 일정 완료 처리

### TODO
- `GET /api/todos` - TODO 목록 조회
- `POST /api/todos` - TODO 생성
- `PUT /api/todos/:id` - TODO 수정
- `DELETE /api/todos/:id` - TODO 삭제
- `PATCH /api/todos/:id/complete` - TODO 완료 처리

### Goal
- `GET /api/goals` - Goal 목록 조회
- `POST /api/goals` - Goal 생성
- `PUT /api/goals/:id` - Goal 수정
- `DELETE /api/goals/:id` - Goal 삭제

### 카테고리
- `GET /api/categories` - 카테고리 목록 조회
- `POST /api/categories` - 카테고리 생성

### AI 채팅
- `POST /api/chat` - AI 메시지 전송 (일정/TODO/Goal 생성)
- `POST /api/chat/confirm-events` - 일정 확인 및 저장
- `POST /api/chat/confirm-todos` - TODO 확인 및 저장
- `POST /api/chat/confirm-goals` - Goal 확인 및 저장

## 라이선스

MIT
