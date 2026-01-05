import OpenAI from 'openai';
import {
  Event,
  Todo,
  User,
  Chronotype,
  CHRONOTYPE_HOURS,
  ScheduleRequest,
  ScheduleResult,
  ScheduledItem,
  calculateEventDuration
} from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ==============================================
// Chronotype 가중치 계산
// ==============================================

/**
 * 특정 시간이 사용자의 Chronotype에 맞는지 점수 계산
 * @returns 0~100 점수 (높을수록 집중하기 좋은 시간)
 */
export function calculateChronotypeScore(hour: number, chronotype: Chronotype): number {
  const range = CHRONOTYPE_HOURS[chronotype];

  // night의 경우 특별 처리 (21:00 ~ 02:00)
  if (chronotype === 'night') {
    if (hour >= 21 || hour < 2) {
      return 100; // 최적 시간
    } else if (hour >= 19 || hour < 4) {
      return 70; // 괜찮은 시간
    } else if (hour >= 17 || hour < 6) {
      return 40; // 보통
    }
    return 20; // 비선호 시간
  }

  // 일반 Chronotype
  const { start, end } = range;

  if (hour >= start && hour < end) {
    return 100; // 최적 시간
  }

  // 최적 시간대 ±2시간
  if (hour >= start - 2 && hour < end + 2) {
    return 70; // 괜찮은 시간
  }

  // 최적 시간대 ±4시간
  if (hour >= start - 4 && hour < end + 4) {
    return 40; // 보통
  }

  return 20; // 비선호 시간
}

/**
 * 시간 슬롯에 Chronotype 점수 부여
 */
export function scoreTimeSlot(
  date: string,
  startTime: string,
  endTime: string,
  chronotype: Chronotype,
  priority: 'high' | 'medium' | 'low'
): number {
  const [startHour] = startTime.split(':').map(Number);
  const [endHour] = endTime.split(':').map(Number);

  // 시간대 중앙값으로 점수 계산
  const midHour = Math.floor((startHour + endHour) / 2);
  let score = calculateChronotypeScore(midHour, chronotype);

  // Priority에 따른 보정
  // 높은 우선순위 작업일수록 Chronotype 매칭이 더 중요
  if (priority === 'high') {
    // 고 우선순위: Chronotype 점수 그대로 적용
    score = score;
  } else if (priority === 'medium') {
    // 중 우선순위: Chronotype 영향 줄이기
    score = (score + 50) / 2;
  } else {
    // 저 우선순위: Chronotype 거의 무시
    score = (score + 70) / 2;
  }

  return Math.round(score);
}

// ==============================================
// 빈 시간 슬롯 계산 (v3.1 업데이트)
// ==============================================

export interface TimeSlot {
  date: string;          // YYYY-MM-DD
  start_time: string;    // HH:MM
  end_time: string;      // HH:MM
  duration: number;      // 분 단위
  chronotype_score: number; // 0~100
}

/**
 * 빈 시간 슬롯 계산 (Chronotype 점수 포함)
 */
export function calculateAvailableSlots(
  events: Event[],
  chronotype: Chronotype,
  startDate: string,
  endDate: string,
  workStart: number = 8,
  workEnd: number = 22
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    // 해당 날짜의 이벤트 필터링
    const dayEvents = events
      .filter(e => e.event_date === dateStr && !e.is_completed)
      .map(e => ({
        start: e.start_time ? parseTime(e.start_time) : workStart * 60,
        end: e.end_time ? parseTime(e.end_time) : (workStart + 1) * 60,
        is_fixed: e.is_fixed,
        priority: e.priority
      }))
      .sort((a, b) => a.start - b.start);

    // 빈 시간 슬롯 찾기
    let currentMinute = workStart * 60;
    const endMinute = workEnd * 60;

    for (const event of dayEvents) {
      // 이벤트 전 빈 시간이 있으면 추가
      if (currentMinute < event.start) {
        const slotStart = formatTime(currentMinute);
        const slotEnd = formatTime(event.start);
        const duration = event.start - currentMinute;

        // 최소 30분 이상인 슬롯만 추가
        if (duration >= 30) {
          slots.push({
            date: dateStr,
            start_time: slotStart,
            end_time: slotEnd,
            duration,
            chronotype_score: calculateChronotypeScore(
              Math.floor(currentMinute / 60),
              chronotype
            )
          });
        }
      }
      currentMinute = Math.max(currentMinute, event.end);
    }

    // 마지막 이벤트 후 빈 시간
    if (currentMinute < endMinute) {
      const slotStart = formatTime(currentMinute);
      const slotEnd = formatTime(endMinute);
      const duration = endMinute - currentMinute;

      if (duration >= 30) {
        slots.push({
          date: dateStr,
          start_time: slotStart,
          end_time: slotEnd,
          duration,
          chronotype_score: calculateChronotypeScore(
            Math.floor(currentMinute / 60),
            chronotype
          )
        });
      }
    }
  }

  return slots;
}

