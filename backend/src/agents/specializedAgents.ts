import OpenAI from 'openai';
import { RouterResult } from './routerAgent.js';
import { AgentResponse } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface AgentContext {
  userId: string;
  today: string;
  endOfMonth: string;
  categories: string[];
}

/**
 * Event Agent - 일정 처리 전문
 */
export async function processEvent(
  routerResult: RouterResult,
  context: AgentContext
): Promise<AgentResponse> {
  const { extractedInfo, missingInfo } = routerResult;

  // 필수 정보 체크: 제목, 날짜/시간
  if (!extractedInfo.title || !extractedInfo.datetime) {
    const missing = [];
    if (!extractedInfo.title) missing.push('Event Title');
    if (!extractedInfo.datetime) missing.push('Date and Time');

    return {
      message: `To add an event, I need ${missing.join(', ')}. Please tell me!`,
      needs_user_input: true
    };
  }

  // 날짜 파싱 (내일, 모레 등 처리)
  let datetime = extractedInfo.datetime;
  if (datetime.includes('내일')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    datetime = datetime.replace('내일', tomorrow.toISOString().split('T')[0]);
  }

  const event = {
    title: extractedInfo.title,
    datetime: datetime,
    duration: extractedInfo.duration || 60,
    location: extractedInfo.location || undefined,
    category: extractedInfo.category || '개인',
    description: extractedInfo.description || undefined
  };

  return {
    message: `Shall I add the event "${event.title}"?`,
    events_to_create: [event]
  };
}

/**
 * Goal Agent - 목표 처리 전문
 */
export async function processGoal(
  routerResult: RouterResult,
  context: AgentContext
): Promise<AgentResponse> {
  const { extractedInfo } = routerResult;

  // 필수 정보 체크: 제목
  if (!extractedInfo.title) {
    return {
      message: 'What goal would you like to set?',
      needs_user_input: true
    };
  }

  // 기한이 없으면 질문
  if (!extractedInfo.targetDate) {
    return {
      message: `Great goal "${extractedInfo.title}"! When do you want to achieve it by?`,
      needs_user_input: true
    };
  }

  const goal = {
    title: extractedInfo.title,
    description: extractedInfo.description || `${extractedInfo.title} 달성하기`,
    target_date: extractedInfo.targetDate,
    priority: extractedInfo.priority || 'medium',
    category: extractedInfo.category || '개인',
    decomposed_todos: []
  };

  return {
    message: `Shall I set the goal "${goal.title}" by ${goal.target_date}?`,
    goals_to_create: [goal]
  };
}

/**
 * Todo Agent - 할 일 처리 전문
 */
export async function processTodo(
  routerResult: RouterResult,
  context: AgentContext
): Promise<AgentResponse> {
  const { extractedInfo } = routerResult;

  // 필수 정보 체크: 제목
  if (!extractedInfo.title) {
    return {
      message: 'What task would you like to add?',
      needs_user_input: true
    };
  }

  const todo = {
    title: extractedInfo.title,
    description: extractedInfo.description || undefined,
    duration: extractedInfo.estimatedTime || 60,
    priority: extractedInfo.priority || 'medium',
    deadline: extractedInfo.deadline || undefined,
    order: 1
  };

  return {
    message: `Shall I add the task "${todo.title}"?`,
    todos_to_create: [todo]
  };
}

/**
 * Briefing Agent - 브리핑 전문
 */
export async function processBriefing(
  context: AgentContext & {
    todayEvents: any[];
    incompleteTodos: any[];
    activeGoals: any[];
  }
): Promise<AgentResponse> {
  const { todayEvents, incompleteTodos, activeGoals, today } = context;

  let briefing = '';

  // Today's Events
  if (todayEvents.length === 0) {
    briefing += 'No events scheduled for today.\n';
  } else {
    briefing += `Today's Events (${todayEvents.length}):\n`;
    todayEvents.forEach(e => {
      const time = e.datetime?.split('T')[1]?.slice(0, 5) || '';
      briefing += `• ${time ? time + ' ' : ''}${e.title}\n`;
    });
  }

  // Todos
  if (incompleteTodos.length > 0) {
    briefing += `\nIncomplete Tasks (${incompleteTodos.length}):\n`;
    incompleteTodos.slice(0, 3).forEach(t => {
      briefing += `• ${t.title}\n`;
    });
    if (incompleteTodos.length > 3) {
      briefing += `  and ${incompleteTodos.length - 3} more...\n`;
    }
  }

  // Active Goals
  if (activeGoals.length > 0) {
    briefing += `\nActive Goals (${activeGoals.length}):\n`;
    activeGoals.slice(0, 2).forEach(g => {
      briefing += `• ${g.title}\n`;
    });
  }

  return {
    message: briefing.trim() || 'No events or tasks for today. Shall we add some?'
  };
}

/**
 * General Agent - 일반 대화 처리
 */
export async function processGeneral(
  userMessage: string,
  context: AgentContext
): Promise<AgentResponse> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the AI assistant for PALM. Converse in a friendly manner and help with schedule/goal/task management.

Capabilities:
- Add/View Events
- Set Goals
- Manage Tasks
- Briefing

IMPORTANT: ALWAYS respond in English.
Keep response simple and friendly.
`
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7
    });

    return {
      message: response.choices[0]?.message?.content || 'How can I help you?'
    };
  } catch (error) {
    return {
      message: 'How can I help you? I can assist with schedules, goals, and tasks.'
    };
  }
}
