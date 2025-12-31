import OpenAI from 'openai';
import type {
  CalendarEvent,
  Goal,
  Todo,
  AgentType,
  AgentMessage,
  SuggestedEvent,
  Category,
} from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const getWeekday = (date: Date): string => {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
};

const formatDate = (date: Date): string => {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${getWeekday(date)}요일)`;
};

// 현재 일정 요약 (완료 여부 포함)
const summarizeEvents = (events: CalendarEvent[], categories: Category[], days: number = 14): string => {
  if (!events.length) return '현재 등록된 일정이 없습니다.';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + days);

  const relevant = events.filter((e) => {
    const d = new Date(e.event_date);
    return d >= today && d <= futureDate;
  });

  if (!relevant.length) return `향후 ${days}일간 등록된 일정이 없습니다.`;

  return relevant.slice(0, 20).map((e) => {
    const time = e.start_time ? `${e.start_time.slice(0, 5)}~${e.end_time?.slice(0, 5) || ''}` : '종일';
    const location = e.location ? ` @ ${e.location}` : '';
    const status = e.is_completed ? '[완료]' : '';
    const category = categories.find(c => c.id === e.category_id);
    const categoryName = category ? `[${category.name}]` : '';
    return `- ${e.event_date} (${getWeekday(new Date(e.event_date))}) ${time}: ${categoryName}${status} ${e.title}${location}`;
  }).join('\n');
};

// 목표 요약 (목표일과 진행률 강조)
const summarizeGoals = (goals: Goal[], categories: Category[]): string => {
  const activeGoals = goals.filter(g => g.is_active);
  if (!activeGoals.length) return '설정된 목표가 없습니다.';

  const today = new Date().toISOString().split('T')[0];

  return activeGoals.map(g => {
    const progress = `진행률: ${g.progress}%`;
    const category = categories.find(c => c.id === g.category_id);
    const categoryName = category ? `[${category.name}]` : '';

    let deadlineInfo = '';
    if (g.target_date) {
      const daysLeft = Math.ceil((new Date(g.target_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        deadlineInfo = ` (목표일 ${Math.abs(daysLeft)}일 초과!)`;
      } else if (daysLeft === 0) {
        deadlineInfo = ' (오늘 마감!)';
      } else if (daysLeft <= 7) {
        deadlineInfo = ` (${daysLeft}일 남음)`;
      } else {
        deadlineInfo = ` (목표일: ${g.target_date})`;
      }
    }

    return `- ${categoryName} ${g.title} (${progress}${deadlineInfo})`;
  }).join('\n');
};

// Todo 요약
const summarizeTodos = (todos: Todo[]): string => {
  const pending = todos.filter(t => !t.is_completed);
  if (!pending.length) return '할 일이 없습니다.';

  return pending.slice(0, 10).map(t => {
    const due = t.due_date ? ` (기한: ${t.due_date})` : '';
    const priority = t.priority === 'high' ? '[긴급]' : t.priority === 'medium' ? '[보통]' : '[낮음]';
    return `${priority} ${t.title}${due}`;
  }).join('\n');
};

// 사용자 메시지를 분석하여 관련 에이전트 타입들을 결정
const analyzeMessageForAgents = (message: string): AgentType[] => {
  const lowerMsg = message.toLowerCase();
  const agents: AgentType[] = [];

  // 건강/운동 관련
  if (/운동|헬스|건강|다이어트|체중|살|조깅|러닝|요가|스트레칭|수영|근력|유산소|식단|영양|gym|workout/i.test(lowerMsg)) {
    agents.push('health');
  }

  // 학습/공부 관련
  if (/공부|학습|시험|토익|토플|자격증|영어|수학|독서|책|강의|수업|과제|숙제|암기|복습|study/i.test(lowerMsg)) {
    agents.push('study');
  }

  // 커리어/업무 관련
  if (/회의|업무|프로젝트|일|직장|커리어|면접|이력서|발표|프레젠테이션|보고서|미팅|work|meeting/i.test(lowerMsg)) {
    agents.push('career');
  }

  // 라이프스타일/약속 관련
  if (/약속|친구|데이트|여행|맛집|카페|영화|공연|쇼핑|저녁|점심|식사|만남|파티|생일|홍대|강남|이태원/i.test(lowerMsg)) {
    agents.push('lifestyle');
  }

  // 일정 조율 관련
  if (/일정|스케줄|시간|언제|조정|변경|충돌|비어있|여유|최적|schedule/i.test(lowerMsg)) {
    agents.push('scheduler');
  }

  // 기본적으로 master는 항상 포함
  if (!agents.includes('master')) {
    agents.unshift('master');
  }

  return agents;
};

// 다음 N일의 날짜 목록 생성
const getNextNDays = (n: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// 빈 시간대 찾기
const findAvailableSlots = (events: CalendarEvent[], date: string): string[] => {
  const dayEvents = events
    .filter(e => e.event_date === date && e.start_time && e.end_time)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const slots: string[] = [];
  const busyTimes = dayEvents.map(e => ({
    start: e.start_time!,
    end: e.end_time!
  }));

  // 기본 활동 시간: 07:00 ~ 22:00
  const dayStart = '07:00';
  const dayEnd = '22:00';

  if (busyTimes.length === 0) {
    slots.push(`${dayStart}~${dayEnd} (전체 가능)`);
    return slots;
  }

  let currentTime = dayStart;
  for (const busy of busyTimes) {
    if (currentTime < busy.start) {
      slots.push(`${currentTime}~${busy.start}`);
    }
    if (busy.end > currentTime) {
      currentTime = busy.end;
    }
  }

  if (currentTime < dayEnd) {
    slots.push(`${currentTime}~${dayEnd}`);
  }

  return slots;
};

// 메인 시스템 프롬프트 생성
const getMultiAgentSystemPrompt = (
  relevantAgents: AgentType[],
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[]
): string => {
  const today = new Date();
  const nextWeekDates = getNextNDays(7);

  // 각 날짜별 빈 시간대 계산
  const availableSlotsByDate = nextWeekDates.map(date => {
    const slots = findAvailableSlots(events, date);
    const dayOfWeek = getWeekday(new Date(date));
    return `${date} (${dayOfWeek}): ${slots.length > 0 ? slots.join(', ') : '일정 없음'}`;
  }).join('\n');

  // 사용자 정의 카테고리 목록
  const categoryList = categories.map(c => c.name).join(', ') || '기본';

  return `당신은 사용자의 일정을 관리하는 AI 어시스턴트입니다.

