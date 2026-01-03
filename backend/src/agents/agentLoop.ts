import OpenAI from 'openai';
import { calendarToolDefinitions, executeCalendarTool } from './tools/calendarTools.js';
import { palmToolDefinitions, executePalmTool, Chronotype } from './tools/palmTools.js';
import { routeIntent, RouterResult } from './routerAgent.js';
import {
  processEvent,
  processGoal,
  processTodo,
  processBriefing,
  processGeneral
} from './specializedAgents.js';
import {
  OrchestratorContext,
  AgentResponse,
  ChatMessage,
  ParsedEvent
} from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 모든 도구 정의 통합
const allToolDefinitions = [
  ...calendarToolDefinitions,
  ...palmToolDefinitions
];

// Calendar 도구 목록
const calendarToolNames = calendarToolDefinitions.map(t => t.function.name);

/**
 * Agent Loop - Router → Specialized Agent 패턴
 *
 * 1단계: Router Agent가 의도 파악 + 정보 추출
 * 2단계: Specialized Agent가 해당 의도에 맞게 처리
 *
 * 이 구조의 장점:
 * - 의도 파악과 실행이 분리되어 각각 최적화 가능
 * - Router는 분류에 집중, Specialized Agent는 실행에 집중
 * - 더 정확한 정보 추출과 응답
 */
export class AgentLoop {
  private context: OrchestratorContext;
  private maxIterations: number = 5; // 무한 루프 방지
  private chronotype: Chronotype = 'neutral'; // 기본 chronotype

  constructor(context: OrchestratorContext, chronotype?: Chronotype) {
    this.context = context;
    if (chronotype) {
      this.chronotype = chronotype;
    }
  }

  /**
   * 메인 대화 처리 - Router → Specialized Agent 패턴
   */
  async processMessage(userMessage: string, mode: string = 'auto'): Promise<AgentResponse> {
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];

    // 날짜 컨텍스트 계산
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(currentDate.getDate() + (7 - currentDate.getDay()));

