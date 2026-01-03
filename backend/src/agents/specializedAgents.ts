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
    if (!extractedInfo.title) missing.push('일정 제목');
    if (!extractedInfo.datetime) missing.push('날짜와 시간');

    return {
      message: `일정을 추가하려면 ${missing.join(', ')}이 필요해요. 알려주세요!`,
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
    message: `"${event.title}" 일정을 추가할까요?`,
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
      message: '어떤 목표를 세우고 싶으신가요?',
      needs_user_input: true
    };
  }

  // 기한이 없으면 질문
  if (!extractedInfo.targetDate) {
    return {
      message: `"${extractedInfo.title}" 목표 좋네요! 언제까지 달성하고 싶으신가요?`,
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
    message: `"${goal.title}" 목표를 ${goal.target_date}까지 설정할까요?`,
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
      message: '어떤 할 일을 추가할까요?',
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
    message: `"${todo.title}" 할 일을 추가할까요?`,
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

  // 오늘 일정
  if (todayEvents.length === 0) {
    briefing += '오늘은 예정된 일정이 없어요.\n';
  } else {
    briefing += `오늘 일정 ${todayEvents.length}개:\n`;
    todayEvents.forEach(e => {
      const time = e.datetime?.split('T')[1]?.slice(0, 5) || '';
      briefing += `• ${time ? time + ' ' : ''}${e.title}\n`;
    });
  }

  // 할 일
  if (incompleteTodos.length > 0) {
    briefing += `\n미완료 할 일 ${incompleteTodos.length}개:\n`;
    incompleteTodos.slice(0, 3).forEach(t => {
      briefing += `• ${t.title}\n`;
    });
    if (incompleteTodos.length > 3) {
      briefing += `  외 ${incompleteTodos.length - 3}개...\n`;
    }
  }

  // 진행 중 목표
  if (activeGoals.length > 0) {
    briefing += `\n진행 중인 목표 ${activeGoals.length}개:\n`;
    activeGoals.slice(0, 2).forEach(g => {
      briefing += `• ${g.title}\n`;
    });
  }

  return {
    message: briefing.trim() || '오늘의 일정과 할 일이 없어요. 새로 추가해볼까요?'
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
          content: `당신은 PALM 캘린더의 AI 비서입니다. 친절하게 대화하고, 일정/목표/할일 관리를 도와주세요.

가능한 도움:
- 일정 추가/조회
- 목표 설정
- 할 일 관리
- 브리핑

간단하고 친근하게 응답하세요.`
        },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7
    });

    return {
      message: response.choices[0]?.message?.content || '무엇을 도와드릴까요?'
    };
  } catch (error) {
    return {
      message: '무엇을 도와드릴까요? 일정, 목표, 할 일 관리를 도와드릴 수 있어요.'
    };
  }
}
