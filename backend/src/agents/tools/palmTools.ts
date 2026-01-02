import { getEventsByUser, getGoalsByUser, getTodosByUser, createTodo, createEvent } from '../../services/database.js';
import { DBEvent, Event, Goal, Todo } from '../../types/index.js';

/**
 * PALM Tools - Goal 분해, Chronotype 스케줄링, Briefing 등
 */

// Chronotype 정의
export type Chronotype = 'morning' | 'evening' | 'neutral';

// Chronotype별 최적 시간대
const CHRONOTYPE_PREFERENCES: Record<Chronotype, {
  focus_hours: number[];      // 집중력이 높은 시간
  energy_peak: number[];      // 에너지가 높은 시간
  wind_down: number[];        // 마무리 시간
}> = {
  morning: {
    focus_hours: [6, 7, 8, 9, 10],
    energy_peak: [8, 9, 10, 11],
    wind_down: [19, 20, 21]
  },
  evening: {
    focus_hours: [14, 15, 16, 17, 18, 19, 20],
    energy_peak: [16, 17, 18, 19, 20],
    wind_down: [22, 23, 0]
  },
  neutral: {
    focus_hours: [9, 10, 11, 14, 15, 16],
    energy_peak: [10, 11, 14, 15],
    wind_down: [20, 21, 22]
  }
};

// 활동 유형별 권장 설정
const ACTIVITY_SETTINGS: Record<string, {
  duration: number;
  preferChronotype: 'focus' | 'energy' | 'wind_down';
  category: string;
}> = {
  '운동': { duration: 60, preferChronotype: 'energy', category: '운동' },
  '공부': { duration: 120, preferChronotype: 'focus', category: '공부' },
  '독서': { duration: 60, preferChronotype: 'wind_down', category: '개인' },
  '명상': { duration: 30, preferChronotype: 'wind_down', category: '개인' },
  '회의': { duration: 60, preferChronotype: 'focus', category: '업무' },
  '미팅': { duration: 60, preferChronotype: 'focus', category: '업무' },
  '작업': { duration: 120, preferChronotype: 'focus', category: '업무' },
  default: { duration: 60, preferChronotype: 'focus', category: '기본' }
};

// DBEvent를 Event로 변환
function dbEventToEvent(dbEvent: DBEvent): Event {
  const datetime = `${dbEvent.event_date}T${dbEvent.start_time || '09:00'}:00`;
  let duration = 60;
  if (dbEvent.start_time && dbEvent.end_time) {
    const start = new Date(`2000-01-01T${dbEvent.start_time}`);
    const end = new Date(`2000-01-01T${dbEvent.end_time}`);
    duration = Math.round((end.getTime() - start.getTime()) / 60000);
    if (duration <= 0) duration = 60;
  }

  return {
    id: dbEvent.id,
    user_id: dbEvent.user_id,
    category_id: dbEvent.category_id,
    title: dbEvent.title,
    description: dbEvent.description,
    datetime,
    duration,
    type: 'personal',
    location: dbEvent.location,
    is_completed: dbEvent.is_completed,
    completed_at: dbEvent.completed_at,
    created_at: dbEvent.created_at,
  };
}

/**
 * Goal을 Todo 리스트로 분해
 */
export async function decomposeGoalToTodos(
  userId: string,
  goalTitle: string,
  goalDescription: string,
  targetDate: string,
  activityType: string
): Promise<{
  todos: { title: string; duration: number; order: number }[];
  strategy: string;
  message: string;
}> {
  const today = new Date();
  const target = new Date(targetDate);
  const daysUntilTarget = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // 활동 유형별 분해 전략
  const strategies: Record<string, { steps: string[]; durations: number[] }> = {
    '공부': {
      steps: ['개념 학습', '연습 문제 풀이', '복습', '모의 테스트'],
      durations: [90, 60, 45, 60]
    },
    '운동': {
      steps: ['워밍업', '본 운동', '쿨다운', '스트레칭'],
      durations: [10, 40, 10, 15]
    },
    '프로젝트': {
      steps: ['기획 및 설계', '구현', '테스트', '리뷰 및 개선'],
      durations: [60, 120, 60, 30]
    },
    '자격증': {
      steps: ['이론 공부', '기출문제 풀이', '오답 노트 정리', '모의고사'],
      durations: [90, 60, 30, 60]
    },
    default: {
      steps: ['준비', '실행', '정리', '검토'],
      durations: [30, 60, 20, 15]
    }
  };

  const strategy = strategies[activityType] || strategies.default;

  // Todo 리스트 생성
  const todos = strategy.steps.map((step, index) => ({
    title: `${goalTitle} - ${step}`,
    duration: strategy.durations[index],
    order: index + 1
  }));

  // 일정에 따른 추천 빈도 계산
  let frequency = '';
  if (daysUntilTarget <= 7) {
    frequency = '매일';
  } else if (daysUntilTarget <= 30) {
    frequency = '주 3-4회';
  } else {
    frequency = '주 2-3회';
  }

  return {
    todos,
    strategy: `${goalTitle}을 위해 ${frequency} ${todos.length}단계로 진행하는 것을 추천합니다.`,
    message: `"${goalTitle}" 목표를 ${todos.length}개의 세부 작업으로 분해했습니다. D-${daysUntilTarget}일 남았으므로 ${frequency} 수행을 권장합니다.`
  };
}