## 가장 중요한 규칙
**현재 사용자의 요청에만 집중하세요.** 이전 대화에서 다른 주제(예: 운동)에 대해 이야기했더라도, 현재 요청이 다른 주제(예: 식사)라면 현재 요청에만 맞는 일정을 추천하세요.

## 현재 시간 정보
오늘: ${formatDate(today)}
현재 시각: ${today.getHours()}시 ${today.getMinutes()}분

## 사용자 현황

### 기존 일정 (향후 2주):
${summarizeEvents(events, categories)}

### 향후 7일 빈 시간대:
${availableSlotsByDate}

### 사용자의 목표:
${summarizeGoals(goals, categories)}

### 할 일:
${summarizeTodos(todos)}

### 사용자 정의 카테고리:
${categoryList}

## 목표 기반 일정 추천 전략

사용자가 일정 추천을 요청하면, 다음을 고려하세요:

1. **목표와의 연관성**: 사용자의 목표를 확인하고, 목표 달성에 도움이 되는 일정인지 판단
2. **목표일까지의 시간**: 목표일이 가까울수록 더 집중적인 일정 필요
3. **진행률 분석**: 진행률이 낮은 목표에 더 많은 시간 할당 권장
4. **기존 일정 패턴**: 사용자의 기존 일정 패턴을 참고하여 적절한 시간대 제안

## 중요 지침

1. 구체적인 일정만 제안하세요:
   - 반드시 정확한 날짜(YYYY-MM-DD)와 시간(HH:MM)을 지정
   - 장소도 구체적으로 (예: "집 근처 공원", "홍대입구역 근처", "집에서")

2. 현실적인 일정을 제안하세요:
   - 빈 시간대를 확인하고 충돌 없는 시간에 배치
   - 이동 시간 고려 (연속 일정 사이에 최소 30분 여유)

3. 카테고리 매칭:
   - 사용자가 정의한 카테고리 중 가장 적합한 것을 선택
   - 맞는 카테고리가 없으면 "기본" 사용

4. 응답 형식:
   - 먼저 1-2문장의 간단한 설명
   - 그 다음 반드시 [SCHEDULES] 태그 안에 JSON 배열로 일정 제공

5. JSON 형식:

[SCHEDULES]
[
  {
    "title": "일정 제목",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "location": "구체적인 장소",
    "category_name": "사용자의 카테고리 이름 (예: 공부, 운동, 약속 등)",
    "description": "실제로 무엇을 할지 상세하게",
    "reason": "왜 이 시간대와 활동을 추천하는지"
  }
]
[/SCHEDULES]

