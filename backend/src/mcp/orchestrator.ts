/**
 * MCP Orchestrator
 *
 * 여러 MCP 도구 호출을 조율하고 실행하는 오케스트레이터
 * - 도구 호출 라우팅
 * - 복합 시나리오 처리
 * - 결과 통합
 */

import { GoogleCalendarMCP, getGoogleCalendarMCP } from './googleCalendar.js';
import { GoogleMapsMCP, getGoogleMapsMCP, PlaceSearchResult, PlaceDetails } from './googleMaps.js';
import { ShoppingMCP, getShoppingMCP, ProductSearchResult } from './shopping.js';
import { toolCategories } from './toolDefinitions.js';

export interface MCPToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface MCPToolResult {
  success: boolean;
  data?: any;
  error?: string;
  toolName: string;
}

export interface MCPConfig {
  googleCalendar?: {
    enabled: boolean;
    tokens?: {
      access_token: string;
      refresh_token?: string;
    };
  };
  googleMaps?: {
    enabled: boolean;
    apiKey?: string;
  };
  shopping?: {
    enabled: boolean;
    naverClientId?: string;
    naverClientSecret?: string;
  };
}

export class MCPOrchestrator {
  private calendarMCP: GoogleCalendarMCP;
  private mapsMCP: GoogleMapsMCP;
  private shoppingMCP: ShoppingMCP;
  private config: MCPConfig;
  private userId: string;

  constructor(userId: string, config?: MCPConfig) {
    this.userId = userId;
    this.config = config || {};

    // MCP 클라이언트 초기화
    this.calendarMCP = getGoogleCalendarMCP();
    this.mapsMCP = getGoogleMapsMCP();
    this.shoppingMCP = getShoppingMCP();

    // 토큰 설정 (Calendar)
    if (config?.googleCalendar?.tokens) {
      this.calendarMCP.setCredentials(config.googleCalendar.tokens);
    }
  }

  /**
   * 도구 호출 실행
   */
  async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    const { name, arguments: args } = toolCall;

    console.log(`[MCPOrchestrator] Executing tool: ${name}`, args);

