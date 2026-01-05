import OpenAI from 'openai';
import { parseUserInput } from './parserAgent.js';
import { createPlan, decomposeGoal } from './plannerAgent.js';
import {
  OrchestratorContext,
  AgentResponse,
  LegacyEvent,
  Todo,
  ParsedInput,
  ScheduledItem
} from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Main Orchestrator
 * Role: Manage overall conversation flow and orchestrate sub-agents
 * Function: Understand user intent, call appropriate agents, generate responses
 */
export class MainOrchestrator {
  private context: OrchestratorContext;

  constructor(context: OrchestratorContext) {
    this.context = context;
  }

  /**
   * 메인 대화 처리
   */
  async processMessage(userMessage: string): Promise<AgentResponse> {
    // 1. Parser Agent로 입력 분석
    const currentDate = new Date().toISOString();
    const parsed = await parseUserInput(userMessage, currentDate);

    // 2. 명확화가 필요한 경우
    if (parsed.needs_clarification && parsed.clarification_question) {
      return {
        message: parsed.clarification_question,
        needs_user_input: true
      };
    }

    // 3. 의도에 따라 적절한 Agent 호출
    let response: AgentResponse;

    switch (parsed.type) {
      case 'fixed':
      case 'personal':
        response = await this.handleEventCreation(parsed);
        break;

      case 'goal':
        response = await this.handleGoalPlanning(parsed, userMessage);
        break;

      case 'todo':
        response = await this.handleTodoCreation(parsed);
        break;

      default:
        response = await this.handleGeneralConversation(userMessage);
    }

    // 4. 대화 기록 업데이트
    this.context.conversation_history.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: response.message }
    );

    return response;
  }

  /**
   * 일정 생성 처리
   */
  private async handleEventCreation(parsed: ParsedInput): Promise<AgentResponse> {
    const eventsToCreate: Partial<LegacyEvent>[] = parsed.events.map(e => ({
      user_id: this.context.user_id,
      title: e.title,
      datetime: e.datetime || new Date().toISOString(),
      duration: e.duration || 60,
      type: e.type || 'personal',
      location: e.location,
      description: e.description,
      is_completed: false
    }));

    // 관련 Todo도 처리
    let todosToCreate: Partial<Todo>[] = [];
    let scheduledItems: ScheduledItem[] = [];

    if (parsed.todos.length > 0) {
      todosToCreate = parsed.todos.map(t => ({
        user_id: this.context.user_id,
        title: t.title,
        deadline: t.deadline || eventsToCreate[0]?.datetime || new Date().toISOString(),
        estimated_time: t.duration || t.estimated_time || 30,
        completed_time: 0,
        priority: t.priority || 'medium',
        is_completed: false,
        is_hard_deadline: false,
        is_divisible: true
      }));

      // 스케줄링은 나중에 처리 (scheduleTodos는 새 타입 필요)
      // 현재는 수동 배치
      scheduledItems = todosToCreate.map((t, idx) => ({
        todo_id: `temp_${idx}`,
        title: t.title || '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '09:00',
        duration: t.estimated_time || 30,
        reason: 'Temporary placement'
      }));
    }

    // 응답 메시지 생성
    const message = await this.generateResponse({
      type: 'event_created',
      events: eventsToCreate,
      todos: todosToCreate,
      scheduled_items: scheduledItems
    });

    return {
      message,
      events_to_create: eventsToCreate,
      todos_to_create: todosToCreate,
      todos_to_schedule: scheduledItems
    };
  }

  /**
   * 목표/계획 처리
   */
  private async handleGoalPlanning(parsed: ParsedInput, originalMessage: string): Promise<AgentResponse> {
    // 분해가 필요한지 확인
    const needsDecomposition = await this.checkNeedsDecomposition(originalMessage);

    if (needsDecomposition) {
      return {
        message: 'Is there anything specific you want to break down? For example, "Bathroom, Bedroom, Living room".',
        needs_user_input: true,
        suggestions: ['Waiting for details']
      };
    }

    // 이벤트와 관련 Todo 생성
    const eventsToCreate: Partial<LegacyEvent>[] = parsed.events.map(e => ({
      user_id: this.context.user_id,
      title: e.title,
      datetime: e.datetime || new Date().toISOString(),
      duration: e.duration || 60,
      type: 'goal' as const,
      description: e.description,
      is_completed: false
    }));

    const todosToCreate: Partial<Todo>[] = parsed.todos.map(t => ({
      user_id: this.context.user_id,
      title: t.title,
      deadline: t.deadline || eventsToCreate[0]?.datetime,
      estimated_time: t.duration || t.estimated_time || 30,
      completed_time: 0,
      priority: t.priority || 'medium',
      is_completed: false,
      is_hard_deadline: false,
      is_divisible: true
    }));

    const message = await this.generateResponse({
      type: 'goal_planned',
      events: eventsToCreate,
      todos: todosToCreate
    });

    return {
      message,
      events_to_create: eventsToCreate,
      todos_to_create: todosToCreate
    };
  }

  /**
   * Todo 생성 처리
   */
  private async handleTodoCreation(parsed: ParsedInput): Promise<AgentResponse> {
    const todosToCreate: Partial<Todo>[] = parsed.todos.map(t => ({
      user_id: this.context.user_id,
      title: t.title,
      deadline: t.deadline || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      estimated_time: t.duration || t.estimated_time || 30,
      completed_time: 0,
      priority: t.priority || 'medium',
      is_completed: false,
      is_hard_deadline: false,
      is_divisible: true
    }));

    // 임시 스케줄 아이템 생성
    const scheduledItems: ScheduledItem[] = todosToCreate.map((t, idx) => ({
      todo_id: `temp_${idx}`,
      title: t.title || '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00',
      duration: t.estimated_time || 30,
      reason: '임시 배치'
    }));

    const message = await this.generateResponse({
      type: 'todo_created',
      todos: todosToCreate,
      scheduled_items: scheduledItems,
      suggestions: []
    });

    return {
      message,
      todos_to_create: todosToCreate,
      todos_to_schedule: scheduledItems,
      suggestions: []
    };
  }

  /**
   * 일반 대화 처리
   */
  private async handleGeneralConversation(userMessage: string): Promise<AgentResponse> {
    const todayDate = new Date().toISOString().split('T')[0];
    const todayEventsCount = this.context.events.filter(e => e.datetime.startsWith(todayDate)).length;
    const activeGoalsCount = this.context.goals.filter(g => !['completed', 'failed'].includes(g.status)).length;
    const incompleteTodosCount = this.context.todos.filter(t => !t.is_completed).length;

    const systemPrompt = `You are the AI assistant for PALM (Personal AI Life Manager).

Your role is to manage and optimize the user's schedule and goals.

Current User Info:
- Today's Events: ${todayEventsCount}
- Active Goals: ${activeGoalsCount}
- Incomplete Todos: ${incompleteTodosCount}

IMPORTANT Rules:
1. LANGUAGE: ALWAYS respond in English. No matter what language the user uses, your response MUST be in English.
2. Tone: Friendly and helpful.
3. Provide help with scheduling, goal setting, and Todo management.
4. Keep responses concise (2-3 sentences).`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...this.context.conversation_history.slice(-10) as any,
          { role: 'user', content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 500
      });

      return {
        message: response.choices[0]?.message?.content || 'Sorry, please say that again.'
      };
    } catch (error) {
      console.error('General conversation error:', error);
      return {
        message: 'Please let me know if you want to add any schedules or tasks!'
      };
    }
  }

  /**
   * 분해 필요 여부 확인
   */
  private async checkNeedsDecomposition(message: string): Promise<boolean> {
    const decompositionKeywords = ['청소', '정리', '공부', '준비'];
    const hasKeyword = decompositionKeywords.some(k => message.includes(k));

    // 이미 세부 항목이 포함되어 있으면 분해 불필요
    const hasDetails = message.includes(',') || message.includes('먼저') || message.includes('그다음');

    return hasKeyword && !hasDetails;
  }

  /**
   * 응답 메시지 생성 - 일정은 확인 후 추가되므로 제안 형태로 메시지 생성
   */
  private async generateResponse(context: {
    type: string;
    events?: Partial<LegacyEvent>[];
    todos?: Partial<Todo>[];
    scheduled_items?: ScheduledItem[];
    suggestions?: string[];
  }): Promise<string> {
    const { type, events = [], todos = [], scheduled_items = [], suggestions = [] } = context;

    // 여러 일정이 있는 경우 (계획/추천)
    if (events.length > 1) {
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const scheduleList = events.map(e => {
        if (!e.datetime) return e.title;
        const date = new Date(e.datetime);
        const dayName = weekdays[date.getDay()];
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `${dayName} ${timeStr} - ${e.title}`;
      }).join('\n');

      return `How about these schedules? 📅\n\n${scheduleList}\n\nPlease select the ones you want to add!`;
    }

    // 간단한 템플릿 기반 응답
    switch (type) {
      case 'event_created':
        let msg = '';
        if (events.length > 0) {
          const event = events[0];
          const dateStr = event.datetime ? new Date(event.datetime).toLocaleDateString('en-US') : 'Today';
          const timeStr = event.datetime ? new Date(event.datetime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
          msg = `How about adding "${event.title}" on ${dateStr} at ${timeStr}?`;
        }
        if (todos.length > 0 && scheduled_items.length > 0) {
          const todoItem = scheduled_items[0];
          const scheduledTime = todoItem.scheduled_time || '09:00';
          msg += ` Shall I schedule "${todos[0].title}" at ${scheduledTime}?`;
        }
        return msg || 'Please check the schedule below!';

      case 'todo_created':
        if (todos.length === 0) return 'Please check the tasks!';
        const todoMsg = todos.map(t => `"${t.title}"`).join(', ');
        return `Shall I add ${todoMsg}? I'll find the best time for them.`;

      case 'goal_planned':
        if (events.length === 0 && todos.length === 0) return 'I planned your goal!';
        let planMsg = 'Here is the plan:\n';
        if (events.length > 0) {
          planMsg += `"${events[0].title}" schedule`;
        }
        if (todos.length > 0) {
          planMsg += ` + ${todos.length} related tasks`;
        }
        planMsg += '\n\nWould you like to add these?';
        return planMsg;

      default:
        return 'Please confirm!';
    }
  }

  /**
   * 하위 작업 분해 처리
   */
  async processDecomposition(subTasks: string[]): Promise<AgentResponse> {
    const lastEvent = this.context.events[this.context.events.length - 1];

    const todosToCreate: Partial<Todo>[] = subTasks.map((task, index) => ({
      user_id: this.context.user_id,
      title: task,
      deadline: lastEvent?.datetime || new Date().toISOString(),
      estimated_time: 30,
      completed_time: 0,
      priority: 'medium' as const,
      is_completed: false,
      is_hard_deadline: false,
      is_divisible: true
    }));

    // 임시 스케줄 생성
    const scheduledItems: ScheduledItem[] = todosToCreate.map((t, idx) => ({
      todo_id: `temp_${idx}`,
      title: t.title || '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00',
      duration: t.estimated_time || 30,
      reason: 'Temporary placement'
    }));

    const totalDuration = todosToCreate.reduce((sum, t) => sum + (t.estimated_time || 30), 0);
    const message = `I estimated 30 mins each! Total ${totalDuration} mins expected. Should we do it all at once or split it up?`;

    return {
      message,
      todos_to_create: todosToCreate,
      todos_to_schedule: scheduledItems,
      needs_user_input: true,
      suggestions: ['All at once', 'Split up', 'Set time manually']
    };
  }
}

/**
 * Orchestrator 인스턴스 생성 헬퍼
 */
export function createOrchestrator(context: OrchestratorContext): MainOrchestrator {
  return new MainOrchestrator(context);
}
