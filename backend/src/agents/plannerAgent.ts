import OpenAI from 'openai';
import { PlanResult, PlanItem, Goal, Event } from '../types/index.js';

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
  existingEvents: Event[],
  context?: {
    available_hours_per_day?: number;
    preferred_time?: 'morning' | 'afternoon' | 'evening';
    break_duration?: number;
  }
): Promise<PlanResult> {
  const availableHours = context?.available_hours_per_day ?? 2;
  const preferredTime = context?.preferred_time ?? 'morning';

  const systemPrompt = `당신은 목표를 달성 가능한 세부 계획으로 분해하는 Planner Agent입니다.

목표: ${goalDescription}
마감일: ${deadline}
하루 가용 시간: ${availableHours}시간
선호 시간대: ${preferredTime === 'morning' ? '오전' : preferredTime === 'afternoon' ? '오후' : '저녁'}

기존 일정:
${JSON.stringify(existingEvents.map(e => ({
  title: e.title,
  datetime: e.datetime
})).slice(0, 20), null, 2)}

다음 JSON 형식으로 상세 계획을 생성하세요:
{
  "goal_title": "목표 제목",
  "items": [
    {
      "title": "세부 작업 제목",
      "date": "YYYY-MM-DD",
      "duration": 60,
      "order": 1
    }
  ],
  "total_duration": 300,
  "strategy": "목표 달성을 위한 전략 설명"
}

계획 수립 규칙:
1. 마감일까지 균등하게 분배
2. 난이도가 높은 작업은 초반에 배치
3. 복습/정리 시간 포함
4. 휴식 시간 고려
5. 기존 일정과 충돌 방지
6. 각 세부 작업은 명확하고 실행 가능해야 함`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: '위 목표를 달성하기 위한 상세 계획을 세워주세요.' }
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
      strategy: '계획 생성 중 오류가 발생했습니다.'
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
  const systemPrompt = `주어진 목표를 3-5개의 세부 작업으로 분해하세요.

목표: ${goalTitle}

JSON 배열로 응답하세요:
[
  { "title": "세부 작업 1", "duration": 30 },
  { "title": "세부 작업 2", "duration": 30 }
]`;

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
      title: `${subject} ${i}장 학습`,
      date: currentDate.toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: i
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 복습일 추가
  if (daysUntilExam > chapters + 1) {
    items.push({
      title: `${subject} 전체 복습`,
      date: new Date(exam.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: chapters + 1
    });
  }

  return {
    goal_title: `${subject} 시험 준비`,
    items,
    total_duration: items.reduce((sum, item) => sum + item.duration, 0),
    strategy: `${chapters}개 챕터를 하루에 하나씩 학습하고, 시험 전날 전체 복습을 진행합니다.`
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
      title: `${subject} ${startChapter}${todayChapters > 1 ? `~${endChapter}` : ''}장 학습`,
      date: currentDate.toISOString().split('T')[0],
      duration: dailyHours * 60,
      order: order++
    });

    remainingChapters -= todayChapters;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    goal_title: `${subject} 시험 준비 (집중 모드)`,
    items,
    total_duration: items.reduce((sum, item) => sum + item.duration, 0),
    strategy: `시간이 촉박하여 하루에 ${chaptersPerDay}개 챕터씩 집중 학습합니다. 충분한 휴식을 취하세요.`
  };
}
