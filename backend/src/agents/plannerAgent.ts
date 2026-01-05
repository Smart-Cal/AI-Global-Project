import OpenAI from 'openai';
import { PlanResult, PlanItem, Goal, LegacyEvent } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Planner Agent
 * 역할: 목표를 세부 Todo로 분해
 * 입력: "다음주 금요일 시험, 1~5장 공부"
 * 출력: 5개의 일별 Todo 생성 + 시간 배치
 */
export async function createPlan(
  goalDescription: string,
  deadline: string,
  existingEvents: LegacyEvent[],
  context?: {
    available_hours_per_day?: number;
    preferred_time?: 'morning' | 'afternoon' | 'evening';
    break_duration?: number;
  }
): Promise<PlanResult> {
  const availableHours = context?.available_hours_per_day ?? 2;
  const preferredTime = context?.preferred_time ?? 'morning';

  const systemPrompt = `You are a Planner Agent who breaks down goals into achievable detailed plans.

Goal: ${goalDescription}
Deadline: ${deadline}
Daily Available Hours: ${availableHours} hours
Preferred Time: ${preferredTime === 'morning' ? 'Morning' : preferredTime === 'afternoon' ? 'Afternoon' : 'Evening'}

Existing Events:
${JSON.stringify(existingEvents.map(e => ({
    title: e.title,
    datetime: e.datetime
  })).slice(0, 20), null, 2)}

Create a detailed plan in the following JSON format:
{
  "goal_title": "Goal Title",
  "items": [
    {
      "title": "Subtask Title",
      "date": "YYYY-MM-DD",
      "duration": 60,
      "order": 1
    }
  ],
  "total_duration": 300,
  "strategy": "Strategy description for achieving the goal"
}

Planning Rules:
1. Distribute evenly until the deadline
2. Place difficult tasks early
3. Include review/organization time
4. Consider break times
5. Avoid conflicts with existing events
6. Each subtask must be clear and actionable

IMPORTANT: Output valid JSON only. Respond in English.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Please create a detailed plan to achieve the goal above.' }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    return JSON.parse(content) as PlanResult;
  } catch (error) {
    console.error('Planner Agent error:', error);
    return {
      goal_title: goalDescription,
      items: [],
      total_duration: 0,
      strategy: 'An error occurred while generating the plan.'
    };
  }
}

/**
 * 목표 분해 (간단한 경우)
 */
export async function decomposeGoal(
  goalTitle: string,
  subTasks?: string[]
): Promise<PlanItem[]> {
  if (subTasks && subTasks.length > 0) {
    // 사용자가 직접 분해 내용 제공
    const today = new Date();
    return subTasks.map((task, index) => {
      const taskDate = new Date(today);
      taskDate.setDate(taskDate.getDate() + index);

      return {
        title: task,
        date: taskDate.toISOString().split('T')[0],
        duration: 30, // 기본 30분
        order: index + 1
      };
    });
  }

  // AI로 분해
  const systemPrompt = `Decompose the given goal into 3-5 subtasks.

Goal: ${goalTitle}

Respond as a JSON array:
[
  { "title": "Subtask 1", "duration": 30 },
  { "title": "Subtask 2", "duration": 30 }
]
IMPORTANT: Output valid JSON only. Respond in English.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const tasks = parsed.tasks || parsed;

    const today = new Date();
    return tasks.map((task: { title: string; duration?: number }, index: number) => {
      const taskDate = new Date(today);
      taskDate.setDate(taskDate.getDate() + index);

      return {
        title: task.title,
        date: taskDate.toISOString().split('T')[0],
        duration: task.duration || 30,
        order: index + 1
      };
    });
  } catch (error) {
    console.error('Goal decomposition error:', error);
    return [];
  }
}

/**
 * 학습 계획 생성 (시험 준비용)
 */
export async function createStudyPlan(
  subject: string,
  chapters: number,
  examDate: string,
  dailyHours: number = 2
): Promise<PlanResult> {
  const today = new Date();
  const exam = new Date(examDate);
  const daysUntilExam = Math.floor((exam.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (daysUntilExam < chapters) {
    // 시간이 부족한 경우
    return createIntensivePlan(subject, chapters, daysUntilExam, dailyHours);
  }

  // 여유 있는 경우: 챕터당 하루 + 복습일
  const items: PlanItem[] = [];
  let currentDate = new Date(today);

  for (let i = 1; i <= chapters; i++) {
    items.push({
      title: `Study ${subject} Chapter ${i}`,
      date: currentDate.toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: i
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 복습일 추가
  if (daysUntilExam > chapters + 1) {
    items.push({
      title: `Review ${subject} (All)`,
      date: new Date(exam.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: chapters + 1
    });
  }

  return {
    goal_title: `${subject} Exam Prep`,
    items,
    total_duration: items.reduce((sum, item) => sum + item.duration, 0),
    strategy: `Study one chapter (${chapters} total) per day, and review everything the day before the exam.`
  };
}

/**
 * 집중 학습 계획 (시간 부족시)
 */
function createIntensivePlan(
  subject: string,
  chapters: number,
  days: number,
  dailyHours: number
): PlanResult {
  const chaptersPerDay = Math.ceil(chapters / days);
  const items: PlanItem[] = [];
  const today = new Date();

  let remainingChapters = chapters;
  let currentDate = new Date(today);
  let order = 1;

  while (remainingChapters > 0) {
    const todayChapters = Math.min(chaptersPerDay, remainingChapters);
    const startChapter = chapters - remainingChapters + 1;
    const endChapter = startChapter + todayChapters - 1;

    items.push({
      title: `Study ${subject} Ch ${startChapter}${todayChapters > 1 ? `-${endChapter}` : ''}`,
      date: currentDate.toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: order++
    });

    remainingChapters -= todayChapters;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    goal_title: `${subject} Exam Prep (Intensive)`,
    items,
    total_duration: items.reduce((sum, item) => sum + item.duration, 0),
    strategy: `Time is tight! Study ${chaptersPerDay} chapters per day. Get enough rest.`
  };
}