// 시간 파싱 헬퍼 (HH:MM -> 분)
function parseTime(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

// 시간 포맷 헬퍼 (분 -> HH:MM)
function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ==============================================
// 최적 슬롯 찾기
// ==============================================

/**
 * Todo에 최적인 시간 슬롯 찾기
 */
export function findBestSlotForTodo(
  todo: Todo,
  availableSlots: TimeSlot[],
  chronotype: Chronotype
): TimeSlot | null {
  const requiredDuration = todo.estimated_time || 60; // 기본 1시간

  // 충분한 시간이 있는 슬롯만 필터링
  const suitableSlots = availableSlots.filter(slot => slot.duration >= requiredDuration);

  if (suitableSlots.length === 0) return null;

  // 슬롯 점수 계산
  const scoredSlots = suitableSlots.map(slot => {
    let score = slot.chronotype_score;

    // 고 우선순위 작업은 Chronotype 점수 가중
    if (todo.priority === 'high') {
      score *= 1.5;
    }

    // 마감일이 있으면 가까운 날짜 선호
    if (todo.deadline) {
      const deadline = new Date(todo.deadline);
      const slotDate = new Date(slot.date);
      const daysUntilDeadline = Math.ceil((deadline.getTime() - slotDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDeadline <= 1) {
        score *= 2; // 마감 임박: 높은 가중치
      } else if (daysUntilDeadline <= 3) {
        score *= 1.5;
      }
    }

    // 분할 불가능한 작업은 연속 시간 필요
    if (!todo.is_divisible && slot.duration < requiredDuration) {
      score = 0;
    }

    return { slot, score };
  });

  // 점수가 가장 높은 슬롯 선택
  scoredSlots.sort((a, b) => b.score - a.score);

  return scoredSlots[0]?.slot || null;
}

// ==============================================
// 충돌 확인
// ==============================================

/**
 * 시간 충돌 확인
 */
export function checkConflicts(
  date: string,
  startTime: string,
  duration: number,
  existingEvents: Event[]
): { hasConflict: boolean; conflictingEvent?: Event } {
  const newStart = parseTime(startTime);
  const newEnd = newStart + duration;

  for (const event of existingEvents) {
    if (event.event_date !== date) continue;
    if (!event.start_time) continue;

    const eventStart = parseTime(event.start_time);
    const eventEnd = event.end_time ? parseTime(event.end_time) : eventStart + 60;

    // 시간 겹침 확인
    if (newStart < eventEnd && newEnd > eventStart) {
      return { hasConflict: true, conflictingEvent: event };
    }
  }

  return { hasConflict: false };
}

// ==============================================
// 메인 스케줄링 함수
// ==============================================

/**
 * Todo들을 최적 시간에 배치
 */
export async function scheduleTodos(
  request: ScheduleRequest
): Promise<ScheduleResult> {
  const { todos, existing_events, user_chronotype, date_range } = request;

  // 1. 빈 시간 슬롯 계산
  const availableSlots = calculateAvailableSlots(
    existing_events,
    user_chronotype,
    date_range.start,
    date_range.end
  );

  // 2. Todo 우선순위 정렬
  const sortedTodos = [...todos].sort((a, b) => {
    // 마감일 있는 것 우선
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;

    // 마감일 가까운 것 우선
    if (a.deadline && b.deadline) {
      const diff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      if (diff !== 0) return diff;
    }

    // 우선순위 높은 것 우선
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // 3. 각 Todo에 최적 슬롯 배치
  const scheduledItems: ScheduledItem[] = [];
  const unscheduledTodos: string[] = [];
  let remainingSlots = [...availableSlots];

  for (const todo of sortedTodos) {
    const bestSlot = findBestSlotForTodo(todo, remainingSlots, user_chronotype);

    if (bestSlot) {
      const duration = todo.estimated_time || 60;

      scheduledItems.push({
        todo_id: todo.id,
        title: todo.title,
        scheduled_date: bestSlot.date,
        scheduled_time: bestSlot.start_time,
        duration,
        reason: generateScheduleReason(bestSlot, todo, user_chronotype)
      });

      // 사용한 슬롯 제거 또는 분할
      remainingSlots = updateRemainingSlots(remainingSlots, bestSlot, duration, user_chronotype);
    } else {
      unscheduledTodos.push(todo.id);
    }
  }

  // 4. 결과 반환
  return {
    scheduled_items: scheduledItems,
    unscheduled_todos: unscheduledTodos,
    conflicts: unscheduledTodos.length > 0
      ? [`Not enough time to schedule ${unscheduledTodos.length} Todos.`]
      : [],
    suggestions: generateSuggestions(scheduledItems, unscheduledTodos, user_chronotype)
  };
}

/**
 * 스케줄 이유 생성
 */
function generateScheduleReason(
  slot: TimeSlot,
  todo: Todo,
  chronotype: Chronotype
): string {
  const reasons: string[] = [];

  if (slot.chronotype_score >= 80) {
    reasons.push(`${chronotype} Focus Time`);
  } else if (slot.chronotype_score >= 50) {
    reasons.push('Good Time');
  }

  if (todo.priority === 'high') {
    reasons.push('High Priority');
  }

  if (todo.deadline) {
    const daysUntil = Math.ceil(
      (new Date(todo.deadline).getTime() - new Date(slot.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntil <= 1) {
      reasons.push('Deadline Approaching');
    }
  }

  return reasons.join(', ') || 'Free Time';
}

/**
 * 슬롯 사용 후 남은 슬롯 업데이트
 */
function updateRemainingSlots(
  slots: TimeSlot[],
  usedSlot: TimeSlot,
  usedDuration: number,
  chronotype: Chronotype
): TimeSlot[] {
  return slots.flatMap(slot => {
    if (slot.date !== usedSlot.date || slot.start_time !== usedSlot.start_time) {
      return [slot];
    }

    // 사용한 슬롯 분할
    const usedEnd = parseTime(usedSlot.start_time) + usedDuration;
    const slotEnd = parseTime(slot.end_time);

    if (usedEnd < slotEnd) {
      // 남은 시간이 있으면 새 슬롯 생성
      const newStart = formatTime(usedEnd);
      const remainingDuration = slotEnd - usedEnd;

      if (remainingDuration >= 30) {
        return [{
          date: slot.date,
          start_time: newStart,
          end_time: slot.end_time,
          duration: remainingDuration,
          chronotype_score: calculateChronotypeScore(
            Math.floor(usedEnd / 60),
            chronotype
          )
        }];
      }
    }

    return [];
  });
}

/**
 * 제안 사항 생성
 */
function generateSuggestions(
  scheduled: ScheduledItem[],
  unscheduled: string[],
  chronotype: Chronotype
): string[] {
  const suggestions: string[] = [];

  if (unscheduled.length > 0) {
    suggestions.push('Some tasks could not be scheduled. Please adjust existing events or extend deadlines.');
  }

  const chronotypeNames: Record<Chronotype, string> = {
    early_morning: 'Early Morning (05-09)',
    morning: 'Morning (09-12)',
    afternoon: 'Afternoon (12-17)',
    evening: 'Evening (17-21)',
    night: 'Night (21-02)'
  };

  suggestions.push(`Your focus time is ${chronotypeNames[chronotype]}. Important tasks are scheduled during this time.`);

  return suggestions;
}

// ==============================================
// AI 기반 스케줄링 (복잡한 케이스용)
// ==============================================

/**
 * AI를 사용한 고급 스케줄링 (충돌 해결 등)
 */
export async function scheduleWithAI(
  todos: Todo[],
  events: Event[],
  user: User
): Promise<ScheduleResult> {
  const availableSlots = calculateAvailableSlots(
    events,
    user.chronotype,
    new Date().toISOString().split('T')[0],
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );

  const systemPrompt = `You are valid Scheduler Agent for PALM.
Optimize schedule based on user's Chronotype and priorities.

## User Info
- Chronotype: ${user.chronotype}
- Focus Hours: ${JSON.stringify(CHRONOTYPE_HOURS[user.chronotype])}

## Current Events
${JSON.stringify(events.map(e => ({
    title: e.title,
    date: e.event_date,
    start: e.start_time,
    end: e.end_time,
    is_fixed: e.is_fixed,
    priority: e.priority
  })), null, 2)}

## Available Slots (with Chronotype score)
${JSON.stringify(availableSlots.slice(0, 20), null, 2)}

## Todos to Schedule
${JSON.stringify(todos.map(t => ({
    id: t.id,
    title: t.title,
    deadline: t.deadline,
    estimated_time: t.estimated_time,
    is_divisible: t.is_divisible,
    priority: t.priority
  })), null, 2)}

## Scheduling Rules
1. Place high priority tasks in high Chronotype score slots
2. Prioritize tasks with approaching deadlines
3. Keep indivisible tasks continuous
4. Can suggest moving non-fixed (is_fixed=false) events

Respond in JSON format:
{
  "scheduled_items": [
    {
      "todo_id": "uuid",
      "title": "Title",
      "scheduled_date": "YYYY-MM-DD",
      "scheduled_time": "HH:MM",
      "duration": 60,
      "reason": "Reason"
    }
  ],
  "unscheduled_todos": ["List of unscheduled todo_ids"],
  "conflicts": ["Description of conflicts"],
  "suggestions": ["Suggestions"]
}

IMPORTANT: Output valid JSON only. Respond in English.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please optimize the schedule for the above Todos.' }
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
    console.error('AI Scheduler error:', error);

    // 폴백: 기본 알고리즘 사용
    return scheduleTodos({
      todos,
      existing_events: events,
      user_chronotype: user.chronotype,
      date_range: {
        start: new Date().toISOString().split('T')[0],
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      }
    });
  }
}
