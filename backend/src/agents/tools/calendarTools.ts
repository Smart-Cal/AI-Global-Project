import { getEventsByUser, createEvent, getGoalsByUser } from '../../services/database.js';
import { DBEvent, LegacyEvent, dbEventToLegacy, Goal } from '../../types/index.js';

/**
 * Calendar Tools - AI Agent가 사용할 캘린더 도구들
 */

// DBEvent를 LegacyEvent로 변환
function dbEventToEvent(dbEvent: DBEvent): LegacyEvent {
  return dbEventToLegacy(dbEvent);
}

/**
 * 특정 기간의 일정 조회
 */
export async function getEvents(
  userId: string,
  startDate?: string,
  endDate?: string
): Promise<{ events: LegacyEvent[]; summary: string }> {
  const dbEvents = await getEventsByUser(userId, startDate, endDate);
  const events = dbEvents.map(dbEventToEvent);

  let summary = '';
  if (events.length === 0) {
    summary = startDate ? `No events from ${startDate} to ${endDate || 'after'}.` : 'No events registered.';
  } else {
    summary = `Total ${events.length} events found.`;
  }

  return { events, summary };
}

/**
 * 특정 날짜/시간에 충돌하는 일정 확인
 */
export async function checkConflicts(
  userId: string,
  datetime: string,
  duration: number
): Promise<{ hasConflict: boolean; conflictingEvents: LegacyEvent[]; message: string }> {
  const targetDate = datetime.split('T')[0];
  const dbEvents = await getEventsByUser(userId, targetDate, targetDate);
  const events = dbEvents.map(dbEventToEvent);

  const targetStart = new Date(datetime);
  const targetEnd = new Date(targetStart.getTime() + duration * 60000);

  const conflictingEvents = events.filter(event => {
    const eventStart = new Date(event.datetime);
    const eventEnd = new Date(eventStart.getTime() + event.duration * 60000);

    return (targetStart < eventEnd && targetEnd > eventStart);
  });

  const hasConflict = conflictingEvents.length > 0;
  let message = '';
  if (hasConflict) {
    const titles = conflictingEvents.map(e => e.title).join(', ');
    message = `Conflict with event(s): "${titles}" at that time.`;
  } else {
    message = 'No conflicting events at that time.';
  }

  return { hasConflict, conflictingEvents, message };
}

/**
 * 특정 날짜의 빈 시간대 찾기
 */
export async function findFreeSlots(
  userId: string,
  date: string,
  requiredDuration: number = 60,
  workdayStart: number = 9,
  workdayEnd: number = 21
): Promise<{ slots: { start: string; end: string; duration: number }[]; message: string }> {
  const dbEvents = await getEventsByUser(userId, date, date);
  const events = dbEvents.map(dbEventToEvent);

  // 시간순 정렬
  events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

  const slots: { start: string; end: string; duration: number }[] = [];

  // 하루 시작 시간
  let currentTime = new Date(`${date}T${workdayStart.toString().padStart(2, '0')}:00:00`);
  const dayEnd = new Date(`${date}T${workdayEnd.toString().padStart(2, '0')}:00:00`);

  for (const event of events) {
    const eventStart = new Date(event.datetime);
    const eventEnd = new Date(eventStart.getTime() + event.duration * 60000);

    // 현재 시간과 이벤트 시작 사이에 빈 시간이 있으면 추가
    if (eventStart > currentTime) {
      const gapDuration = Math.round((eventStart.getTime() - currentTime.getTime()) / 60000);
      if (gapDuration >= requiredDuration) {
        slots.push({
          start: currentTime.toISOString(),
          end: eventStart.toISOString(),
          duration: gapDuration
        });
      }
    }

    // 현재 시간을 이벤트 종료 시간 이후로 이동
    if (eventEnd > currentTime) {
      currentTime = eventEnd;
    }
  }

  // 마지막 이벤트 이후 하루 끝까지 빈 시간 확인
  if (dayEnd > currentTime) {
    const gapDuration = Math.round((dayEnd.getTime() - currentTime.getTime()) / 60000);
    if (gapDuration >= requiredDuration) {
      slots.push({
        start: currentTime.toISOString(),
        end: dayEnd.toISOString(),
        duration: gapDuration
      });
    }
  }

  let message = '';
  if (slots.length === 0) {
    message = `No free slots of ${requiredDuration} minutes or more on ${date}.`;
  } else {
    message = `Found ${slots.length} free slots on ${date}.`;
  }

  return { slots, message };
}

/**
 * 사용자의 목표 조회
 */
