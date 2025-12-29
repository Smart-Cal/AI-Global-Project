import OpenAI from 'openai';
import type { CalendarEvent, ChatMessage, ScheduleInfo, EventCategory } from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const getWeekday = (date: Date): string => {
  return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
};

const summarizeEvents = (events: CalendarEvent[]): string => {
  if (!events.length) return '현재 등록된 일정이 없습니다.';

  const today = new Date();
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(today.getDate() + 14);

  const relevant = events.filter((e) => {
    const d = new Date(e.event_date);
    return d >= today && d <= twoWeeksLater;
  });

  if (!relevant.length) return '향후 2주간 등록된 일정이 없습니다.';

  return relevant.slice(0, 10).map((e) => {
    const time = e.start_time?.slice(0, 5) || '종일';
    return `- ${e.event_date} ${time}: ${e.title}`;
  }).join('\n');
};

export const chatWithAI = async (
  userInput: string,
  existingEvents: CalendarEvent[],
  history: ChatMessage[] = []
): Promise<{ message: string; scheduleReady: boolean; scheduleInfo?: ScheduleInfo }> => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

  const systemPrompt = `당신은 친절한 캘린더 AI 어시스턴트입니다.

오늘: ${todayStr} (${getWeekday(today)}요일)

현재 일정:
${summarizeEvents(existingEvents)}

규칙:
1. 자연어로 된 일정 요청을 파싱하세요 ("내일", "다음주 금요일" 등을 YYYY-MM-DD로 변환)
2. 장소 추천 시 실제 존재하는 장소만 추천
3. 충돌하는 일정이 있으면 알려주세요

일정 추가 준비가 되면 반드시 다음 형식으로:

[일정 추가 준비 완료]
- 제목: 일정 제목
- 날짜: YYYY-MM-DD
- 시간: HH:MM
- 종료: HH:MM (선택)
- 장소: 장소명 (선택)
- 카테고리: social/work/health/study/class/task/personal/other
- 메모: 추가 메모 (선택)`;

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userInput },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const text = response.choices[0]?.message?.content || '';
    const scheduleReady = text.includes('[일정 추가 준비 완료]');

    let scheduleInfo: ScheduleInfo | undefined;
    if (scheduleReady) {
      scheduleInfo = extractSchedule(text);
    }

    return { message: text, scheduleReady, scheduleInfo };
  } catch (error) {
    console.error('AI Error:', error);
    return { message: 'AI 서비스에 일시적인 문제가 발생했습니다.', scheduleReady: false };
  }
};

const extractSchedule = (text: string): ScheduleInfo | undefined => {
  try {
    const schedule: Partial<ScheduleInfo> = {};

    const titleMatch = text.match(/제목:\s*(.+?)(?:\n|$)/);
    if (titleMatch) schedule.title = titleMatch[1].trim();

    const dateMatch = text.match(/날짜:\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) schedule.date = dateMatch[1];

    const timeMatch = text.match(/시간:\s*(\d{1,2}:\d{2})/);
    if (timeMatch) schedule.start_time = timeMatch[1];

    const endMatch = text.match(/종료:\s*(\d{1,2}:\d{2})/);
    if (endMatch) schedule.end_time = endMatch[1];

    const locMatch = text.match(/장소:\s*(.+?)(?:\n|$)/);
    if (locMatch) {
      const loc = locMatch[1].trim();
      if (loc && loc !== '미정' && loc !== '-') schedule.location = loc;
    }

    const catMatch = text.match(/카테고리:\s*(\w+)/);
    if (catMatch) {
      const cat = catMatch[1].toLowerCase();
      const valid = ['social', 'work', 'health', 'study', 'class', 'task', 'personal', 'other'];
      schedule.category = valid.includes(cat) ? (cat as EventCategory) : 'other';
    }

    const memoMatch = text.match(/메모:\s*(.+?)(?:\n|$)/);
    if (memoMatch) {
      const memo = memoMatch[1].trim();
      if (memo && memo !== '없음' && memo !== '-') schedule.description = memo;
    }

    return schedule.title && schedule.date ? (schedule as ScheduleInfo) : undefined;
  } catch {
    return undefined;
  }
};
