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
import { getNewsMCP } from '../mcp/news.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 확장된 의도 타입
type ExtendedIntentType = IntentType |
  'place_recommendation' |
  'group_schedule' |
  'shopping' |
  'places' |
  'news' |
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
        message: 'Sorry, please say that again.',
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
    const systemPrompt = `You are an expert analyst who understands user intent and determines necessary tools.

## Role
1. Identify intent from user input
2. Decide necessary tools (Internal vs MCP tools)
3. Extract information from input

## Intent Classification

### Basic Intents (Internal)
- "event": Add event/appointment (Internal Calendar)
- "todo": Add task
- "goal": Set goal
- "briefing": Check today's schedule
- "general": General conversation

### MCP Intents (External Integration)
- "place_recommendation": Need place recommendation (restaurant, cafe, meeting spot)
- "group_schedule": Coordinate group schedule
- "shopping": Search/Recommend products
- "gift_recommendation": Recommend gifts
- "special_day": Prepare for special day (birthday, anniversary)
- "complex": Complex scenario (Event + Place recommendation, etc.)

## MCP Tool Decision

### Calendar MCP (Google Calendar)
Required when:
- "Add to calendar", "Google Calendar"
- Group scheduling, Free/Busy check
- Sync with external calendar

### Maps MCP (Place Services)
Required when:
- "Recommend restaurant", "Find cafe"
- "Where should we meet", "Midpoint"
- "How far", "How many minutes"

### Shopping MCP
Required when:
- "Search product", "Compare prices"
- "Recommend gift", "What should I buy"
- Recommend items related to goals

## Current Info
- Today: ${context.today}
- End of Month: ${context.endOfMonth}
- End of Week: ${context.endOfWeek}

## Response Format (JSON)
{
  "intent": "intent_type",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "title": "title",
    "datetime": "YYYY-MM-DDTHH:mm:ss",
    "targetDate": "YYYY-MM-DD",
    "location": "location/area",
    "area": "area_name (for recommendation)",
    "cuisine": "food_type",
    "groupName": "group_name",
    "memberEmails": ["email1@..."],
    "searchQuery": "query",
    "budget": number,
    "recipient": "recipient",
    "occasion": "occasion_type"
  },
  "requiredMcpTools": ["tool_name"],
  "isActionRequired": true/false,
  "missingInfo": ["missing_info"],
  "clarificationQuestion": "question (if needed)"
}

## Examples

Input: "Let's eat at Hongdae with college friends next week"
→ intent: "complex"
→ requiredMcpTools: ["calendar_get_free_busy", "maps_recommend_restaurants"]
→ extractedInfo: { groupName: "College Friends", area: "Hongdae" }
→ isActionRequired: true

Input: "Recommend a restaurant in Hongdae"
→ intent: "place_recommendation"
→ requiredMcpTools: ["maps_recommend_restaurants"]
→ extractedInfo: { area: "Hongdae" }

Input: "What should I buy for my girlfriend's birthday?"
→ intent: "gift_recommendation"
→ requiredMcpTools: ["shopping_recommend_gifts"]
→ extractedInfo: { recipient: "female", occasion: "birthday" }

Input: "Team meeting tomorrow at 3 PM"
→ intent: "event"
→ requiredMcpTools: []
→ extractedInfo: { title: "Team Meeting", datetime: "..." }

IMPORTANT:
1. ALWAYS output valid JSON only.
2. EXTRACT English values if possible, or keep original if specific names.
3. LANGUAGE: The follow-up response will be in English.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
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
      case 'places':
        return await this.handlePlaceRecommendation(extractedInfo);

      case 'group_schedule':
        return await this.handleGroupSchedule(extractedInfo);

      case 'shopping':
        return await this.handleShopping(extractedInfo);

      case 'news':
        return await this.handleNews(extractedInfo);

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
          message: routerResult.clarificationQuestion || 'Could you please be more specific?',
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
        limit: 6
      }
    };

    const result = await this.mcpOrchestrator.executeTool(toolCall);

    if (!result.success) {
      return {
        message: `Place search failed. Please try again.`,
        needs_user_input: true
      };
    }

    const restaurants = result.data?.restaurants || [];

    if (restaurants.length === 0) {
      return {
        message: `No places found. Try another location.`,
        needs_user_input: true
      };
    }

    const area = info.area || info.location || 'the area';

    return {
      message: `🍽️ ${area} recommendations`,
      mcp_data: { restaurants }
    };
  }

  /**
   * 그룹 일정 조율 처리
   */
  private async handleGroupSchedule(info: any): Promise<AgentResponse> {
    if (!info.memberEmails || info.memberEmails.length === 0) {
      return {
        message: `I need member emails to coordinate the schedule. Who are you meeting with?`,
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
        message: `I encountered an issue checking the schedule. Please check the Google Calendar integration.`,
        needs_user_input: true
      };
    }

    const { availableSlots, summary } = result.data || {};

    if (!availableSlots || availableSlots.length === 0) {
      return {
        message: `I couldn't find a time where everyone is available. Shall we check another date?`,
        needs_user_input: true
      };
    }

    let message = `I checked the schedule for ${info.groupName || 'the group'}! 📅\n\n`;
    message += `✅ Available times:\n`;

    availableSlots.slice(0, 5).forEach((slot: any) => {
      message += `• ${slot.date} ${slot.startTime} - ${slot.endTime}\n`;
    });

    if (availableSlots.length > 5) {
      message += `and ${availableSlots.length - 5} more slots...\n`;
    }

    message += `\nWhich time works best for you?`;

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

    if (!result.success) {
      // Check for quota exceeded error
      if (result.error?.includes('run out of searches') || result.error?.includes('quota')) {
        return {
          message: `⚠️ The product search API quota has been exceeded. Please try again later or contact the administrator.`,
          needs_user_input: false
        };
      }
      return {
        message: `I couldn't find any products. Shall we try a different search term?`,
        needs_user_input: true
      };
    }

    if (!result.data?.products?.length) {
      return {
        message: `I couldn't find any products matching "${info.searchQuery || info.title}". Would you like to try a different search term?`,
        needs_user_input: true
      };
    }

    const products = result.data.products;
    const query = info.searchQuery || info.title || 'products';

    // Simple, clean response - details are shown in cards below
    const message = `Here are the search results for "${query}"! 🛒`;

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

    if (!result.success) {
      // Check for quota exceeded error
      if (result.error?.includes('run out of searches') || result.error?.includes('quota')) {
        return {
          message: `⚠️ The product search API quota has been exceeded. Please try again later or contact the administrator.`,
          needs_user_input: false
        };
      }
      return {
        message: `It's hard to recommend a gift. Could you give me more details? (Recipient, Occasion, Budget, etc.)`,
        needs_user_input: true
      };
    }

    if (!result.data?.gifts?.length) {
      return {
        message: `It's hard to recommend a gift. Could you give me more details? (Recipient, Occasion, Budget, etc.)`,
        needs_user_input: true
      };
    }

    const gifts = result.data.gifts;
    const occasion = info.occasion || 'the occasion';

    // Simple, clean response - details are shown in cards below
    const message = `Here are some gift ideas for ${occasion}! 🎁`;

    return {
      message,
      mcp_data: { gifts }
    };
  }

  /**
   * 뉴스 브리핑 처리
   */
  private async handleNews(info: any): Promise<AgentResponse> {
    const newsMcp = getNewsMCP();

    try {
      let articles;
      let title = 'News Briefing';

      if (info.timeRange === 'overnight') {
        // Last night's news
        articles = await newsMcp.getOvernightNews();
        title = 'Overnight News';
      } else if (info.newsCategory) {
        // Category news
        articles = await newsMcp.getTopHeadlines({
          category: info.newsCategory as any,
          pageSize: 10
        });
        title = `${info.newsCategory} News`;
      } else if (info.newsQuery) {
        // Keyword Search
        articles = await newsMcp.searchNews({
          query: info.newsQuery,
          pageSize: 10
        });
        title = `News related to "${info.newsQuery}"`;
      } else {
        // Default: Headlines
        articles = await newsMcp.getTopHeadlines({ pageSize: 10 });
        title = 'Today\'s Headlines';
      }

      if (!articles || articles.length === 0) {
        return {
          message: 'I had trouble fetching the news. Please try again later.',
          needs_user_input: true
        };
      }

      let message = `📰 ${title}\n\n`;

      articles.slice(0, 5).forEach((article, idx) => {
        const emoji = idx === 0 ? '🔥' : idx === 1 ? '📌' : idx === 2 ? '📍' : '•';
        message += `${emoji} **${article.title}**\n`;
        if (article.description) {
          const shortDesc = article.description.length > 80
            ? article.description.substring(0, 80) + '...'
            : article.description;
          message += `   ${shortDesc}\n`;
        }
        message += `   📰 ${article.source}\n\n`;
      });

      if (articles.length > 5) {
        message += `and ${articles.length - 5} more stories.`;
      }

      return {
        message,
        mcp_data: { news: articles }
      };
    } catch (error) {
      console.error('[MCPAgentLoop] News error:', error);
      return {
        message: 'I had trouble fetching the news. Please try again later.',
        needs_user_input: true
      };
    }
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
        message: `I want to help with your special day, but I need more info. Please tell me when and who it is for!`,
        needs_user_input: true
      };
    }

    const { recommendedRestaurants, recommendedGifts, existingEvents } = result.data;

    let message = `I'll help you prepare for the special day! 🎉\n\n`;

    // Existing Events
    if (existingEvents?.length > 0) {
      message += `⚠️ You already have events on that day:\n`;
      existingEvents.forEach((e: any) => {
        message += `• ${e.summary}\n`;
      });
      message += '\n';
    }

    // Restaurant Recommendations
    if (recommendedRestaurants?.length > 0) {
      message += `🍽️ Restaurant Recommendations:\n`;
      recommendedRestaurants.slice(0, 3).forEach((r: any, idx: number) => {
        message += `${idx + 1}. ${r.name}`;
        if (r.rating) message += ` ⭐${r.rating}`;
        message += '\n';
      });
      message += '\n';
    }

    // Gift Recommendations
    if (recommendedGifts?.length > 0) {
      message += `🎁 Gift Recommendations:\n`;
      recommendedGifts.slice(0, 3).forEach((g: any, idx: number) => {
        message += `${idx + 1}. ${g.title} - ${g.price.toLocaleString()} KRW\n`;
      });
    }

    message += '\nShall I help with schedule and reservations?';

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
        message += `📅 Schedule checked!\n`;
        const slots = scheduleResult.mcp_data.availableSlots.slice(0, 3);
        slots.forEach((s: any) => {
          message += `• ${s.date} ${s.startTime} available\n`;
        });
        message += '\n';
        mcpData.availableSlots = scheduleResult.mcp_data.availableSlots;
      }
    }

    // 2. 장소 추천 (있다면)
    if (requiredTools.includes('maps_recommend_restaurants') && info.area) {
      const placeResult = await this.handlePlaceRecommendation(info);
      if (placeResult.mcp_data?.restaurants) {
        message += `🍽️ ${info.area} Restaurant Recommendations!\n`;
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
        message += `🛒 Related Products!\n`;
        shoppingResult.mcp_data.products.slice(0, 2).forEach((p: any, idx: number) => {
          message += `${idx + 1}. ${p.title} - ${p.price.toLocaleString()} KRW\n`;
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
        model: 'gpt-4o',
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