6. 절대 하지 말 것:
   - 마크다운 기호 사용 금지 (*, #, **, ## 등)
   - 이전 대화 주제를 현재 요청에 혼합하기 금지
   - 사용자에게 시간을 되묻기 금지`;
};

// JSON 파싱 헬퍼
const parseSchedulesFromResponse = (text: string): SuggestedEvent[] => {
  try {
    // [SCHEDULES] 태그 사이의 JSON 추출
    const match = text.match(/\[SCHEDULES\]([\s\S]*?)\[\/SCHEDULES\]/);
    if (match) {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          title: item.title || '',
          date: item.date || '',
          start_time: item.start_time,
          end_time: item.end_time,
          location: item.location,
          category_name: item.category_name || item.category || '기본',
          description: item.description,
          reason: item.reason || '',
        })).filter(e => e.title && e.date);
      }
    }

    // 대안: 일반 JSON 배열 찾기
    const jsonMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          title: item.title || '',
          date: item.date || '',
          start_time: item.start_time,
          end_time: item.end_time,
          location: item.location,
          category_name: item.category_name || item.category || '기본',
          description: item.description,
          reason: item.reason || '',
        })).filter(e => e.title && e.date);
      }
    }
  } catch (e) {
    console.error('Failed to parse schedules:', e);
  }
  return [];
};

// 텍스트 클린업 (마크다운 기호 제거)
const cleanResponseText = (text: string): string => {
  return text
    .replace(/\[SCHEDULES\][\s\S]*?\[\/SCHEDULES\]/g, '') // JSON 블록 제거
    .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '') // JSON 배열 제거
    .replace(/#{1,6}\s*/g, '') // 헤더 제거
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // 볼드/이탤릭 제거
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // 코드 블록 제거
    .replace(/^[-*+]\s+/gm, '') // 리스트 마커 제거
    .replace(/^\d+\.\s+/gm, '') // 숫자 리스트 제거
    .replace(/\n{3,}/g, '\n\n') // 과도한 줄바꿈 정리
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크 제거
    .trim();
};

// 메인 채팅 함수 (멀티 에이전트)
export const chatWithAgent = async (
  userInput: string,
  _agentType: AgentType, // 이제 자동 라우팅되므로 무시됨
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[],
  history: AgentMessage[] = []
): Promise<AgentMessage> => {
  // 1. 메시지 분석하여 관련 에이전트 결정
  const relevantAgents = analyzeMessageForAgents(userInput);
  const primaryAgent = relevantAgents[0];

  // 2. 시스템 프롬프트 생성
  const systemPrompt = getMultiAgentSystemPrompt(relevantAgents, events, goals, todos, categories);

  // 3. 이전 대화 맥락 구성 (이전 추천 일정 정보도 포함)
  const conversationHistory = history.slice(-6).map((m) => {
    let content = m.content;
    // 이전 추천 일정이 있으면 맥락에 포함
    if (m.metadata?.suggested_events && m.metadata.suggested_events.length > 0) {
      const prevSchedules = m.metadata.suggested_events.map(e =>
        `- ${e.date} ${e.start_time || ''}: ${e.title}`
      ).join('\n');
      content += `\n\n[이전에 추천한 일정]\n${prevSchedules}`;
    }
    return {
      role: m.role as 'user' | 'assistant',
      content
    };
  });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userInput },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2500,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    // 4. 일정 추출
    const suggestedEvents = parseSchedulesFromResponse(rawContent);

    // 5. 텍스트 정리
    let cleanedText = cleanResponseText(rawContent);

    // 일정이 있으면 텍스트를 더 간결하게
    if (suggestedEvents.length > 0 && cleanedText.length > 200) {
      // 첫 2문장만 유지
      const sentences = cleanedText.split(/[.!?]\s+/);
      cleanedText = sentences.slice(0, 2).join('. ').trim();
      if (cleanedText && !cleanedText.endsWith('.') && !cleanedText.endsWith('!') && !cleanedText.endsWith('?')) {
        cleanedText += '.';
      }
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: cleanedText || '추천 일정을 준비했습니다.',
      agent_type: primaryAgent,
      timestamp: new Date(),
      metadata: {
        suggested_events: suggestedEvents.length > 0 ? suggestedEvents : undefined,
      },
    };
  } catch (error) {
    console.error('Agent Error:', error);
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      agent_type: primaryAgent,
      timestamp: new Date(),
    };
  }
};

// 자동 추천 생성 (목표 기반)
export const generateAutoRecommendations = async (
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[]
): Promise<AgentMessage | null> => {
  const activeGoals = goals.filter(g => g.is_active);
  if (activeGoals.length === 0) return null;

  const goalSummary = activeGoals.map(g => {
    const category = categories.find(c => c.id === g.category_id);
    const categoryName = category ? category.name : '';
    return `"${g.title}"${categoryName ? ` (${categoryName})` : ''}`;
  }).join(', ');

  const prompt = `내 목표는 ${goalSummary}입니다. 이번 주에 목표 달성을 위해 실천할 수 있는 구체적인 일정 2-3개를 추천해주세요.`;

  return chatWithAgent(prompt, 'master', events, goals, todos, categories, []);
};

// 일정 충돌 감지
export const detectScheduleConflicts = (events: CalendarEvent[]): string[] => {
  const conflicts: string[] = [];

  const sortedEvents = [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return a.event_date.localeCompare(b.event_date);
    }
    return (a.start_time || '00:00').localeCompare(b.start_time || '00:00');
  });

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    if (current.event_date === next.event_date) {
      if (current.end_time && next.start_time) {
        if (current.end_time > next.start_time) {
          conflicts.push(
            `"${current.title}" (${current.start_time}~${current.end_time})와 "${next.title}" (${next.start_time})이 겹칩니다.`
          );
        }
      }
    }
  }

  return conflicts;
};
