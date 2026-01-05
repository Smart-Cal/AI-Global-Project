import { getEventsByUser, getGoalsByUser, getTodosByUser, createTodo, createEvent, getUserById } from '../../services/database.js';
import { getCurrentWeather } from '../../services/weather.js';
import { DBEvent, LegacyEvent, dbEventToLegacy, Goal, Todo, LegacyChronotype } from '../../types/index.js';

/**
 * PALM Tools - Goal 분해, Chronotype 스케줄링, Briefing 등
 */

// 레거시 호환 Chronotype (기존 3단계)
export type Chronotype = LegacyChronotype;

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
  'workout': { duration: 60, preferChronotype: 'energy', category: 'workout' },
  'study': { duration: 120, preferChronotype: 'focus', category: 'study' },
  'reading': { duration: 60, preferChronotype: 'wind_down', category: 'personal' },
  'meditation': { duration: 30, preferChronotype: 'wind_down', category: 'personal' },
  'meeting': { duration: 60, preferChronotype: 'focus', category: 'work' },
  'conference': { duration: 60, preferChronotype: 'focus', category: 'work' },
  'work': { duration: 120, preferChronotype: 'focus', category: 'work' },
  default: { duration: 60, preferChronotype: 'focus', category: 'general' }
};

// DBEvent를 LegacyEvent로 변환 (types/index.ts에서 가져온 함수 사용)
function dbEventToEvent(dbEvent: DBEvent): LegacyEvent {
  return dbEventToLegacy(dbEvent);
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
    'study': {
      steps: ['Concept Learning', 'Practice Problems', 'Review', 'Mock Test'],
      durations: [90, 60, 45, 60]
    },
    'workout': {
      steps: ['Warm-up', 'Main Workout', 'Cool-down', 'Stretching'],
      durations: [10, 40, 10, 15]
    },
    'project': {
      steps: ['Planning & Design', 'Implementation', 'Testing', 'Review & Refactor'],
      durations: [60, 120, 60, 30]
    },
    'exam': {
      steps: ['Theory Study', 'Past Papers', 'Review Errors', 'Mock Exam'],
      durations: [90, 60, 30, 60]
    },
    default: {
      steps: ['Preparation', 'Execution', 'Cleanup', 'Review'],
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
    frequency = 'daily';
  } else if (daysUntilTarget <= 30) {
    frequency = '3-4 times a week';
  } else {
    frequency = '2-3 times a week';
  }

  return {
    todos,
    strategy: `For ${goalTitle}, we recommend doing it ${frequency} in ${todos.length} steps.`,
    message: `Decomposed "${goalTitle}" into ${todos.length} subtasks. With ${daysUntilTarget} days left, we recommend doing it ${frequency}.`
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
      reason = 'most focused time';
      break;
    case 'energy':
      targetHours = prefs.energy_peak;
      reason = 'highest energy time';
      break;
    case 'wind_down':
      targetHours = prefs.wind_down;
      reason = 'best for winding down';
      break;
    default:
      targetHours = prefs.focus_hours;
      reason = 'recommended time';
  }

  // Pick earliest
  const hour = targetHours[0];

  return {
    hour,
    reason: `This is the ${reason} for a ${chronotype} person.`
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
      ? `Found ${suggestions.length} optimal slots for ${activityType}. (${reason})`
      : `Could not find suitable slots within ${daysAhead} days.`
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
  // Fetch User & Weather
  const user = await getUserById(userId);
  const city = user?.location || 'Seoul';
  const weather = await getCurrentWeather(city);
  const todos = await getTodosByUser(userId);
  const incompleteTodos = todos.filter(t => !t.is_completed);

  let greeting: string; // Kept for interface compatibility, but value will be simple
  let schedule_summary: string;
  let todo_summary: string;
  const suggestions: string[] = [];

  // Weather String
  let weatherStr = '';
  if (weather) {
    weatherStr = `Location: ${city} | Temp: ${weather.temperature}°C | ${weather.condition}`;
    if (weather.recommendation) {
      weatherStr += `\nNote: ${weather.recommendation}`;
    }
  } else {
    weatherStr = `Location: ${city} | Weather info unavailable`;
  }

  if (type === 'morning') {
    // Morning Briefing
    greeting = 'Morning Briefing';

    if (todayEvents.length === 0) {
      schedule_summary = 'Events: None';
      suggestions.push('Set a goal for today?');
    } else {
      const events = todayEvents.map(dbEventToEvent);
      const eventList = events
        .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
        .slice(0, 3)
        .map(e => {
          const time = new Date(e.datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
          return `[${time}] ${e.title}`;
        })
        .join(', ');
      schedule_summary = `Events (${todayEvents.length}): ${eventList}`;
    }

    if (incompleteTodos.length > 0) {
      todo_summary = `Pending Tasks: ${incompleteTodos.length}`;
    } else {
      todo_summary = 'Tasks: All Clear';
    }

  } else {
    // Evening Briefing
    greeting = 'Evening Briefing';

    // Completed today
    const completedToday = todos.filter(t =>
      t.is_completed &&
      t.completed_at &&
      t.completed_at.startsWith(todayStr)
    );

    schedule_summary = `Completed Today: ${completedToday.length} Tasks`;

    // Tomorrow preview
    if (tomorrowEvents.length > 0) {
      const events = tomorrowEvents.map(dbEventToEvent);
      const firstEvent = events.sort((a, b) =>
        new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
      )[0];
      const time = new Date(firstEvent.datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      todo_summary = `Tomorrow 1st Event: [${time}] "${firstEvent.title}"`;
    } else {
      todo_summary = 'Tomorrow: No events scheduled';
    }
  }

  return {
    greeting,
    schedule_summary,
    todo_summary,
    suggestions,
    message: `${weatherStr}\n\n${schedule_summary}\n${todo_summary}`
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
  const activeGoals = goals.filter(g => !['completed', 'failed'].includes(g.status)).length;

  const suggestions: string[] = [];

  if (completedEvents < 5) {
    suggestions.push('Plan more events.');
  }
  if (activeGoals === 0) {
    suggestions.push('Set some new goals.');
  }
  if (completedTodos > 10) {
    suggestions.push('Great job! Keep up the pace.');
  }

  return {
    completed_events: completedEvents,
    completed_todos: completedTodos,
    active_goals: activeGoals,
    suggestions,
    message: `Weekly Review:\n- Completed Events: ${completedEvents}\n- Completed Tasks: ${completedTodos}\n- Active Goals: ${activeGoals}`
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
      description: 'Decompose a long-term goal into subtasks (Todos). Creates a step-by-step plan.',
      parameters: {
        type: 'object',
        properties: {
          goal_title: {
            type: 'string',
            description: 'Goal Title (e.g. "TOEIC 900", "Lose 10kg")'
          },
          goal_description: {
            type: 'string',
            description: 'Description of the goal'
          },
          target_date: {
            type: 'string',
            description: 'Target Date (YYYY-MM-DD)'
          },
          activity_type: {
            type: 'string',
            description: 'Activity Type (study, workout, project, exam, etc.)'
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
      description: 'Schedule activities at optimal times considering user Chronotype.',
      parameters: {
        type: 'object',
        properties: {
          activity_type: {
            type: 'string',
            description: 'Activity Type (workout, study, reading, meeting, etc.)'
          },
          chronotype: {
            type: 'string',
            enum: ['morning', 'evening', 'neutral'],
            description: 'User Chronotype'
          },
          days_ahead: {
            type: 'number',
            description: 'Days ahead to recommend (default 7)'
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
      description: 'Generate morning or evening briefing. Summarizes today\'s schedule, tasks, and suggestions.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['morning', 'evening'],
            description: 'Briefing Type'
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
      description: 'Review and summarize last week\'s activities.',
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
