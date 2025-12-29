# AI Calendar App

AI 기반 스마트 일정 관리 애플리케이션

## 주요 기능

- **AI 일정 추가**: 자연어로 일정을 추가 (예: "내일 12시 강남역에서 점심약속")
- **캘린더 뷰**: 월별 캘린더에서 일정 확인 및 관리
- **카테고리 분류**: 약속, 회의, 운동, 공부, 수업, 과제, 개인, 기타
- **일정 필터링**: 기간별(이번 주/이번 달/전체), 카테고리별 필터
- **모바일 최적화**: 모바일 친화적 UI/UX

## 기술 스택

- **Frontend**: React 18 + TypeScript + Vite
- **상태관리**: Zustand
- **Backend/DB**: Supabase
- **AI**: OpenAI GPT-4o-mini
- **라우팅**: React Router v6

## 프로젝트 구조

```
src/
├── components/          # UI 컴포넌트
│   ├── AIChatModal.tsx  # AI 채팅 모달
│   ├── EventModal.tsx   # 일정 추가/수정 모달
│   ├── DateEventsModal.tsx
│   ├── BottomNav.tsx    # 하단 네비게이션
│   └── Modal.tsx        # 기본 모달
├── pages/               # 페이지 컴포넌트
│   ├── AuthPage.tsx     # 로그인/회원가입
│   ├── HomePage.tsx     # 홈 (오늘/다가오는 일정)
│   ├── CalendarPage.tsx # 캘린더 뷰
│   └── SchedulePage.tsx # 일정 목록
├── services/            # 외부 서비스 연동
│   ├── supabase.ts      # Supabase 클라이언트 & API
│   └── openai.ts        # OpenAI API
├── store/               # Zustand 스토어
│   ├── authStore.ts     # 인증 상태
│   └── eventStore.ts    # 일정 상태
├── types/               # TypeScript 타입 정의
└── styles/              # CSS 스타일
```

## 설치 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## 환경 변수 설정

`.env` 파일을 생성하고 아래 값을 설정:

```env
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_KEY=your-supabase-anon-key
VITE_OPENAI_API_KEY=your-openai-api-key
```

## Supabase 테이블 구조

### users
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| phone | text | 전화번호 (unique) |
| password_hash | text | 비밀번호 해시 |
| name | text | 이름 |
| nickname | text | 닉네임 |
| is_active | boolean | 활성 상태 |
| last_login_at | timestamp | 마지막 로그인 |
| created_at | timestamp | 생성일 |

### events
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK |
| user_id | uuid | FK (users.id) |
| title | text | 일정 제목 |
| description | text | 메모 |
| event_date | date | 날짜 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |
| is_all_day | boolean | 종일 여부 |
| category | text | 카테고리 |
| location | text | 장소 |
| color | text | 색상 코드 |
| created_at | timestamp | 생성일 |

## 라이선스

MIT
