import OpenAI from 'openai';
import { Event, Todo, ScheduleResult, ScheduledItem } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Scheduler Agent
 * 역할: Todo에 적절한 시간 배치
 * 기능: 캘린더 빈 시간 분석, 우선순위 고려, 충돌 해결
 */
export async function scheduleTodos(
  todos: Partial<Todo>[],
  existingEvents: Event[],
  preferences?: {
    work_hours_start?: number; // 기본 9
    work_hours_end?: number; // 기본 18
    preferred_focus_time?: 'morning' | 'afternoon' | 'evening';
  }
): Promise<ScheduleResult> {
  const workStart = preferences?.work_hours_start ?? 9;
  const workEnd = preferences?.work_hours_end ?? 18;

  // 빈 시간 슬롯 계산
  const availableSlots = calculateAvailableSlots(existingEvents, workStart, workEnd);

  const systemPrompt = `당신은 일정 최적화 전문가 Scheduler Agent입니다.

주어진 Todo 목록에 최적의 시간을 배치해야 합니다.

현재 일정:
${JSON.stringify(existingEvents.map(e => ({
  title: e.title,
  datetime: e.datetime,
  duration: e.duration
})), null, 2)}

가용 시간 슬롯:
${JSON.stringify(availableSlots, null, 2)}

배치할 Todo:
${JSON.stringify(todos.map(t => ({
  title: t.title,
  deadline: t.deadline,
  duration: t.duration,
  priority: t.priority
})), null, 2)}

스케줄링 규칙:
1. 우선순위가 높은 작업을 먼저 배치
2. 마감일이 가까운 작업 우선
3. 집중력이 필요한 작업은 오전에 배치
4. 30분 이하 작업은 틈새 시간에 배치
5. 충돌이 발생하면 대안 제시

다음 JSON 형식으로 응답하세요:
{
  "scheduled_items": [
    {
      "title": "Todo 제목",
      "scheduled_at": "YYYY-MM-DDTHH:mm:ss",
      "duration": 60,
      "reason": "이 시간에 배치한 이유"
    }
  ],
  "conflicts": ["충돌 내용 목록"],
  "suggestions": ["추가 제안 사항"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '위의 Todo들을 최적으로 스케줄링해주세요.' }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content) as ScheduleResult;
  } catch (error) {
    console.error('Scheduler Agent error:', error);
    return {
      scheduled_items: [],
      conflicts: ['스케줄링 중 오류가 발생했습니다.'],
      suggestions: ['수동으로 시간을 지정해주세요.']
    };
  }
}

/**
 * 빈 시간 슬롯 계산
 */
export function calculateAvailableSlots(
  events: Event[],
  workStart: number = 9,
  workEnd: number = 18,
  days: number = 7
): { date: string; slots: { start: string; end: string; duration: number }[] }[] {
  const result: { date: string; slots: { start: string; end: string; duration: number }[] }[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    // 해당 날짜의 이벤트 필터링
    const dayEvents = events.filter(e => e.datetime.startsWith(dateStr))
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

    const slots: { start: string; end: string; duration: number }[] = [];
    let currentHour = workStart;

    for (const event of dayEvents) {
      const eventStart = new Date(event.datetime).getHours();
      const eventEnd = eventStart + Math.ceil(event.duration / 60);

      // 이벤트 전 빈 시간
      if (currentHour < eventStart) {
        slots.push({
          start: `${String(currentHour).padStart(2, '0')}:00`,
          end: `${String(eventStart).padStart(2, '0')}:00`,
          duration: (eventStart - currentHour) * 60
        });
      }
      currentHour = Math.max(currentHour, eventEnd);
    }

    // 마지막 이벤트 후 빈 시간
    if (currentHour < workEnd) {
      slots.push({
        start: `${String(currentHour).padStart(2, '0')}:00`,
        end: `${String(workEnd).padStart(2, '0')}:00`,
        duration: (workEnd - currentHour) * 60
      });
    }

    result.push({ date: dateStr, slots });
  }

  return result;
}

/**
 * 충돌 확인
 */
export function checkConflicts(
  scheduledTime: Date,
  duration: number,
  existingEvents: Event[]
): { hasConflict: boolean; conflictingEvent?: Event } {
  const scheduledEnd = new Date(scheduledTime.getTime() + duration * 60000);

  for (const event of existingEvents) {
    const eventStart = new Date(event.datetime);
    const eventEnd = new Date(eventStart.getTime() + event.duration * 60000);

    // 시간 겹침 확인
    if (scheduledTime < eventEnd && scheduledEnd > eventStart) {
      return { hasConflict: true, conflictingEvent: event };
    }
  }

  return { hasConflict: false };
}

/**
 * 최적 시간 찾기
 */
export function findOptimalSlot(
  duration: number,
  deadline: Date,
  existingEvents: Event[],
  preferMorning: boolean = true
): Date | null {
  const now = new Date();
  const startHour = preferMorning ? 9 : 14;
  const endHour = preferMorning ? 14 : 18;

  let currentDate = new Date(now);
  currentDate.setHours(startHour, 0, 0, 0);

  while (currentDate < deadline) {
    const hour = currentDate.getHours();

    // 근무 시간 내인지 확인
    if (hour >= startHour && hour < endHour) {
      const conflict = checkConflicts(currentDate, duration, existingEvents);

      if (!conflict.hasConflict) {
        return currentDate;
      }
    }

    // 30분 단위로 증가
    currentDate.setMinutes(currentDate.getMinutes() + 30);

    // 다음 날로 넘어가면 시작 시간으로 리셋
    if (currentDate.getHours() >= endHour) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(startHour, 0, 0, 0);
    }
  }

  return null;
}