/**
 * Chronotype 기반 최적 시간 찾기
 */
export function getOptimalTimeForActivity(
  chronotype: Chronotype,
  activityType: string
): { hour: number; reason: string } {
  const prefs = CHRONOTYPE_PREFERENCES[chronotype];
  const settings = ACTIVITY_SETTINGS[activityType] || ACTIVITY_SETTINGS.default;

  let targetHours: number[];
  let reason: string;

  switch (settings.preferChronotype) {
    case 'focus':
      targetHours = prefs.focus_hours;
      reason = '집중력이 가장 높은 시간대';
      break;
    case 'energy':
      targetHours = prefs.energy_peak;
      reason = '에너지가 가장 높은 시간대';
      break;
    case 'wind_down':
      targetHours = prefs.wind_down;
      reason = '하루를 마무리하기 좋은 시간대';
      break;
    default:
      targetHours = prefs.focus_hours;
      reason = '권장 시간대';
  }

  // 가장 이른 시간 선택
  const hour = targetHours[0];

  return {
    hour,
    reason: `${chronotype === 'morning' ? '아침형' : chronotype === 'evening' ? '저녁형' : '중립형'} 사용자의 ${reason}입니다.`
  };
}

/**
 * Chronotype 기반 스마트 스케줄링
 */
export async function scheduleWithChronotype(
  userId: string,
  activityType: string,
  chronotype: Chronotype,
  daysAhead: number = 7
): Promise<{
  suggestions: { date: string; time: string; duration: number; reason: string }[];
  message: string;
}> {
  const suggestions: { date: string; time: string; duration: number; reason: string }[] = [];
  const today = new Date();

  const settings = ACTIVITY_SETTINGS[activityType] || ACTIVITY_SETTINGS.default;
  const { hour, reason } = getOptimalTimeForActivity(chronotype, activityType);

  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];

    // 해당 날짜의 기존 일정 확인
    const dbEvents = await getEventsByUser(userId, dateStr, dateStr);
    const events = dbEvents.map(dbEventToEvent);

    // 해당 시간에 충돌이 있는지 확인
    const hasConflict = events.some(event => {
      const eventHour = new Date(event.datetime).getHours();
      return Math.abs(eventHour - hour) < 2; // 2시간 범위 내 충돌
    });

    if (!hasConflict) {
      suggestions.push({
        date: dateStr,
        time: `${hour.toString().padStart(2, '0')}:00`,
        duration: settings.duration,
        reason
      });
    }
  }

  return {
    suggestions,
    message: suggestions.length > 0
      ? `${activityType}을 위해 ${suggestions.length}개의 최적 시간대를 찾았습니다. (${reason})`
      : `${daysAhead}일 내에 적합한 시간대를 찾지 못했습니다.`
  };
}

/**
 * 아침/저녁 브리핑 생성
 */
