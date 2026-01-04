/**
 * MCP-Enhanced Agent Loop
 *
 * 기존 AgentLoop를 확장하여 MCP 도구를 통합합니다.
 * "말하는 AI"에서 "행동하는 AI"로 전환하는 핵심 컴포넌트입니다.
 *
 * 특징:
 * - 기존 내부 도구(Calendar, PALM) 유지
 * - MCP 도구 추가 (Google Calendar, Maps, Shopping)
 * - 복합 시나리오 처리 (그룹 약속 + 장소 추천 등)
 * - 사용자 확인 기반 실행
 */

import OpenAI from 'openai';
import { calendarToolDefinitions, executeCalendarTool } from './tools/calendarTools.js';
import { palmToolDefinitions, executePalmTool, Chronotype } from './tools/palmTools.js';
import { routeIntent, RouterResult, IntentType } from './routerAgent.js';
import {
  processEvent,
  processGoal,
  processTodo,
  processBriefing,
  processGeneral
} from './specializedAgents.js';
import {
  OrchestratorContext,
  AgentResponse
} from '../types/index.js';

// MCP 모듈
import { MCPOrchestrator, getMCPOrchestrator, MCPToolCall, MCPToolResult } from '../mcp/index.js';
import { mcpToolDefinitions, toolCategories } from '../mcp/toolDefinitions.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 확장된 의도 타입
type ExtendedIntentType = IntentType |
  'place_recommendation' |
  'group_schedule' |
  'shopping' |
  'gift_recommendation' |
  'special_day' |
  'complex';

// ExtendedRouterResult: RouterResult를 확장하지만 intent를 오버라이드
interface ExtendedRouterResult {
  intent: ExtendedIntentType;
  // RouterResult 필드들 복사
  parsed_events?: any[];
  parsed_todos?: any[];
  parsed_goals?: any[];
  confidence?: number;
  needs_clarification?: boolean;
  clarification_question?: string;
  clarificationQuestion?: string;  // 대체 필드명
  extracted_info?: Record<string, any>;
  extractedInfo?: Record<string, any>;  // 대체 필드명
  // MCP 관련 확장 필드
  requiredMcpTools?: string[];
  isActionRequired?: boolean;
  missingInfo?: string[];
  originalMessage?: string;
}

/**
 * MCP 통합 Agent Loop
 */
export class MCPAgentLoop {
  private context: OrchestratorContext;
  private mcpOrchestrator: MCPOrchestrator;
  private maxIterations: number = 8;
  private chronotype: Chronotype = 'neutral';

  // 모든 도구 정의 통합
  private allToolDefinitions = [
    ...calendarToolDefinitions,
    ...palmToolDefinitions,
    ...mcpToolDefinitions
  ];

  constructor(
    context: OrchestratorContext,
    chronotype?: Chronotype,
    mcpConfig?: {
      googleCalendarTokens?: { access_token: string; refresh_token?: string };
    }
  ) {
    this.context = context;
    if (chronotype) {
      this.chronotype = chronotype;
    }

    // MCP Orchestrator 초기화
    this.mcpOrchestrator = getMCPOrchestrator(context.user_id, {
      googleCalendar: mcpConfig?.googleCalendarTokens ? {
        enabled: true,
        tokens: mcpConfig.googleCalendarTokens
      } : undefined
    });
  }

  /**
   * 메인 메시지 처리
   */
  async processMessage(userMessage: string, mode: string = 'auto'): Promise<AgentResponse> {
    const currentDate = new Date();
    const today = currentDate.toISOString().split('T')[0];

    // 날짜 컨텍스트
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    const endOfWeek = new Date(currentDate);
    endOfWeek.setDate(currentDate.getDate() + (7 - currentDate.getDay()));

    try {
      // 1단계: 확장된 Router - 의도 파악 + MCP 도구 필요 여부 결정
      console.log('[MCPAgentLoop] Step 1: Extended Router');
      const routerResult = await this.extendedRouteIntent(userMessage, {
        today,
        endOfMonth: endOfMonth.toISOString().split('T')[0],
        endOfWeek: endOfWeek.toISOString().split('T')[0],
        categories: this.context.categories.map(c => c.name)
      });

      console.log('[MCPAgentLoop] Router result:', JSON.stringify(routerResult, null, 2));

      // 2단계: 의도에 맞는 처리
      const agentContext = {
        userId: this.context.user_id,
        today,
        endOfMonth: endOfMonth.toISOString().split('T')[0],
        categories: this.context.categories.map(c => c.name)
      };

      let result: AgentResponse;

      // MCP 도구가 필요한 경우
      if (routerResult.requiredMcpTools && routerResult.requiredMcpTools.length > 0) {
        console.log('[MCPAgentLoop] MCP tools required:', routerResult.requiredMcpTools);
        result = await this.handleMCPIntent(userMessage, routerResult, agentContext);
      } else {
        // 기존 처리 로직
        result = await this.handleStandardIntent(routerResult, agentContext, today);
      }

      // 대화 기록 업데이트
      this.context.conversation_history.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: result.message }
      );

