import OpenAI from 'openai';
import { calendarToolDefinitions, executeCalendarTool } from './tools/calendarTools.js';
import { palmToolDefinitions, executePalmTool, Chronotype } from './tools/palmTools.js';
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
 * Agent Loop - OpenAI Function Calling을 사용한 자율적 Agent
 *
 * PALM 스펙에 맞게 확장:
 * - Goal → Todo → Event 분해
 * - Chronotype 기반 스케줄링
 * - 아침/저녁 브리핑
 * - 주간 리뷰
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
   * 메인 대화 처리 - 기존 orchestrator와 동일한 인터페이스
   */
  async processMessage(userMessage: string, mode: string = 'auto'): Promise<AgentResponse> {
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];

    // 이번 주 날짜 계산
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      date.setDate(currentDate.getDate() + i);
      weekDates.push(date.toISOString().split('T')[0]);
    }

    const systemPrompt = this.buildSystemPrompt(today, weekDates, mode);

    // 대화 기록 구성
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...this.context.conversation_history.slice(-10).map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })),
      { role: 'user', content: userMessage }
    ];

    try {
      // Agent Loop 실행
      const result = await this.runAgentLoop(messages);

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
   * Agent Loop 실행 - Tool 호출이 필요 없을 때까지 반복
   */
  private async runAgentLoop(
    messages: OpenAI.Chat.ChatCompletionMessageParam[]
  ): Promise<AgentResponse> {
    let iteration = 0;
    let currentMessages = [...messages];

    while (iteration < this.maxIterations) {
      iteration++;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: currentMessages,
        tools: allToolDefinitions,
        tool_choice: 'auto',
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const assistantMessage = response.choices[0]?.message;
      if (!assistantMessage) {
        throw new Error('No response from OpenAI');
      }

      // Tool 호출이 있는 경우
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        // Assistant 메시지 추가
        currentMessages.push(assistantMessage);

        // 각 Tool 호출 실행
        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`[Agent] Calling tool: ${toolName}`, toolArgs);

          // Tool 종류에 따라 다른 executor 사용
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

          // Tool 결과 메시지 추가
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }

        // 다음 반복에서 Tool 결과를 바탕으로 응답 생성
        continue;
      }

      // Tool 호출이 없으면 최종 응답
      const content = assistantMessage.content || '{}';
      return this.parseAgentResponse(content);
    }

    // 최대 반복 횟수 초과
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
      const parsed = JSON.parse(content);

      // 명확화가 필요한 경우
      if (parsed.needs_clarification && parsed.clarification_question) {
        return {
          message: parsed.clarification_question,
          needs_user_input: true
        };
      }

      // 브리핑 응답인 경우
      if (parsed.briefing) {
        return {
          message: parsed.briefing.message || parsed.message,
          suggestions: parsed.briefing.suggestions || parsed.suggestions
        };
      }

      // 목표 분해 응답인 경우
      if (parsed.decomposed_todos && parsed.decomposed_todos.length > 0) {
        return {
          message: parsed.message || '목표를 세부 작업으로 분해했습니다.',
          todos_to_create: parsed.decomposed_todos,
          suggestions: parsed.suggestions
        };
      }

      // 일정이 있는 경우
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

        // 응답 메시지 생성
        const message = this.generateEventMessage(eventsToCreate, parsed.intent);

        return {
          message,
          events_to_create: eventsToCreate,
          suggestions: parsed.suggestions
        };
      }

      // 일반 대화 응답
      return {
        message: parsed.message || parsed.clarification_question || '무엇을 도와드릴까요?',
        suggestions: parsed.suggestions
      };

    } catch (error) {
      console.error('Failed to parse agent response:', content, error);
      // JSON 파싱 실패 시 텍스트 그대로 반환
      return {
        message: content || '무엇을 도와드릴까요?'
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

    // 여러 일정인 경우 (계획/추천)
    if (events.length > 1) {
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const scheduleList = events.map(e => {
        if (!e.datetime) return e.title;
        const date = new Date(e.datetime);
        const dayName = weekdays[date.getDay()];
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        return `${dayName}요일 ${timeStr} - ${e.title}`;
      }).join('\n');

      return `아래와 같은 일정은 어떠세요? 📅\n\n${scheduleList}\n\n추가하고 싶은 일정을 선택해주세요!`;
    }

    // 단일 일정
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
   * 시스템 프롬프트 생성 - PALM 스펙 반영
   */
  private buildSystemPrompt(today: string, weekDates: string[], mode: string = 'auto'): string {
    // 현재 일정 요약
    const todayEvents = this.context.events.filter(e =>
      e.datetime.startsWith(today)
    );
    const activeGoals = this.context.goals.filter(g => g.is_active);
    const incompleteTodos = this.context.todos.filter(t => !t.is_completed);

    // 모드별 지시사항
    const modeInstructions = this.getModeInstructions(mode);

    return `당신은 PALM(Personal AI Life Manager) - 사용자의 일정과 목표를 관리하는 AI 비서입니다.

## 현재 모드: ${this.getModeLabel(mode)}
${modeInstructions}

## 현재 정보
현재 시간: ${new Date().toISOString()}
오늘 날짜: ${today}
이번 주 날짜들: ${weekDates.join(', ')}
사용자 Chronotype: ${this.chronotype} (${this.chronotype === 'morning' ? '아침형' : this.chronotype === 'evening' ? '저녁형' : '중립형'})
오늘 일정 수: ${todayEvents.length}개
활성 목표: ${activeGoals.map(g => g.title).join(', ') || '없음'}
미완료 할 일: ${incompleteTodos.length}개
사용 가능한 카테고리: ${this.context.categories.map(c => c.name).join(', ')}

## 기본값
- 시간: Chronotype에 따라 다름 (아침형: 오전 9시, 저녁형: 오후 4시, 중립: 오후 3시)
- 소요 시간: 1시간 (60분)
- 장소: null

## 카테고리 분류
- "운동": 운동, 헬스, 조깅, 요가, 수영, 등산
- "업무": 회의, 미팅, 출근, 업무, 프로젝트, 발표
- "공부": 공부, 학습, 수업, 강의, 시험, 자격증
- "약속": 친구 만남, 데이트, 모임, 파티, 식사 약속
- "개인": 취미, 휴식, 독서, 영화, 쇼핑, 병원
- "기본": 분류가 어려운 경우

## 응답 JSON 형식
{
  "type": "fixed" | "personal" | "goal" | "todo" | "briefing" | "unknown",
  "events": [
    {
      "title": "일정 제목",
      "datetime": "YYYY-MM-DDTHH:mm:ss",
      "duration": 60,
      "location": "장소 (선택)",
      "type": "fixed" | "personal" | "goal",
      "description": "설명 (선택)",
      "category": "카테고리 이름"
    }
  ],
  "decomposed_todos": [
    {
      "title": "세부 작업 제목",
      "duration": 60,
      "order": 1
    }
  ],
  "briefing": {
    "greeting": "인사말",
    "schedule_summary": "일정 요약",
    "todo_summary": "할 일 요약",
    "suggestions": ["제안1", "제안2"],
    "message": "전체 브리핑 메시지"
  },
  "intent": "사용자 의도 요약",
  "needs_clarification": false,
  "clarification_question": null,
  "message": "사용자에게 보여줄 메시지",
  "suggestions": ["추천 액션1", "추천 액션2"]
}

반드시 유효한 JSON만 출력하세요.`;
  }

  /**
   * 모드별 라벨 반환
   */
  private getModeLabel(mode: string): string {
    const labels: Record<string, string> = {
      'auto': '🤖 자동 (AI가 판단)',
      'event': '📅 일정 추가',
      'todo': '✅ TODO 추가',
      'goal': '🎯 Goal 설정',
      'briefing': '📋 브리핑'
    };
    return labels[mode] || labels['auto'];
  }

  /**
   * 모드별 상세 지시사항 반환
   */
  private getModeInstructions(mode: string): string {
    switch (mode) {
      case 'event':
        return `## 일정 모드 지시사항
사용자가 일정(Event)을 추가하려고 합니다.

### 필수 확인 사항
1. 날짜 (언제?)
2. 시간 (몇 시?) - "저녁", "아침" 같은 모호한 표현은 정확히 물어보세요
3. 소요 시간 (얼마나?)
4. 장소 (어디서?) - 선택사항

### 처리 방식
- 정확한 시간이 있으면 → check_conflicts로 충돌 확인 후 일정 생성
- 시간이 모호하면 → 질문하여 명확화
- "아무거나", "적당히" 등의 답변 → 기본값(오후 3시, 1시간)으로 생성

### 응답 형식
events 배열에 일정을 담아 반환하세요.`;

      case 'todo':
        return `## TODO 모드 지시사항
사용자가 할 일(Todo)을 추가하려고 합니다.

### 필수 확인 사항
1. 할 일 제목 (무엇을?)
2. 우선순위 (high/medium/low) - 기본값: medium
3. 마감일 (언제까지?) - 선택사항

### 처리 방식
- 간단한 할 일 → 바로 todo 생성
- 복잡한 작업 → 세부 단계로 분해 가능

### 응답 형식
decomposed_todos 배열에 할 일을 담아 반환하세요.
각 todo에는 title, duration, order, priority를 포함하세요.`;

      case 'goal':
        return `## Goal 모드 지시사항
사용자가 목표(Goal)를 설정하고 계획을 세우려고 합니다.

### 필수 확인 사항
1. 목표 제목 (무엇을 달성?)
2. 목표 기한 (언제까지?)
3. 활동 유형 (공부, 운동, 프로젝트 등)

### 처리 방식
1. decompose_goal 도구로 목표를 세부 작업으로 분해
2. smart_schedule로 최적 시간대 추천
3. 단계별 계획을 상세히 설명

### 응답 형식
decomposed_todos 배열에 세부 작업을 담고,
message에 전체 계획과 추천 일정을 상세히 설명하세요.

예시:
"토익 900점" 목표를 다음과 같이 분해합니다:
1. 개념 학습 (90분) - 문법, 어휘 기초
2. 연습 문제 풀이 (60분) - 파트별 연습
3. 복습 (45분) - 오답 노트 정리
4. 모의 테스트 (60분) - 실전 연습

D-XXX일 남았으므로 주 X회 수행을 권장합니다.`;

      case 'briefing':
        return `## 브리핑 모드 지시사항
사용자에게 오늘의 일정과 할 일을 브리핑합니다.

### 처리 방식
1. get_briefing 도구를 사용하여 브리핑 생성
2. 오늘 일정 요약
3. 미완료 할 일 알림
4. 내일 주요 일정 미리보기
5. 맞춤 제안사항

### 응답 형식
briefing 객체에 브리핑 내용을 담아 반환하세요.
친근하고 도움이 되는 톤으로 작성하세요.`;

      default: // auto
        return `## 자동 모드 지시사항
사용자의 의도를 파악하여 적절하게 처리합니다.

### 의도 판단 기준
- 일정 관련 키워드 (약속, 미팅, 회의, 수업 등) → 일정 모드처럼 처리
- 할 일 관련 키워드 (해야 해, 할 일, TODO 등) → TODO 모드처럼 처리
- 목표 관련 키워드 (목표, 계획, 달성 등) → Goal 모드처럼 처리
- 브리핑 요청 (오늘 일정, 뭐 있어 등) → 브리핑 모드처럼 처리

### 사용 가능한 도구
- get_events: 일정 조회
- check_conflicts: 충돌 확인
- find_free_slots: 빈 시간 찾기
- get_goals: 목표 조회
- decompose_goal: 목표 분해
- smart_schedule: 최적 시간 추천
- get_briefing: 브리핑 생성
- get_weekly_review: 주간 리뷰

### 핵심 원칙
- 시간이 모호하면 반드시 질문
- 한 번에 필요한 정보를 모두 물어보기
- "몰라", "아무거나" 답변 시 기본값 사용`;
    }
  }
}

/**
 * AgentLoop 인스턴스 생성 헬퍼
 */
export function createAgentLoop(context: OrchestratorContext, chronotype?: Chronotype): AgentLoop {
  return new AgentLoop(context, chronotype);
}
