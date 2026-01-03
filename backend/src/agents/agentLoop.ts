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
      // JSON 블록 추출 시도 (```json ... ``` 형태)
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        // { 로 시작하는 JSON 찾기
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          jsonContent = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      const parsed = JSON.parse(jsonContent);

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

      // Goal 생성 요청인 경우 (goal 객체 또는 goals 배열이 있는 경우)
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

      // TODO 생성 요청인 경우 (decomposed_todos 또는 todos 배열)
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
      // JSON 파싱 실패 시 텍스트 그대로 반환 (마크다운 등 제거)
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
    const activeGoals = this.context.goals.filter(g => !['completed', 'failed'].includes(g.status));
    const incompleteTodos = this.context.todos.filter(t => !t.is_completed);

    // 모드별 지시사항
    const modeInstructions = this.getModeInstructions(mode);

    return `당신은 PALM(Personal AI Life Manager) - 사용자의 일정과 목표를 관리하는 AI 비서입니다.

## 핵심 원칙 (매우 중요!)
1. **사용자 발화에서 모든 정보를 최대한 추출하세요** - 명시적/암시적 정보 모두 파악
2. **정말로 없는 정보만 질문하세요** - 추론 가능한 정보는 질문하지 마세요
3. **한국어 표현을 정확히 해석하세요** - 아래 날짜/기간 해석 규칙 참고

## 현재 모드: ${this.getModeLabel(mode)}
${modeInstructions}

## 현재 정보
현재 시간: ${new Date().toISOString()}
오늘 날짜: ${today}
이번 달 마지막 날: ${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]}
이번 주 날짜들: ${weekDates.join(', ')}
사용자 Chronotype: ${this.chronotype} (${this.chronotype === 'morning' ? '아침형' : this.chronotype === 'evening' ? '저녁형' : '중립형'})
오늘 일정 수: ${todayEvents.length}개
활성 목표: ${activeGoals.map(g => g.title).join(', ') || '없음'}
미완료 할 일: ${incompleteTodos.length}개
사용 가능한 카테고리: ${this.context.categories.map(c => c.name).join(', ')}

## 날짜/기간 해석 규칙 (매우 중요!)
사용자가 아래와 같이 말하면 정확한 날짜로 변환하세요:
- "이번달 안에", "이번 달까지" → 이번 달 마지막 날 (${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]})
- "다음달까지" → 다음 달 마지막 날
- "이번주 안에", "이번 주까지" → 이번 주 일요일
- "다음주까지" → 다음 주 일요일
- "3개월 안에" → 오늘로부터 3개월 후
- "6개월 후" → 오늘로부터 6개월 후
- "올해 안에" → 12월 31일
- "내일", "모레" → 정확한 날짜로 변환
- "다음 주 월요일" → 정확한 날짜로 변환

## 정보 추출 우선순위
1. 사용자가 명시한 정보 → 그대로 사용
2. 문맥에서 추론 가능한 정보 → 추론해서 사용
3. 정말 없는 정보 → 질문

예시:
- "이번달 안에 5키로 감량하고 싶어"
  → 목표: "5kg 감량", 기한: 이번 달 마지막 날, 카테고리: "운동"
  → 모든 정보가 있으므로 바로 목표 생성!

- "운동하고 싶어"
  → 무엇을? 언제? 정보 부족 → 질문 필요

## 카테고리 자동 분류
- "운동", "다이어트", "감량", "헬스", "조깅", "요가" → 운동
- "공부", "시험", "자격증", "토익", "학습" → 공부
- "업무", "회의", "미팅", "프로젝트" → 업무
- "약속", "만남", "데이트", "모임" → 약속
- 그 외 → 개인

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
  "todos": [
    {
      "title": "할 일 제목",
      "duration": 60,
      "order": 1,
      "priority": "high" | "medium" | "low",
      "deadline": "YYYY-MM-DD (선택)",
      "description": "설명 (선택)"
    }
  ],
  "goals": [
    {
      "title": "목표 제목",
      "description": "목표 설명 (선택)",
      "target_date": "YYYY-MM-DD (선택)",
      "priority": "high" | "medium" | "low",
      "category": "카테고리 이름 (선택)",
      "decomposed_todos": [
        {
          "title": "세부 작업 제목",
          "duration": 60,
          "order": 1,
          "priority": "medium"
        }
      ]
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

### 필수 정보 (반드시 확인!)
1. **날짜** (언제?) - 필수
2. **시간** (몇 시?) - 필수. "저녁", "아침" 같은 모호한 표현은 정확히 물어보세요
3. 소요 시간 - 기본 60분, 필요시 질문
4. 장소 - 선택사항

### 처리 흐름
1. 날짜와 시간이 명확하면 → 일정 생성
2. 날짜 또는 시간이 없거나 모호하면 → 반드시 질문
3. "추천해줘", "알아서 해줘" 라고 하면 → 기본값으로 생성

### 질문이 필요한 경우 (needs_clarification: true)
- "내일 미팅" → 시간을 물어보세요: "몇 시에 하실 건가요?"
- "저녁에 약속" → 정확한 시간 질문: "저녁 몇 시쯤 생각하고 계신가요? (예: 6시, 7시)"
- "회의" → 날짜와 시간 둘 다 질문

### 응답 형식
- 정보가 충분하면: events 배열에 일정 반환
- 정보가 부족하면: needs_clarification: true, clarification_question에 질문`;

      case 'todo':
        return `## TODO 모드 지시사항
사용자가 할 일(Todo)을 추가하려고 합니다.

### 필수 정보 (반드시 확인!)
1. **할 일 제목** (무엇을?) - 필수
2. 우선순위 - 기본 medium
3. 마감일 - 선택사항
4. 예상 소요 시간 - 기본 60분

### 처리 흐름
TODO는 제목만 있으면 생성 가능합니다.
- 제목이 명확하면 → 바로 todo 생성
- 복잡한 작업이면 → 세부 단계로 분해할지 물어보기

### 응답 형식
- 정보가 충분하면: todos 배열에 할 일 반환
예시:
{
  "message": "할 일을 추가합니다.",
  "todos": [
    {"title": "보고서 작성", "duration": 60, "order": 1, "priority": "medium"}
  ]
}`;

      case 'goal':
        return `## Goal 모드 지시사항
사용자가 목표(Goal)를 설정하고 계획을 세우려고 합니다.

### 핵심: 사용자 발화에서 최대한 정보 추출!
"이번달 안에 5키로 감량하고 싶어" →
- 목표: "5kg 감량" ✓
- 기한: 이번 달 마지막 날 ✓ ("이번달 안에"에서 추출!)
- 카테고리: "운동" ✓ ("감량"에서 추론!)
→ 모든 정보 있음! 바로 목표 생성!

### 기한 표현 해석 (중요!)
- "이번달 안에", "이번 달까지" → 이번 달 마지막 날
- "다음달까지" → 다음 달 마지막 날
- "3개월 안에" → 3개월 후 날짜
- "올해 안에" → 12월 31일
- 숫자+기간 형태는 모두 기한이 있는 것!

### 질문이 필요한 경우 (정말 정보가 없을 때만!)
- "목표 세워줘" → 무슨 목표인지 불명확 → 질문
- "운동하고 싶어" → 구체적 목표 불명확 → 질문
- "토익 공부할래" → 목표 점수? 기한? 불명확 → 질문

### 응답 형식
정보가 충분하면 바로 goals 배열 반환:
{
  "message": "이번 달까지 5kg 감량 목표를 설정합니다!",
  "goals": [
    {
      "title": "5kg 감량",
      "description": "이번 달 안에 5kg 체중 감량하기",
      "target_date": "2026-01-31",
      "priority": "high",
      "category": "운동",
      "decomposed_todos": []
    }
  ]
}`;

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