      return result;
    } catch (error) {
      console.error('[MCPAgentLoop] Error:', error);
      return {
        message: '죄송합니다. 다시 한번 말씀해주세요.',
        needs_user_input: true
      };
    }
  }

  /**
   * 확장된 Router - MCP 도구 필요 여부도 판단
   */
  private async extendedRouteIntent(
    userMessage: string,
    context: {
      today: string;
      endOfMonth: string;
      endOfWeek: string;
      categories: string[];
    }
  ): Promise<ExtendedRouterResult> {
    const systemPrompt = `당신은 사용자 의도를 파악하고 필요한 도구를 결정하는 전문 분석가입니다.

## 역할
1. 사용자 발화에서 의도(intent) 파악
2. 필요한 도구 결정 (내부 도구 vs MCP 도구)
3. 발화에서 정보 추출

## 의도 분류

### 기본 의도 (내부 처리)
- "event": 일정/약속 추가 (내부 캘린더)
- "todo": 할 일 추가
- "goal": 목표 설정
- "briefing": 오늘 일정 확인
- "general": 일반 대화

### MCP 필요 의도 (외부 서비스 연동)
- "place_recommendation": 장소 추천 필요 (맛집, 카페, 모임 장소)
- "group_schedule": 그룹 일정 조율 (여러 사람의 시간 맞추기)
- "shopping": 상품 검색/추천
- "gift_recommendation": 선물 추천
- "special_day": 특별한 날 준비 (생일, 기념일)
- "complex": 여러 기능 복합 (일정 + 장소 추천 등)

## MCP 도구 결정

### Calendar MCP (Google Calendar 연동)
필요한 경우:
- "캘린더에 추가", "구글 캘린더"
- 그룹 일정 조율, Free/Busy 확인
- 외부 캘린더와 동기화

### Maps MCP (장소 서비스)
필요한 경우:
- "맛집 추천", "카페 찾아줘"
- "어디서 만날까", "중간 지점"
- "거리 얼마나", "몇 분 걸려"

### Shopping MCP
필요한 경우:
- "상품 검색", "가격 비교"
- "선물 추천", "뭐 사야 해"
- 목표와 연계된 용품 추천

## 현재 정보
- 오늘: ${context.today}
- 이번 달 마지막 날: ${context.endOfMonth}
- 이번 주 일요일: ${context.endOfWeek}

## 응답 형식 (JSON)
{
  "intent": "의도",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "title": "제목",
    "datetime": "YYYY-MM-DDTHH:mm:ss",
    "targetDate": "YYYY-MM-DD",
    "location": "장소/지역",
    "area": "지역명 (장소추천용)",
    "cuisine": "음식종류",
    "groupName": "그룹명",
    "memberEmails": ["email1@..."],
    "searchQuery": "검색어",
    "budget": 숫자,
    "recipient": "선물대상",
    "occasion": "이벤트종류"
  },
  "requiredMcpTools": ["필요한 MCP 도구명"],
  "isActionRequired": true/false,
  "missingInfo": ["부족한 정보"],
  "clarificationQuestion": "질문 (필요시)"
}

## 예시

입력: "대학동기들이랑 다음주 홍대에서 밥 먹자"
→ intent: "complex"
→ requiredMcpTools: ["calendar_get_free_busy", "maps_recommend_restaurants"]
→ extractedInfo: { groupName: "대학동기", area: "홍대" }
→ isActionRequired: true

입력: "홍대 맛집 추천해줘"
→ intent: "place_recommendation"
→ requiredMcpTools: ["maps_recommend_restaurants"]
→ extractedInfo: { area: "홍대" }

입력: "여자친구 생일 선물 뭐가 좋을까"
→ intent: "gift_recommendation"
→ requiredMcpTools: ["shopping_recommend_gifts"]
→ extractedInfo: { recipient: "female", occasion: "birthday" }

입력: "내일 3시에 팀 미팅"
→ intent: "event"
→ requiredMcpTools: []
→ extractedInfo: { title: "팀 미팅", datetime: "..." }

반드시 JSON만 출력하세요.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || '{}';

      // JSON 파싱
      let jsonContent = content;
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        const jsonStart = content.indexOf('{');
        const jsonEnd = content.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonContent = content.substring(jsonStart, jsonEnd + 1);
        }
      }

      const parsed = JSON.parse(jsonContent);

      return {
        intent: parsed.intent || 'general',
        confidence: parsed.confidence || 0.5,
        extractedInfo: parsed.extractedInfo || {},
        missingInfo: parsed.missingInfo || [],
        clarificationQuestion: parsed.clarificationQuestion,
        requiredMcpTools: parsed.requiredMcpTools || [],
        isActionRequired: parsed.isActionRequired || false,
        originalMessage: userMessage
      };
    } catch (error) {
      console.error('[MCPAgentLoop] Extended Router error:', error);
      // 기본 라우터로 폴백
      const basicResult = await routeIntent(userMessage, context);
      return {
        ...basicResult,
        requiredMcpTools: [],
        isActionRequired: false
      };
    }
  }

  /**
   * MCP 도구가 필요한 의도 처리
   */
  private async handleMCPIntent(
    userMessage: string,
    routerResult: ExtendedRouterResult,
    agentContext: any
  ): Promise<AgentResponse> {
    const { intent, extractedInfo, requiredMcpTools } = routerResult;

    switch (intent) {
      case 'place_recommendation':
        return await this.handlePlaceRecommendation(extractedInfo);

      case 'group_schedule':
        return await this.handleGroupSchedule(extractedInfo);

      case 'shopping':
        return await this.handleShopping(extractedInfo);

      case 'gift_recommendation':
        return await this.handleGiftRecommendation(extractedInfo);

      case 'special_day':
        return await this.handleSpecialDay(extractedInfo);

      case 'complex':
        return await this.handleComplexScenario(userMessage, extractedInfo, requiredMcpTools || []);

      default:
        // Function Calling으로 자동 처리
        return await this.runWithMCPTools(userMessage, routerResult);
    }
  }

  /**
   * 표준 의도 처리 (기존 로직)
   */
  private async handleStandardIntent(
    routerResult: ExtendedRouterResult,
    agentContext: any,
    today: string
  ): Promise<AgentResponse> {
    // RouterResult로 변환 (타입 호환성을 위해)
    const standardResult = routerResult as unknown as RouterResult;

    switch (routerResult.intent) {
      case 'event':
        return await processEvent(standardResult, agentContext);

      case 'goal':
        return await processGoal(standardResult, agentContext);

      case 'todo':
        return await processTodo(standardResult, agentContext);

      case 'briefing':
        const todayEvents = this.context.events.filter(e =>
          e.datetime.startsWith(today)
        );
        const incompleteTodos = this.context.todos.filter(t => !t.is_completed);
        const activeGoals = this.context.goals.filter(g =>
          !['completed', 'failed'].includes(g.status)
        );
        return await processBriefing({
          ...agentContext,
          todayEvents,
          incompleteTodos,
          activeGoals
        });

      case 'clarification':
        return {
          message: routerResult.clarificationQuestion || '좀 더 자세히 말씀해 주시겠어요?',
          needs_user_input: true
        };

      default:
        return await processGeneral(routerResult.originalMessage || '', agentContext);
    }
  }

  // ====================================================
  // MCP 도구 활용 핸들러
  // ====================================================

  /**
   * 장소 추천 처리
   */
  private async handlePlaceRecommendation(info: any): Promise<AgentResponse> {
    const toolCall: MCPToolCall = {
      name: 'maps_recommend_restaurants',
      arguments: {
        area: info.area || info.location || '강남',
        cuisine: info.cuisine,
        minRating: 4.0,
        limit: 5
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success) {
      return {
        message: `장소 검색 중 문제가 발생했어요. 다시 시도해주세요.`,
        needs_user_input: true
      };
    }

    const restaurants = result.data?.restaurants || [];

    if (restaurants.length === 0) {
      return {
        message: `${info.area || '해당 지역'}에서 맛집을 찾지 못했어요. 다른 지역을 알려주세요.`,
        needs_user_input: true
      };
    }

    // 결과 포맷팅
    let message = `${info.area || '해당 지역'} 맛집 추천해드릴게요! 🍽️\n\n`;

    restaurants.slice(0, 5).forEach((r: any, idx: number) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
      message += `${medal} **${r.name}**\n`;
      if (r.rating) message += `   ⭐ ${r.rating}`;
      if (r.userRatingsTotal) message += ` (리뷰 ${r.userRatingsTotal}개)`;
      message += '\n';
      if (r.address) message += `   📍 ${r.address}\n`;
      message += '\n';
    });

    message += '어디로 갈까요? 일정에 추가해드릴까요?';

    return {
      message,
      suggestions: restaurants.slice(0, 3).map((r: any) => r.name),
      mcp_data: { restaurants }
    };
  }

  /**
   * 그룹 일정 조율 처리
   */
  private async handleGroupSchedule(info: any): Promise<AgentResponse> {
    if (!info.memberEmails || info.memberEmails.length === 0) {
      return {
        message: `그룹 일정을 조율하려면 멤버들의 이메일이 필요해요. 누구와 함께 하시나요?`,
        needs_user_input: true
      };
    }

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const toolCall: MCPToolCall = {
      name: 'calendar_get_free_busy',
      arguments: {
        emails: info.memberEmails,
        startDate: info.startDate || today.toISOString().split('T')[0],
        endDate: info.endDate || nextWeek.toISOString().split('T')[0]
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success) {
      return {
        message: `일정 조회 중 문제가 발생했어요. Google Calendar 연동을 확인해주세요.`,
        needs_user_input: true
      };
    }

    const { availableSlots, summary } = result.data || {};

    if (!availableSlots || availableSlots.length === 0) {
      return {
        message: `아쉽게도 모두 가능한 시간을 찾지 못했어요. 다른 기간을 확인해볼까요?`,
        needs_user_input: true
      };
    }

    let message = `${info.groupName || '그룹'} 일정 확인했어요! 📅\n\n`;
    message += `✅ 모두 가능한 시간:\n`;

    availableSlots.slice(0, 5).forEach((slot: any) => {
      message += `• ${slot.date} ${slot.startTime} - ${slot.endTime}\n`;
    });

    if (availableSlots.length > 5) {
      message += `외 ${availableSlots.length - 5}개 시간대...\n`;
    }

    message += `\n어떤 시간이 좋으세요?`;

    return {
      message,
      suggestions: availableSlots.slice(0, 3).map((s: any) => `${s.date} ${s.startTime}`),
      mcp_data: { availableSlots }
    };
  }

  /**
   * 쇼핑/상품 검색 처리
   */
  private async handleShopping(info: any): Promise<AgentResponse> {
    const toolCall: MCPToolCall = {
      name: 'shopping_search',
      arguments: {
        query: info.searchQuery || info.title,
        minPrice: info.minPrice,
        maxPrice: info.maxPrice || info.budget
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success || !result.data?.products?.length) {
      return {
        message: `상품을 찾지 못했어요. 다른 검색어로 시도해볼까요?`,
        needs_user_input: true
      };
    }

    const products = result.data.products;

    let message = `상품 검색 결과예요! 🛒\n\n`;

    products.slice(0, 5).forEach((p: any, idx: number) => {
      message += `${idx + 1}. **${p.title}**\n`;
      message += `   💰 ${p.price.toLocaleString()}원`;
      if (p.discountRate) message += ` (${p.discountRate}% 할인)`;
      message += '\n';
      if (p.rating) message += `   ⭐ ${p.rating}`;
      if (p.reviewCount) message += ` (리뷰 ${p.reviewCount}개)`;
      message += '\n';
      message += `   🏪 ${p.mall}\n\n`;
    });

    return {
      message,
      mcp_data: { products }
    };
  }

  /**
   * 선물 추천 처리
   */
  private async handleGiftRecommendation(info: any): Promise<AgentResponse> {
    const toolCall: MCPToolCall = {
      name: 'shopping_recommend_gifts',
      arguments: {
        recipient: info.recipient || 'friend',
        occasion: info.occasion || 'birthday',
        minPrice: info.minPrice,
        maxPrice: info.maxPrice || info.budget
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success || !result.data?.gifts?.length) {
      return {
        message: `선물 추천이 어려워요. 조금 더 구체적으로 알려주시겠어요? (받는 분, 상황, 예산 등)`,
        needs_user_input: true
      };
    }

    const gifts = result.data.gifts;

    let message = `선물 추천해드릴게요! 🎁\n\n`;

    gifts.slice(0, 5).forEach((g: any, idx: number) => {
      message += `${idx + 1}. **${g.title}**\n`;
      message += `   💰 ${g.price.toLocaleString()}원\n`;
      if (g.rating) message += `   ⭐ ${g.rating}\n`;
      message += '\n';
    });

    message += '마음에 드는 선물이 있으세요?';

    return {
      message,
      mcp_data: { gifts }
    };
  }

  /**
   * 특별한 날 준비 처리
   */
  private async handleSpecialDay(info: any): Promise<AgentResponse> {
    const toolCall: MCPToolCall = {
      name: 'prepare_special_day',
      arguments: {
        occasion: info.occasion || 'birthday',
        date: info.datetime?.split('T')[0] || info.targetDate,
        recipient: info.recipient || 'friend',
        preferredArea: info.area || info.location,
        budget: info.budget
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success) {
      return {
        message: `특별한 날 준비를 도와드리고 싶은데, 조금 더 정보가 필요해요. 언제, 누구를 위한 것인지 알려주세요!`,
        needs_user_input: true
      };
    }

    const { recommendedRestaurants, recommendedGifts, existingEvents } = result.data;

    let message = `특별한 날 준비를 도와드릴게요! 🎉\n\n`;

    // 기존 일정 확인
    if (existingEvents?.length > 0) {
      message += `⚠️ 해당 날짜에 이미 일정이 있어요:\n`;
      existingEvents.forEach((e: any) => {
        message += `• ${e.summary}\n`;
      });
      message += '\n';
    }

    // 레스토랑 추천
    if (recommendedRestaurants?.length > 0) {
      message += `🍽️ 추천 레스토랑:\n`;
      recommendedRestaurants.slice(0, 3).forEach((r: any, idx: number) => {
        message += `${idx + 1}. ${r.name}`;
        if (r.rating) message += ` ⭐${r.rating}`;
        message += '\n';
      });
      message += '\n';
    }

    // 선물 추천
    if (recommendedGifts?.length > 0) {
      message += `🎁 추천 선물:\n`;
      recommendedGifts.slice(0, 3).forEach((g: any, idx: number) => {
        message += `${idx + 1}. ${g.title} - ${g.price.toLocaleString()}원\n`;
      });
    }

    message += '\n일정과 예약을 도와드릴까요?';

    return {
      message,
      mcp_data: result.data
    };
  }

  /**
   * 복합 시나리오 처리
   */
  private async handleComplexScenario(
    userMessage: string,
    info: any,
    requiredTools: string[]
  ): Promise<AgentResponse> {
    // 복합 시나리오: 여러 MCP 도구 순차 실행

    let message = '';
    const mcpData: any = {};

    // 1. 그룹 일정 확인 (있다면)
    if (requiredTools.includes('calendar_get_free_busy') && info.memberEmails) {
      const scheduleResult = await this.handleGroupSchedule(info);
      if (scheduleResult.mcp_data?.availableSlots) {
        message += `📅 일정 확인 완료!\n`;
        const slots = scheduleResult.mcp_data.availableSlots.slice(0, 3);
        slots.forEach((s: any) => {
          message += `• ${s.date} ${s.startTime} 가능\n`;
        });
        message += '\n';
        mcpData.availableSlots = scheduleResult.mcp_data.availableSlots;
      }
    }

    // 2. 장소 추천 (있다면)
    if (requiredTools.includes('maps_recommend_restaurants') && info.area) {
      const placeResult = await this.handlePlaceRecommendation(info);
      if (placeResult.mcp_data?.restaurants) {
        message += `🍽️ ${info.area} 맛집 추천!\n`;
        placeResult.mcp_data.restaurants.slice(0, 3).forEach((r: any, idx: number) => {
          message += `${idx + 1}. ${r.name}`;
          if (r.rating) message += ` ⭐${r.rating}`;
          message += '\n';
        });
        message += '\n';
        mcpData.restaurants = placeResult.mcp_data.restaurants;
      }
    }

    // 3. 쇼핑 추천 (있다면)
    if (requiredTools.includes('shopping_search') || requiredTools.includes('shopping_goal_recommendations')) {
      const shoppingResult = await this.handleShopping(info);
      if (shoppingResult.mcp_data?.products) {
        message += `🛒 관련 상품!\n`;
        shoppingResult.mcp_data.products.slice(0, 2).forEach((p: any, idx: number) => {
          message += `${idx + 1}. ${p.title} - ${p.price.toLocaleString()}원\n`;
        });
        mcpData.products = shoppingResult.mcp_data.products;
      }
    }

    if (!message) {
      message = '요청을 처리하고 있어요. 조금 더 구체적으로 알려주시겠어요?';
    } else {
      message += '\n어떻게 진행할까요?';
    }

    return {
      message,
      mcp_data: mcpData
    };
  }

  /**
   * MCP 도구로 Function Calling 실행
   */
  private async runWithMCPTools(
    userMessage: string,
    routerResult: ExtendedRouterResult
  ): Promise<AgentResponse> {
    const today = new Date().toISOString().split('T')[0];

    const systemPrompt = this.buildMCPSystemPrompt(today);

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
        tools: this.allToolDefinitions,
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

          console.log(`[MCPAgentLoop] Calling tool: ${toolName}`, toolArgs);

          let toolResult: any;

          // MCP 도구인지 확인
          if (this.isMCPTool(toolName)) {
            const mcpResult = await this.mcpOrchestrator.executeTool({
              name: toolName,
              arguments: toolArgs
            });
            toolResult = mcpResult.success ? mcpResult.data : { error: mcpResult.error };
          } else if (toolCategories.calendar.includes(toolName)) {
            // 기존 내부 Calendar 도구
            toolResult = await executeCalendarTool(toolName, toolArgs, this.context.user_id);
          } else {
            // 기존 PALM 도구
            toolResult = await executePalmTool(toolName, toolArgs, this.context.user_id, this.chronotype);
          }

          console.log(`[MCPAgentLoop] Tool result:`, toolResult);

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult)
          });
        }
        continue;
      }

      // Tool 호출이 없으면 최종 응답
      return {
        message: assistantMessage.content || '무엇을 도와드릴까요?'
      };
    }

    return {
      message: '처리 중 문제가 발생했습니다. 다시 시도해주세요.',
      needs_user_input: true
    };
  }

  private isMCPTool(toolName: string): boolean {
    return [
      ...toolCategories.calendar,
      ...toolCategories.maps,
      ...toolCategories.shopping,
      ...toolCategories.integrated
    ].some(t => t.startsWith('calendar_') || t.startsWith('maps_') || t.startsWith('shopping_') || t.startsWith('plan_') || t.startsWith('prepare_'))
      && (toolName.startsWith('calendar_') || toolName.startsWith('maps_') || toolName.startsWith('shopping_') || toolName.startsWith('plan_') || toolName.startsWith('prepare_'));
  }

  private buildMCPSystemPrompt(today: string): string {
    return `당신은 PALM(Personal AI Life Manager) - "행동하는" AI 비서입니다.

## 핵심 원칙
1. **대신 해줄 수 있으면 대신 한다** - 사용자가 직접 할 필요 없는 일은 에이전트가 처리
2. **연결해서 가치를 만든다** - 일정 + 장소 추천 + 쇼핑이 하나의 흐름으로
3. **맥락을 기억하고 활용한다** - 과거 약속 장소, 선호도 학습

## 현재 정보
- 오늘: ${today}
- 사용자 ID: ${this.context.user_id}
- 활성 목표: ${this.context.goals.filter(g => !['completed', 'failed'].includes(g.status)).map(g => g.title).join(', ') || '없음'}
- 미완료 할 일: ${this.context.todos.filter(t => !t.is_completed).length}개

## 사용 가능한 MCP 도구

### Calendar (Google Calendar)
- calendar_create_event: 일정 생성
- calendar_list_events: 일정 조회
- calendar_check_conflicts: 충돌 확인
- calendar_get_free_busy: 그룹 가능 시간 찾기

### Maps (장소 서비스)
- maps_recommend_restaurants: 맛집 추천
- maps_search_places: 장소 검색
- maps_find_midpoint: 중간 지점 찾기

### Shopping
- shopping_search: 상품 검색
- shopping_recommend_gifts: 선물 추천
- shopping_goal_recommendations: 목표 연계 추천

### 복합 기능
- plan_group_meeting: 그룹 약속 계획 (일정 + 장소)
- prepare_special_day: 특별한 날 준비 (일정 + 장소 + 선물)

## 응답 스타일
- 한국어로 친근하게
- 실제 행동 결과를 보여주기
- 다음 단계 제안하기

항상 사용자를 대신해서 행동하고, 결과를 보고하세요.`;
  }
}

/**
 * MCP Agent Loop 인스턴스 생성 헬퍼
 */
export function createMCPAgentLoop(
  context: OrchestratorContext,
  chronotype?: Chronotype,
  mcpConfig?: {
    googleCalendarTokens?: { access_token: string; refresh_token?: string };
  }
): MCPAgentLoop {
  return new MCPAgentLoop(context, chronotype, mcpConfig);
}