    try {
      // 도구 카테고리 확인
      if (toolCategories.calendar.includes(name)) {
        return await this.executeCalendarTool(name, args);
      } else if (toolCategories.maps.includes(name)) {
        return await this.executeMapsTool(name, args);
      } else if (toolCategories.shopping.includes(name)) {
        return await this.executeShoppingTool(name, args);
      } else if (toolCategories.integrated.includes(name)) {
        return await this.executeIntegratedTool(name, args);
      } else {
        return {
          success: false,
          error: `Unknown tool: ${name}`,
          toolName: name
        };
      }
    } catch (error) {
      console.error(`[MCPOrchestrator] Tool execution error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        toolName: name
      };
    }
  }

  /**
   * 여러 도구 호출 일괄 실행
   */
  async executeTools(toolCalls: MCPToolCall[]): Promise<MCPToolResult[]> {
    const results: MCPToolResult[] = [];

    for (const toolCall of toolCalls) {
      const result = await this.executeTool(toolCall);
      results.push(result);
    }

    return results;
  }

  // ====================================================
  // Calendar Tools
  // ====================================================

  private async executeCalendarTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'calendar_create_event': {
        const event = await this.calendarMCP.quickCreateEvent({
          title: args.title,
          date: args.date,
          startTime: args.startTime,
          endTime: args.endTime,
          location: args.location,
          description: args.description
        });
        return {
          success: true,
          data: {
            message: `Event created: "${args.title}"`,
            event
          },
          toolName: name
        };
      }

      case 'calendar_list_events': {
        const events = await this.calendarMCP.listEvents({
          timeMin: `${args.startDate}T00:00:00+09:00`,
          timeMax: args.endDate ? `${args.endDate}T23:59:59+09:00` : undefined
        });
        return {
          success: true,
          data: {
            events,
            count: events.length
          },
          toolName: name
        };
      }

      case 'calendar_check_conflicts': {
        const conflicts = await this.calendarMCP.checkConflicts({
          startTime: `${args.date}T${args.startTime}:00+09:00`,
          endTime: `${args.date}T${args.endTime}:00+09:00`
        });
        return {
          success: true,
          data: {
            hasConflicts: conflicts.length > 0,
            conflicts,
            message: conflicts.length > 0
              ? `Conflicts with ${conflicts.length} events: ${conflicts.map(c => c.summary).join(', ')}`
              : 'No conflicting events.'
          },
          toolName: name
        };
      }

      case 'calendar_get_free_busy': {
        const slots = await this.calendarMCP.findGroupAvailableSlots({
          emails: args.emails,
          startDate: args.startDate,
          endDate: args.endDate,
          workHoursStart: args.preferredTimeOfDay === 'morning' ? 9 : args.preferredTimeOfDay === 'afternoon' ? 12 : 18,
          workHoursEnd: args.preferredTimeOfDay === 'morning' ? 12 : args.preferredTimeOfDay === 'afternoon' ? 18 : 22
        });

        const availableSlots = slots.filter(s => s.allAvailable);
        const negotiableSlots = slots.filter(s => !s.allAvailable && s.unavailableMembers);

        return {
          success: true,
          data: {
            availableSlots,
            negotiableSlots,
            summary: {
              totalSlots: slots.length,
              fullyAvailable: availableSlots.length,
              partiallyAvailable: negotiableSlots.length
            }
          },
          toolName: name
        };
      }

      case 'calendar_update_event': {
        const updates: any = {};
        if (args.title) updates.summary = args.title;
        if (args.location) updates.location = args.location;
        if (args.date && args.startTime) {
          updates.start = {
            dateTime: `${args.date}T${args.startTime}:00`,
            timeZone: 'Asia/Seoul'
          };
        }
        if (args.date && args.endTime) {
          updates.end = {
            dateTime: `${args.date}T${args.endTime}:00`,
            timeZone: 'Asia/Seoul'
          };
        }

        const event = await this.calendarMCP.updateEvent(args.eventId, updates);
        return {
          success: true,
          data: {
            message: 'Event updated.',
            event
          },
          toolName: name
        };
      }

      case 'calendar_delete_event': {
        const deleted = await this.calendarMCP.deleteEvent(args.eventId);
        return {
          success: deleted,
          data: {
            message: deleted ? 'Event deleted.' : 'Failed to delete event.'
          },
          toolName: name
        };
      }

      default:
        return {
          success: false,
          error: `Unknown calendar tool: ${name}`,
          toolName: name
        };
    }
  }

  // ====================================================
  // Maps Tools
  // ====================================================

  private async executeMapsTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'maps_search_places': {
        const places = await this.mapsMCP.searchText({
          query: args.query,
          type: args.type,
          minPrice: args.priceLevel,
          maxPrice: args.priceLevel,
          openNow: args.openNow
        });

        // 평점 필터링
        let filtered = places;
        if (args.minRating) {
          filtered = places.filter(p => (p.rating || 0) >= args.minRating);
        }

        return {
          success: true,
          data: {
            places: filtered.slice(0, 10),
            count: filtered.length
          },
          toolName: name
        };
      }

      case 'maps_get_place_details': {
        const details = await this.mapsMCP.getPlaceDetails(args.placeId);
        return {
          success: !!details,
          data: details,
          error: details ? undefined : 'Place details not found.',
          toolName: name
        };
      }

      case 'maps_get_distance': {
        const distance = await this.mapsMCP.getDistance({
          origin: args.origin,
          destination: args.destination,
          mode: args.mode || 'transit'
        });
        return {
          success: !!distance,
          data: distance,
          error: distance ? undefined : 'Cannot calculate distance.',
          toolName: name
        };
      }

      case 'maps_find_midpoint': {
        const midpoint = await this.mapsMCP.findMidpoint({
          members: args.members,
          placeType: args.placeType || 'restaurant'
        });
        return {
          success: !!midpoint,
          data: midpoint,
          error: midpoint ? undefined : 'Cannot find midpoint.',
          toolName: name
        };
      }

      case 'maps_recommend_restaurants': {
        const restaurants = await this.mapsMCP.recommendRestaurants({
          area: args.area,
          cuisine: args.cuisine,
          minRating: args.minRating || 4.0,
          priceLevel: args.priceLevel,
          limit: args.limit || 6
        });

        // Transform to frontend-friendly format with photos and category
        const transformedRestaurants = restaurants.map((r: PlaceSearchResult) => ({
          id: r.placeId,
          name: r.name,
          address: r.address,
          rating: r.rating,
          reviewCount: r.userRatingsTotal,
          priceLevel: r.priceLevel !== undefined ? '$'.repeat(r.priceLevel + 1) : undefined,
          openNow: r.openNow,
          types: r.types,
          category: this.formatPlaceTypes(r.types),
          photos: r.photoReference ? [
            `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${r.photoReference}&key=${process.env.GOOGLE_MAPS_API_KEY}`
          ] : undefined
        }));

        return {
          success: true,
          data: {
            restaurants: transformedRestaurants,
            count: transformedRestaurants.length
          },
          toolName: name
        };
      }

      default:
        return {
          success: false,
          error: `Unknown maps tool: ${name}`,
          toolName: name
        };
    }
  }

  // ====================================================
  // Shopping Tools
  // ====================================================

  private async executeShoppingTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'shopping_search': {
        const products = await this.shoppingMCP.searchWithFilters({
          query: args.query,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice,
          limit: 10
        });
        return {
          success: true,
          data: {
            products,
            count: products.length
          },
          toolName: name
        };
      }

      case 'shopping_compare_prices': {
        const comparison = await this.shoppingMCP.comparePrices(args.productName);
        return {
          success: !!comparison,
          data: comparison,
          error: comparison ? undefined : 'Product not found.',
          toolName: name
        };
      }

      case 'shopping_goal_recommendations': {
        const recommendations = await this.shoppingMCP.getGoalBasedRecommendations({
          goalType: args.goalType,
          goalDescription: args.goalDescription,
          budget: args.budget
        });
        return {
          success: true,
          data: recommendations,
          toolName: name
        };
      }

      case 'shopping_recommend_gifts': {
        const gifts = await this.shoppingMCP.recommendGifts({
          recipient: args.recipient,
          occasion: args.occasion,
          minPrice: args.minPrice,
          maxPrice: args.maxPrice
        });
        return {
          success: true,
          data: {
            gifts,
            count: gifts.length
          },
          toolName: name
        };
      }

      default:
        return {
          success: false,
          error: `Unknown shopping tool: ${name}`,
          toolName: name
        };
    }
  }

  // ====================================================
  // Integrated Tools (복합 시나리오)
  // ====================================================

  private async executeIntegratedTool(name: string, args: Record<string, any>): Promise<MCPToolResult> {
    switch (name) {
      case 'plan_group_meeting': {
        return await this.planGroupMeeting(args);
      }

      case 'prepare_special_day': {
        return await this.prepareSpecialDay(args);
      }

      default:
        return {
          success: false,
          error: `Unknown integrated tool: ${name}`,
          toolName: name
        };
    }
  }

  /**
   * 그룹 미팅 계획 (복합 시나리오)
   *
   * 1. Free/Busy로 가능 시간 확인
   * 2. 장소 추천
   * 3. 결과 통합
   */
  private async planGroupMeeting(args: Record<string, any>): Promise<MCPToolResult> {
    const { groupName, memberEmails, dateRange, preferredArea, placeType } = args;

    try {
      // 1. 멤버들의 가능 시간 조회
      const freeBusyResult = await this.executeCalendarTool('calendar_get_free_busy', {
        emails: memberEmails,
        startDate: dateRange.start,
        endDate: dateRange.end
      });

      // 2. 장소 추천 (지역이 지정된 경우)
      let placeResult: MCPToolResult | null = null;
      if (preferredArea) {
        placeResult = await this.executeMapsTool('maps_recommend_restaurants', {
          area: preferredArea,
          minRating: 4.0,
          limit: 5
        });
      }

      // 3. 결과 통합
      const availableSlots = freeBusyResult.data?.availableSlots || [];
      const recommendedPlaces = placeResult?.data?.restaurants || [];

      // 가장 좋은 시간 슬롯 추천 (저녁 시간 우선)
      const bestSlots = availableSlots
        .filter((s: any) => {
          const hour = parseInt(s.startTime.split(':')[0], 10);
          return hour >= 18 && hour <= 20;  // 저녁 6-8시 우선
        })
        .slice(0, 3);

      return {
        success: true,
        data: {
          groupName,
          memberCount: memberEmails.length,
          dateRange,
          availability: {
            availableSlots: bestSlots.length > 0 ? bestSlots : availableSlots.slice(0, 5),
            totalAvailable: availableSlots.length
          },
          recommendedPlaces,
          suggestion: bestSlots.length > 0
            ? `${groupName} meeting is possible on ${bestSlots[0].date} at ${bestSlots[0].startTime}. ${recommendedPlaces.length > 0 ? `How about ${recommendedPlaces[0].name}?` : ''}`
            : `Found ${availableSlots.length} available slots.`
        },
        toolName: 'plan_group_meeting'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to plan group meeting',
        toolName: 'plan_group_meeting'
      };
    }
  }

  /**
   * 특별한 날 준비 (복합 시나리오)
   *
   * 1. 일정 확인 (충돌 체크)
   * 2. 레스토랑 추천
   * 3. 선물 추천
   */
  private async prepareSpecialDay(args: Record<string, any>): Promise<MCPToolResult> {
    const { occasion, date, recipient, preferredArea, budget } = args;

    try {
      // 1. 해당 날짜 일정 확인
      const eventsResult = await this.executeCalendarTool('calendar_list_events', {
        startDate: date,
        endDate: date
      });

      // 2. 레스토랑 추천
      let restaurantResult: MCPToolResult | null = null;
      if (preferredArea) {
        restaurantResult = await this.executeMapsTool('maps_recommend_restaurants', {
          area: preferredArea,
          minRating: 4.5,  // 특별한 날이니 더 높은 기준
          limit: 3
        });
      }

      // 3. 선물 추천
      const giftResult = await this.executeShoppingTool('shopping_recommend_gifts', {
        recipient,
        occasion,
        maxPrice: budget
      });

      return {
        success: true,
        data: {
          occasion,
          date,
          existingEvents: eventsResult.data?.events || [],
          recommendedRestaurants: restaurantResult?.data?.restaurants || [],
          recommendedGifts: giftResult.data?.gifts || [],
          summary: {
            hasExistingEvents: (eventsResult.data?.events?.length || 0) > 0,
            restaurantCount: restaurantResult?.data?.restaurants?.length || 0,
            giftCount: giftResult.data?.gifts?.length || 0
          }
        },
        toolName: 'prepare_special_day'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare special day',
        toolName: 'prepare_special_day'
      };
    }
  }

  // ====================================================
  // 유틸리티
  // ====================================================

  /**
   * Google Places types를 사용자 친화적인 카테고리로 변환
   */
  private formatPlaceTypes(types: string[]): string {
    const typeMap: Record<string, string> = {
      'korean_restaurant': 'Korean',
      'japanese_restaurant': 'Japanese',
      'chinese_restaurant': 'Chinese',
      'italian_restaurant': 'Italian',
      'french_restaurant': 'French',
      'thai_restaurant': 'Thai',
      'vietnamese_restaurant': 'Vietnamese',
      'indian_restaurant': 'Indian',
      'mexican_restaurant': 'Mexican',
      'american_restaurant': 'American',
      'seafood_restaurant': 'Seafood',
      'steak_house': 'Steakhouse',
      'sushi_restaurant': 'Sushi',
      'ramen_restaurant': 'Ramen',
      'pizza_restaurant': 'Pizza',
      'hamburger_restaurant': 'Burger',
      'bbq_restaurant': 'BBQ',
      'vegetarian_restaurant': 'Vegetarian',
      'cafe': 'Cafe',
      'coffee_shop': 'Coffee',
      'bakery': 'Bakery',
      'bar': 'Bar',
      'pub': 'Pub',
      'restaurant': 'Restaurant',
      'food': 'Food',
      'meal_takeaway': 'Takeout',
      'meal_delivery': 'Delivery'
    };

    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }

    // Filter out generic types
    const filtered = types.filter(t =>
      !['point_of_interest', 'establishment', 'food'].includes(t)
    );

    if (filtered.length > 0) {
      // Convert snake_case to Title Case
      return filtered[0]
        .split('_')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    return 'Restaurant';
  }

  // ====================================================
  // 설정 관리
  // ====================================================

  /**
   * Calendar 토큰 설정
   */
  setCalendarTokens(tokens: { access_token: string; refresh_token?: string }) {
    this.calendarMCP.setCredentials(tokens);
    this.config.googleCalendar = {
      enabled: true,
      tokens
    };
  }

  /**
   * MCP 상태 확인
   */
  getStatus(): {
    calendar: boolean;
    maps: boolean;
    shopping: boolean;
  } {
    return {
      calendar: !!this.config.googleCalendar?.enabled,
      maps: !!process.env.GOOGLE_MAPS_API_KEY,
      shopping: !!process.env.NAVER_CLIENT_ID
    };
  }
}

// 사용자별 오케스트레이터 캐시
const orchestratorCache = new Map<string, MCPOrchestrator>();

export function getMCPOrchestrator(userId: string, config?: MCPConfig): MCPOrchestrator {
  if (!orchestratorCache.has(userId)) {
    orchestratorCache.set(userId, new MCPOrchestrator(userId, config));
  }
  return orchestratorCache.get(userId)!;
}