### 핵심 원칙: 사용자 발화에서 최대한 정보 추출!
1. 먼저 사용자가 말한 내용에서 모든 정보를 추출하세요
2. 날짜/기간 표현을 정확히 해석하세요 (위 규칙 참고)
3. 카테고리는 키워드로 자동 분류하세요
4. 정말 없는 정보만 질문하세요

### 의도 판단 + 바로 처리 예시
- "이번달 안에 5키로 감량하고 싶어"
  → 목표! 정보 충분! → 바로 goal 생성

- "내일 3시에 팀 미팅"
  → 일정! 정보 충분! → 바로 event 생성

- "보고서 작성해야 해"
  → TODO! 정보 충분! → 바로 todo 생성

- "오늘 일정 알려줘"
  → 브리핑! → 브리핑 생성

### 질문이 필요한 경우 (정보가 정말 없을 때만)
- "일정 잡아줘" → 무슨 일정? 언제? → 질문
- "목표 세워줘" → 무슨 목표? → 질문
- "미팅" → 언제? 누구와? → 질문

### 사용 가능한 도구
- get_events: 일정 조회
- check_conflicts: 충돌 확인
- find_free_slots: 빈 시간 찾기
- get_goals: 목표 조회
- decompose_goal: 목표 분해
- smart_schedule: 최적 시간 추천
- get_briefing: 브리핑 생성
- get_weekly_review: 주간 리뷰

### 핵심: 먼저 추출, 정말 없으면 질문!
- 사용자 발화에서 최대한 정보 추출 (날짜, 시간, 기간, 카테고리 등)
- 추론 가능하면 추론해서 사용
- 정말 없는 정보만 질문
- "추천해줘", "알아서" 라고 하면 AI가 적절히 설정`;
    }
  }
}

/**
 * AgentLoop 인스턴스 생성 헬퍼
 */
export function createAgentLoop(context: OrchestratorContext, chronotype?: Chronotype): AgentLoop {
  return new AgentLoop(context, chronotype);
}
