import OpenAI from 'openai';
import { parseUserInput } from './parserAgent.js';
import { scheduleTodos, calculateAvailableSlots } from './schedulerAgent.js';
import { createPlan, decomposeGoal } from './plannerAgent.js';
import {
  OrchestratorContext,
  AgentResponse,
  ChatMessage,
  Event,
  Todo,
  ParsedInput
} from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Main Orchestrator
 * 역할: 전체 대화 흐름 관리 및 하위 Agent 조율
 * 기능: 사용자 의도 파악, 적절한 Agent 호출, 응답 생성
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
    const eventsToCreate: Partial<Event>[] = parsed.events.map(e => ({
      user_id: this.context.user_id,
      title: e.title,
      datetime: e.datetime || new Date().toISOString(),
      duration: e.duration || 60,
      type: e.type,
      location: e.location,
      description: e.description,
      is_completed: false
    }));

    // 관련 Todo도 처리
    let todosToCreate: Partial<Todo>[] = [];
    let scheduledItems: any[] = [];

    if (parsed.todos.length > 0) {
      todosToCreate = parsed.todos.map(t => ({
        user_id: this.context.user_id,
        title: t.title,
        timing: t.timing || 'before',
        deadline: t.deadline || eventsToCreate[0]?.datetime || new Date().toISOString(),
        duration: t.duration || 30,
        priority: t.priority || 'medium',
        is_completed: false
      }));

      // Scheduler Agent로 시간 배치
      const scheduleResult = await scheduleTodos(
        todosToCreate,
        this.context.events
      );
      scheduledItems = scheduleResult.scheduled_items;

      // 배치된 시간 적용
      scheduledItems.forEach((item, index) => {
        if (todosToCreate[index]) {
          todosToCreate[index].scheduled_at = item.scheduled_at;
        }
      });
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
        message: '나눠서 하고 싶은 거 있어? 예를 들어 "화장실, 방, 거실" 이렇게 알려줘!',
        needs_user_input: true,
        suggestions: ['세부 항목 입력 대기중']
      };
    }

    // 이벤트와 관련 Todo 생성
    const eventsToCreate: Partial<Event>[] = parsed.events.map(e => ({
      user_id: this.context.user_id,
      title: e.title,
      datetime: e.datetime || new Date().toISOString(),
      duration: e.duration || 60,
      type: 'goal',
      description: e.description,
      is_completed: false
    }));

    const todosToCreate: Partial<Todo>[] = parsed.todos.map(t => ({
      user_id: this.context.user_id,
      title: t.title,
      deadline: t.deadline || eventsToCreate[0]?.datetime,
      duration: t.duration || 30,
      priority: t.priority || 'medium',
      timing: t.timing || 'before',
      is_completed: false
    }));

    // 시간 배치
    if (todosToCreate.length > 0) {
      const scheduleResult = await scheduleTodos(todosToCreate, this.context.events);
      scheduleResult.scheduled_items.forEach((item, index) => {
        if (todosToCreate[index]) {
          todosToCreate[index].scheduled_at = item.scheduled_at;
        }
      });
    }

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
      duration: t.duration || 30,
      priority: t.priority || 'medium',
      timing: 'during',
      is_completed: false
    }));

    // Scheduler Agent로 시간 배치
    const scheduleResult = await scheduleTodos(todosToCreate, this.context.events);

    scheduleResult.scheduled_items.forEach((item, index) => {
      if (todosToCreate[index]) {
        todosToCreate[index].scheduled_at = item.scheduled_at;
      }
    });

    const message = await this.generateResponse({
      type: 'todo_created',
      todos: todosToCreate,
      scheduled_items: scheduleResult.scheduled_items,
      suggestions: scheduleResult.suggestions
    });

    return {
      message,
      todos_to_create: todosToCreate,
      todos_to_schedule: scheduleResult.scheduled_items,
      suggestions: scheduleResult.suggestions
    };
  }

  /**
   * 일반 대화 처리
   */
  private async handleGeneralConversation(userMessage: string): Promise<AgentResponse> {
    const systemPrompt = `당신은 PALM(Personal AI Life Manager)의 AI 비서입니다.

사용자의 일정과 목표를 관리하고 최적화하는 것이 당신의 역할입니다.

현재 사용자 정보:
- 오늘 일정: ${this.context.events.filter(e => e.datetime.startsWith(new Date().toISOString().split('T')[0])).length}개
- 진행 중인 목표: ${this.context.goals.filter(g => g.is_active).length}개
- 미완료 Todo: ${this.context.todos.filter(t => !t.is_completed).length}개

다음 빈 시간:
${JSON.stringify(calculateAvailableSlots(this.context.events, 9, 18, 3).slice(0, 3), null, 2)}

친근하고 도움이 되는 어조로 대화하세요.
일정 등록, 목표 설정, Todo 관리에 대한 도움을 제공하세요.
응답은 간결하게 2-3문장으로 하세요.`;

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
        message: response.choices[0]?.message?.content || '죄송합니다, 다시 말씀해주세요.'
      };
    } catch (error) {
      console.error('General conversation error:', error);
      return {
        message: '일정이나 할 일을 추가하고 싶으시면 말씀해주세요!'
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
   * 응답 메시지 생성
   */
  private async generateResponse(context: {
    type: string;
    events?: Partial<Event>[];
    todos?: Partial<Todo>[];
    scheduled_items?: any[];
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
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        return `${dayName}요일 ${timeStr} - ${e.title}`;
      }).join('\n');

      return `일정을 ${events.length}개 등록했어! 📅\n\n${scheduleList}\n\n캘린더에서 확인해봐!`;
    }

    // 간단한 템플릿 기반 응답
    switch (type) {
      case 'event_created':
        let msg = '';
        if (events.length > 0) {
          const event = events[0];
          const dateStr = event.datetime ? new Date(event.datetime).toLocaleDateString('ko-KR') : '오늘';
          const timeStr = event.datetime ? new Date(event.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
          msg = `${dateStr} ${timeStr} "${event.title}" 등록했어!`;
        }
        if (todos.length > 0 && scheduled_items.length > 0) {
          const todoItem = scheduled_items[0];
          const scheduledTime = todoItem.scheduled_at
            ? new Date(todoItem.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
            : '';
          msg += ` "${todos[0].title}"는 ${scheduledTime}에 잡아뒀어.`;
        }
        return msg || '일정을 등록했어!';

      case 'todo_created':
        if (todos.length === 0) return '할 일을 추가했어!';
        const todoMsg = todos.map(t => `"${t.title}"`).join(', ');
        return `${todoMsg} 추가했어! 시간은 내가 최적으로 배치해뒀어.`;

      case 'goal_planned':
        if (events.length === 0 && todos.length === 0) return '목표 계획을 세웠어!';
        let planMsg = '';
        if (events.length > 0) {
          planMsg = `"${events[0].title}" 일정 등록!`;
        }
        if (todos.length > 0) {
          planMsg += ` 관련 할 일 ${todos.length}개도 추가했어.`;
        }
        return planMsg;

      default:
        return '처리했어!';
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
      event_id: lastEvent?.id,
      deadline: lastEvent?.datetime || new Date().toISOString(),
      duration: 30,
      priority: 'medium' as const,
      timing: 'during' as const,
      is_completed: false
    }));

    // 시간 배치
    const scheduleResult = await scheduleTodos(todosToCreate, this.context.events);

    scheduleResult.scheduled_items.forEach((item, index) => {
      if (todosToCreate[index]) {
        todosToCreate[index].scheduled_at = item.scheduled_at;
      }
    });

    const totalDuration = todosToCreate.reduce((sum, t) => sum + (t.duration || 30), 0);
    const message = `각각 30분씩 잡아뒀어! 총 ${totalDuration}분 예상되는데, 몰아서 할까 아니면 나눠서 할까?`;

    return {
      message,
      todos_to_create: todosToCreate,
      todos_to_schedule: scheduleResult.scheduled_items,
      needs_user_input: true,
      suggestions: ['몰아서', '나눠서', '시간 직접 지정']
    };
  }
}

/**
 * Orchestrator 인스턴스 생성 헬퍼
 */
export function createOrchestrator(context: OrchestratorContext): MainOrchestrator {
  return new MainOrchestrator(context);
}
