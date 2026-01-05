import OpenAI from 'openai';
import type { CalendarEvent, ChatMessage, ScheduleInfo } from '../types';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const getWeekday = (date: Date): string => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
};

const summarizeEvents = (events: CalendarEvent[]): string => {
  if (!events.length) return 'No events currently registered.';

  const today = new Date();
  const twoWeeksLater = new Date(today);
  twoWeeksLater.setDate(today.getDate() + 14);

  const relevant = events.filter((e) => {
    const d = new Date(e.event_date);
    return d >= today && d <= twoWeeksLater;
  });

  if (!relevant.length) return 'No events registered for the next 2 weeks.';

  return relevant.slice(0, 10).map((e) => {
    const time = e.start_time?.slice(0, 5) || 'All Day';
    return `- ${e.event_date} ${time}: ${e.title}`;
  }).join('\n');
};

export const chatWithAI = async (
  userInput: string,
  existingEvents: CalendarEvent[],
  history: ChatMessage[] = []
): Promise<{ message: string; scheduleReady: boolean; scheduleInfo?: ScheduleInfo }> => {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const systemPrompt = `You are a friendly calendar AI assistant.

Today: ${todayStr} (${getWeekday(today)})

Current Schedule:
${summarizeEvents(existingEvents)}

Rules:
1. Parse natural language schedule requests (convert "tomorrow", "next Friday", etc. to YYYY-MM-DD).
2. Recommend only real places when suggesting locations.
3. Notify if there are conflicting schedules.

When ready to add a schedule, you MUST format it exactly as follows:

[Schedule Addition Ready]
- Title: Event Title
- Date: YYYY-MM-DD
- Time: HH:MM
- End: HH:MM (Optional)
- Location: Location Name (Optional)
- Category: social/work/health/study/class/task/personal/other
- Memo: Additional Info (Optional)

IMPORTANT: You must ALWAYS generate your response in English, even if the user speaks to you in a different language. Do not use Korean.`;

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
    const scheduleReady = text.includes('[Schedule Addition Ready]');

    let scheduleInfo: ScheduleInfo | undefined;
    if (scheduleReady) {
      scheduleInfo = extractSchedule(text);
    }

    return { message: text, scheduleReady, scheduleInfo };
  } catch (error) {
    console.error('AI Error:', error);
    return { message: 'A temporary issue occurred with the AI service.', scheduleReady: false };
  }
};

const extractSchedule = (text: string): ScheduleInfo | undefined => {
  try {
    const schedule: Partial<ScheduleInfo> = {};

    const titleMatch = text.match(/Title:\s*(.+?)(?:\n|$)/);
    if (titleMatch) schedule.title = titleMatch[1].trim();

    const dateMatch = text.match(/Date:\s*(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) schedule.date = dateMatch[1];

    const timeMatch = text.match(/Time:\s*(\d{1,2}:\d{2})/);
    if (timeMatch) schedule.start_time = timeMatch[1];

    const endMatch = text.match(/End:\s*(\d{1,2}:\d{2})/);
    if (endMatch) schedule.end_time = endMatch[1];

    const locMatch = text.match(/Location:\s*(.+?)(?:\n|$)/);
    if (locMatch) {
      const loc = locMatch[1].trim();
      if (loc && loc !== 'TBD' && loc !== '-') schedule.location = loc;
    }

    const catMatch = text.match(/Category:\s*(.+?)(?:\n|$)/);
    if (catMatch) {
      const cat = catMatch[1].trim();
      if (cat && cat !== 'TBD' && cat !== '-') {
        schedule.category_name = cat;
      }
    }

    const memoMatch = text.match(/Memo:\s*(.+?)(?:\n|$)/);
    if (memoMatch) {
      const memo = memoMatch[1].trim();
      if (memo && memo !== 'None' && memo !== '-') schedule.description = memo;
    }

    return schedule.title && schedule.date ? (schedule as ScheduleInfo) : undefined;
  } catch {
    return undefined;
  }
};