export async function getGoals(userId: string): Promise<{ goals: Goal[]; summary: string }> {
  const goals = await getGoalsByUser(userId);
  // 활성 목표: completed, failed가 아닌 것들
  const activeGoals = goals.filter(g => !['completed', 'failed'].includes(g.status));

  let summary = '';
  if (activeGoals.length === 0) {
    summary = 'No active goals.';
  } else {
    summary = `Active Goals (${activeGoals.length}): ${activeGoals.map(g => g.title).join(', ')}`;
  }

  return { goals: activeGoals, summary };
}

/**
 * 목표에 맞는 일정 추천 (빈 시간에 배치)
 */
export async function suggestScheduleForGoal(
  userId: string,
  goalTitle: string,
  activityType: string,
  daysAhead: number = 7
): Promise<{ suggestions: { date: string; time: string; duration: number }[]; message: string }> {
  const suggestions: { date: string; time: string; duration: number }[] = [];

  const today = new Date();

  // 활동 유형별 기본 설정
  const activityDefaults: { [key: string]: { duration: number; preferredHour: number } } = {
    'workout': { duration: 60, preferredHour: 7 },
    'study': { duration: 120, preferredHour: 10 },
    'reading': { duration: 60, preferredHour: 21 },
    'meditation': { duration: 30, preferredHour: 6 },
    default: { duration: 60, preferredHour: 14 }
  };

  const settings = activityDefaults[activityType] || activityDefaults.default;

  for (let i = 0; i < daysAhead; i++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + i);
    const dateStr = targetDate.toISOString().split('T')[0];

    // 해당 날짜의 빈 시간 확인
    const { slots } = await findFreeSlots(userId, dateStr, settings.duration);

    if (slots.length > 0) {
      // 선호 시간에 가장 가까운 슬롯 찾기
      const preferredTime = new Date(`${dateStr}T${settings.preferredHour.toString().padStart(2, '0')}:00:00`);

      let bestSlot = slots[0];
      let minDiff = Math.abs(new Date(slots[0].start).getTime() - preferredTime.getTime());

      for (const slot of slots) {
        const diff = Math.abs(new Date(slot.start).getTime() - preferredTime.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          bestSlot = slot;
        }
      }

      suggestions.push({
        date: dateStr,
        time: new Date(bestSlot.start).toTimeString().slice(0, 5),
        duration: settings.duration
      });
    }
  }

  let message = '';
  if (suggestions.length === 0) {
    message = `Could not find free time for ${goalTitle}.`;
  } else {
    message = `Recommending ${suggestions.length} slots for ${goalTitle}.`;
  }

  return { suggestions, message };
}

/**
 * OpenAI Function Calling용 도구 정의
 */
export const calendarToolDefinitions = [
  {
    type: 'function' as const,
    function: {
      name: 'get_events',
      description: 'Retrieve user schedules. Used to check events for a specific period.',
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD)'
          },
          end_date: {
            type: 'string',
            description: 'End date (YYYY-MM-DD)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'check_conflicts',
      description: 'Check for conflicting events at a specific date/time.',
      parameters: {
        type: 'object',
        properties: {
          datetime: {
            type: 'string',
            description: 'Date/Time to check (ISO format, e.g., 2024-01-15T14:00:00)'
          },
          duration: {
            type: 'number',
            description: 'Duration (minutes)'
          }
        },
        required: ['datetime', 'duration']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'find_free_slots',
      description: 'Find free time slots for a specific date.',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date to check (YYYY-MM-DD)'
          },
          required_duration: {
            type: 'number',
            description: 'Minimum required duration (minutes, default 60)'
          }
        },
        required: ['date']
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_goals',
      description: 'Retrieve user goals.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function' as const,
    function: {
      name: 'suggest_schedule_for_goal',
      description: 'Recommend schedule for goal achievement in free time slots.',
      parameters: {
        type: 'object',
        properties: {
          goal_title: {
            type: 'string',
            description: 'Goal Title'
          },
          activity_type: {
            type: 'string',
            description: 'Activity Type (workout, study, reading, meditation, etc.)'
          },
          days_ahead: {
            type: 'number',
            description: 'Days ahead to recommend (default 7)'
          }
        },
        required: ['goal_title', 'activity_type']
      }
    }
  }
];

/**
 * 도구 실행 함수
 */
export async function executeCalendarTool(
  toolName: string,
  args: any,
  userId: string
): Promise<any> {
  switch (toolName) {
    case 'get_events':
      return await getEvents(userId, args.start_date, args.end_date);

    case 'check_conflicts':
      return await checkConflicts(userId, args.datetime, args.duration);

    case 'find_free_slots':
      return await findFreeSlots(userId, args.date, args.required_duration || 60);

    case 'get_goals':
      return await getGoals(userId);

    case 'suggest_schedule_for_goal':
      return await suggestScheduleForGoal(
        userId,
        args.goal_title,
        args.activity_type,
        args.days_ahead || 7
      );

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}