export async function generateBriefing(
  userId: string,
  type: 'morning' | 'evening'
): Promise<{
  greeting: string;
  schedule_summary: string;
  todo_summary: string;
  suggestions: string[];
  message: string;
}> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 86400000).toISOString().split('T')[0];

  // 오늘/내일 일정 조회
  const todayEvents = await getEventsByUser(userId, todayStr, todayStr);
  const tomorrowEvents = await getEventsByUser(userId, tomorrowStr, tomorrowStr);
  const todos = await getTodosByUser(userId);
  const incompleteTodos = todos.filter(t => !t.is_completed);

  let greeting: string;
  let schedule_summary: string;
  let todo_summary: string;
  const suggestions: string[] = [];

  if (type === 'morning') {
    // 아침 브리핑
    const hour = today.getHours();
    if (hour < 10) {
      greeting = '좋은 아침이에요! ☀️';
    } else {
      greeting = '안녕하세요!';
    }

    if (todayEvents.length === 0) {
      schedule_summary = '오늘은 등록된 일정이 없어요.';
      suggestions.push('오늘 목표를 세워보는 건 어떨까요?');
    } else {
      const events = todayEvents.map(dbEventToEvent);
      const eventList = events
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        .slice(0, 3)
        .map(e => {
          const time = new Date(e.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
          return `${time} ${e.title}`;
        })
        .join(', ');
      schedule_summary = `오늘 ${todayEvents.length}개의 일정이 있어요: ${eventList}`;
    }

    if (incompleteTodos.length > 0) {
      todo_summary = `완료하지 않은 할 일이 ${incompleteTodos.length}개 있어요.`;
      suggestions.push('할 일을 확인하고 우선순위를 정해보세요.');
    } else {
      todo_summary = '모든 할 일을 완료했어요! 👏';
    }

  } else {
    // 저녁 브리핑
    greeting = '오늘 하루도 수고하셨어요! 🌙';

    // 오늘 완료된 일정 확인
    const completedToday = todos.filter(t =>
      t.is_completed &&
      t.completed_at &&
      t.completed_at.startsWith(todayStr)
    );

    if (completedToday.length > 0) {
      schedule_summary = `오늘 ${completedToday.length}개의 작업을 완료했어요.`;
    } else {
      schedule_summary = '오늘 일정을 확인해주세요.';
    }

    // 내일 일정 미리보기
    if (tomorrowEvents.length > 0) {
      const events = tomorrowEvents.map(dbEventToEvent);
      const firstEvent = events.sort((a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      )[0];
      const time = new Date(firstEvent.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
      todo_summary = `내일 첫 일정은 ${time}에 "${firstEvent.title}"이에요.`;
      suggestions.push('내일 일정을 미리 확인하고 준비하세요.');
    } else {
      todo_summary = '내일은 등록된 일정이 없어요.';
      suggestions.push('내일 계획을 세워보는 건 어떨까요?');
    }
  }

  return {
    greeting,
    schedule_summary,
    todo_summary,
    suggestions,
    message: `${greeting}\n\n📅 ${schedule_summary}\n✅ ${todo_summary}`
  };
}

/**
 * 주간 리뷰 생성
 */
export async function generateWeeklyReview(
  userId: string
): Promise<{
  completed_events: number;
  completed_todos: number;
  active_goals: number;
  suggestions: string[];
  message: string;
}> {
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 86400000);
  const weekAgoStr = weekAgo.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  // 지난 주 데이터 조회
  const events = await getEventsByUser(userId, weekAgoStr, todayStr);
  const todos = await getTodosByUser(userId);
  const goals = await getGoalsByUser(userId);

  const completedEvents = events.filter(e => e.is_completed).length;
  const completedTodos = todos.filter(t =>
    t.is_completed &&
    t.completed_at &&
    t.completed_at >= weekAgoStr
  ).length;
  const activeGoals = goals.filter(g => g.is_active).length;

  const suggestions: string[] = [];

  if (completedEvents < 5) {
    suggestions.push('더 많은 일정을 계획해보세요.');
  }
  if (activeGoals === 0) {
    suggestions.push('새로운 목표를 설정해보세요.');
  }
  if (completedTodos > 10) {
    suggestions.push('훌륭해요! 이 페이스를 유지하세요.');
  }

  return {
    completed_events: completedEvents,
    completed_todos: completedTodos,
    active_goals: activeGoals,
    suggestions,
    message: `지난 주 리뷰:\n- 완료한 일정: ${completedEvents}개\n- 완료한 할 일: ${completedTodos}개\n- 활성 목표: ${activeGoals}개`
  };
}

/**
 * OpenAI Function Calling용 PALM 도구 정의
 */
export const palmToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'decompose_goal',
      description: '장기 목표를 세부 작업(Todo)으로 분해합니다. 목표 달성을 위한 단계별 계획을 생성합니다.',
      parameters: {
        type: 'object',
        properties: {
          goal_title: {
            type: 'string',
            description: '목표 제목 (예: "토익 900점", "10kg 감량")'
          },
          goal_description: {
            type: 'string',
            description: '목표에 대한 설명'
          },
          target_date: {
            type: 'string',
            description: '목표 달성 예정일 (YYYY-MM-DD)'
          },
          activity_type: {
            type: 'string',
            description: '활동 유형 (공부, 운동, 프로젝트, 자격증 등)'
          }
        },
        required: ['goal_title', 'target_date', 'activity_type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'smart_schedule',
      description: 'Chronotype(아침형/저녁형)을 고려하여 최적의 시간대에 활동을 스케줄링합니다.',
      parameters: {
        type: 'object',
        properties: {
          activity_type: {
            type: 'string',
            description: '활동 유형 (운동, 공부, 독서, 회의 등)'
          },
          chronotype: {
            type: 'string',
            enum: ['morning', 'evening', 'neutral'],
            description: '사용자의 생체리듬 유형'
          },
          days_ahead: {
            type: 'number',
            description: '추천할 기간 (일 수, 기본값 7)'
          }
        },
        required: ['activity_type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_briefing',
      description: '아침 또는 저녁 브리핑을 생성합니다. 오늘의 일정, 할 일, 제안사항을 요약합니다.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['morning', 'evening'],
            description: '브리핑 유형'
          }
        },
        required: ['type']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_weekly_review',
      description: '지난 주의 활동을 리뷰하고 요약합니다.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  }
];

/**
 * PALM 도구 실행 함수
 */
export async function executePalmTool(
  toolName: string,
  args: any,
  userId: string,
  chronotype: Chronotype = 'neutral'
): Promise<any> {
  switch (toolName) {
    case 'decompose_goal':
      return await decomposeGoalToTodos(
        userId,
        args.goal_title,
        args.goal_description || '',
        args.target_date,
        args.activity_type
      );

    case 'smart_schedule':
      return await scheduleWithChronotype(
        userId,
        args.activity_type,
        args.chronotype || chronotype,
        args.days_ahead || 7
      );

    case 'get_briefing':
      return await generateBriefing(userId, args.type);

    case 'get_weekly_review':
      return await generateWeeklyReview(userId);

    default:
      return { error: `Unknown PALM tool: ${toolName}` };
  }
}