    try {
      // 1단계: Router Agent - 의도 파악 + 정보 추출
      console.log('[AgentLoop] Step 1: Router Agent');
      const routerResult = await routeIntent(userMessage, {
        today,
        endOfMonth: endOfMonth.toISOString().split('T')[0],
        endOfWeek: endOfWeek.toISOString().split('T')[0],
        categories: this.context.categories.map(c => c.name)
      });

      console.log('[AgentLoop] Router result:', routerResult);

      // 2단계: Specialized Agent - 의도에 맞는 처리
      console.log(`[AgentLoop] Step 2: ${routerResult.intent} Agent`);
      const agentContext = {
        userId: this.context.user_id,
        today,
        endOfMonth: endOfMonth.toISOString().split('T')[0],
        categories: this.context.categories.map(c => c.name)
      };

      let result: AgentResponse;

      switch (routerResult.intent) {
        case 'event':
          result = await processEvent(routerResult, agentContext);
          break;

        case 'goal':
          result = await processGoal(routerResult, agentContext);
          break;

        case 'todo':
          result = await processTodo(routerResult, agentContext);
          break;

        case 'briefing':
          // 브리핑은 추가 데이터 필요
          const todayEvents = this.context.events.filter(e =>
            e.datetime.startsWith(today)
          );
          const incompleteTodos = this.context.todos.filter(t => !t.is_completed);
          const activeGoals = this.context.goals.filter(g =>
            !['completed', 'failed'].includes(g.status)
          );

          result = await processBriefing({
            ...agentContext,
            todayEvents,
            incompleteTodos,
            activeGoals
          });
          break;

        case 'clarification':
          // Router가 명확화 필요하다고 판단
          result = {
            message: routerResult.clarificationQuestion || '좀 더 자세히 말씀해 주시겠어요?',
            needs_user_input: true
          };
          break;

        case 'general':
        default:
          // 일반 대화 또는 Tool 필요한 경우
          result = await this.handleGeneralOrToolRequired(userMessage, routerResult);
          break;
      }

      // 대화 기록 업데이트
      this.context.conversation_history.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.message }
      );

      return result;
    } catch (error) {
      console.error('Agent Loop error:', error);
      return {
        message: '죄송합니다. 다시 한번 말씀해주세요.',
        needs_user_input: true
      };
    }
  }

  /**
   * 일반 대화 또는 Tool이 필요한 경우 처리
   */
  private async handleGeneralOrToolRequired(
    userMessage: string,
    routerResult: RouterResult
  ): Promise<AgentResponse> {
    const today = new Date().toISOString().split('T')[0];

    // 이번 주 날짜 계산
    const currentDate = new Date();
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }

    // Tool이 필요할 수 있는 복잡한 요청인지 확인
    const needsTools = this.checkIfNeedsTools(userMessage);

    if (needsTools) {
      // 기존 Tool 기반 처리 사용
      return await this.runAgentLoopWithTools(userMessage, today, weekDates);
    } else {
      // 단순 대화는 processGeneral로 처리
      return await processGeneral(userMessage, {
        userId: this.context.user_id,
        today,
        endOfMonth: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0],
        categories: this.context.categories.map(c => c.name)
      });
    }
  }

  /**
   * Tool이 필요한지 확인
   */
  private checkIfNeedsTools(message: string): boolean {
    const toolKeywords = [
      '일정 조회', '일정 확인', '일정 보여',
      '충돌', '겹치', '빈 시간', '여유',
      '분해', '세분화', '나눠',
      '추천', '최적', '언제가 좋',
      '리뷰', '정리', '요약'
    ];

    return toolKeywords.some(keyword => message.includes(keyword));
  }

  /**
   * Tool 기반 Agent Loop 실행
   */
  private async runAgentLoopWithTools(
    userMessage: string,
    today: string,
    weekDates: string[]
  ): Promise<AgentResponse> {
    const systemPrompt = this.buildSystemPrompt(today, weekDates, 'auto');

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...this.context.conversation_history.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    let iteration = 0;
    let currentMessages = [...messages];

    while (iteration < this.maxIterations) {
      iteration++;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: currentMessages,
        tools: allToolDefinitions,
        tool_choice: 'auto',
        temperature: 0.3
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      // Tool 호출이 있는 경우
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        currentMessages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[Agent] Calling tool: ${toolName}`, toolArgs);

          let toolResult;
          if (calendarToolNames.includes(toolName)) {
            toolResult = await executeCalendarTool(
              toolName,
              toolArgs,
              this.context.user_id
            );
          } else {
            toolResult = await executePalmTool(
              toolName,
              toolArgs,
              this.context.user_id,
              this.chronotype
            );
          }

          console.log(`[Agent] Tool result:`, toolResult);

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        continue;
      }

      // Tool 호출이 없으면 최종 응답
      const content = assistantMessage.content || '{}';
      return this.parseAgentResponse(content);
    }

    return {
      message: '처리 중 문제가 발생했습니다. 다시 시도해주세요.',
      needs_user_input: true
    };
  }

  /**
   * Agent 응답 파싱
   */
  private parseAgentResponse(content: string): AgentResponse {
    try {
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      const parsed = JSON.parse(jsonContent);

      if (parsed.needs_clarification && parsed.clarification_question) {
        return {
          message: parsed.clarification_question,
          needs_user_input: true
        };
      }

      if (parsed.briefing) {
        return {
          message: parsed.briefing.message || parsed.message,
          suggestions: parsed.briefing.suggestions || parsed.suggestions
        };
      }

      if (parsed.goal || (parsed.goals && parsed.goals.length > 0)) {
        const goals = parsed.goals || [parsed.goal];
        const goalsToCreate = goals.map((g: any) => ({
          title: g.title,
          description: g.description || null,
          target_date: g.target_date || null,
          priority: g.priority || 'medium',
          category: g.category || null,
          decomposed_todos: g.decomposed_todos || parsed.decomposed_todos || []
        }));

        return {
          message: parsed.message || `${goalsToCreate.length}개의 목표를 생성합니다.`,
          goals_to_create: goalsToCreate,
          suggestions: parsed.suggestions
        };
      }

      if ((parsed.decomposed_todos && parsed.decomposed_todos.length > 0) ||
          (parsed.todos && parsed.todos.length > 0)) {
        const todos = parsed.todos || parsed.decomposed_todos;
        const todosToCreate = todos.map((t: any, idx: number) => ({
          title: t.title,
          duration: t.duration || 60,
          order: t.order || idx + 1,
          priority: t.priority || 'medium',
          deadline: t.deadline || null,
          description: t.description || null
        }));

        return {
          message: parsed.message || `${todosToCreate.length}개의 할 일을 생성합니다.`,
          todos_to_create: todosToCreate,
          suggestions: parsed.suggestions
        };
      }

      if (parsed.events && parsed.events.length > 0) {
        const eventsToCreate = parsed.events.map((e: ParsedEvent) => ({
          user_id: this.context.user_id,
          title: e.title,
          datetime: e.datetime || new Date().toISOString(),
          duration: e.duration || 60,
          type: e.type || 'fixed',
          location: e.location || null,
          description: e.description,
          category: e.category,
          is_completed: false
        }));

        const message = this.generateEventMessage(eventsToCreate, parsed.intent);

        return {
          message,
          events_to_create: eventsToCreate,
          suggestions: parsed.suggestions
        };
      }

      return {
        message: parsed.message || parsed.clarification_question || '무엇을 도와드릴까요?',
        suggestions: parsed.suggestions
      };

    } catch (error) {
      console.error('Failed to parse agent response:', content, error);
      const cleanContent = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
      return {
        message: cleanContent || '무엇을 도와드릴까요?'
      };
    }
  }

  /**
   * 일정 생성 메시지 생성
   */
  private generateEventMessage(events: any[], intent: string): string {
    if (events.length === 0) {
      return '무엇을 도와드릴까요?';
    }

    if (events.length > 1) {
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const scheduleList = events.map(e => {
        if (!e.datetime) return e.title;
        const date = new Date(e.datetime);
        const dayName = weekdays[date.getDay()];
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        return `${dayName}요일 ${timeStr} - ${e.title}`;
      }).join('\n');

      return `아래와 같은 일정은 어떠세요?\n\n${scheduleList}\n\n추가하고 싶은 일정을 선택해주세요!`;
    }

    const event = events[0];
    const dateStr = event.datetime
      ? new Date(event.datetime).toLocaleDateString('ko-KR')
      : '오늘';
    const timeStr = event.datetime
      ? new Date(event.datetime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
      : '';

    return `${dateStr} ${timeStr}에 "${event.title}" 일정은 어떠세요?`;
  }

  /**
   * 시스템 프롬프트 생성 (Tool 사용 시)
   */
  private buildSystemPrompt(today: string, weekDates: string[], mode: string = 'auto'): string {
    const todayEvents = this.context.events.filter(e =>
      e.datetime.startsWith(today)
    );
    const activeGoals = this.context.goals.filter(g => !['completed', 'failed'].includes(g.status));
    const incompleteTodos = this.context.todos.filter(t => !t.is_completed);

    return `당신은 PALM(Personal AI Life Manager) - 사용자의 일정과 목표를 관리하는 AI 비서입니다.

## 현재 정보
현재 시간: ${new Date().toISOString()}
오늘 날짜: ${today}
이번 달 마지막 날: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]}
이번 주 날짜들: ${weekDates.join(', ')}
사용자 Chronotype: ${this.chronotype}
오늘 일정 수: ${todayEvents.length}개
활성 목표: ${activeGoals.map(g => g.title).join(', ') || '없음'}
미완료 할 일: ${incompleteTodos.length}개
사용 가능한 카테고리: ${this.context.categories.map(c => c.name).join(', ')}

## 도구 사용
사용자 요청에 따라 적절한 도구를 사용하세요:
- get_events: 일정 조회
- check_conflicts: 충돌 확인
- find_free_slots: 빈 시간 찾기
- get_goals: 목표 조회
- decompose_goal: 목표 분해
- smart_schedule: 최적 시간 추천
- get_briefing: 브리핑 생성
- get_weekly_review: 주간 리뷰

## 응답 형식
JSON 형식으로 응답하세요. 도구 결과를 바탕으로 사용자에게 친근하게 설명하세요.`;
  }
}

/**
 * AgentLoop 인스턴스 생성 헬퍼
 */
export function createAgentLoop(context: OrchestratorContext, chronotype?: Chronotype): AgentLoop {
  return new AgentLoop(context, chronotype);
}
