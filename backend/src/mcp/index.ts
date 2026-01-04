/**
 * MCP (Model Context Protocol) Integration Layer
 *
 * "말하는 AI"에서 "행동하는 AI"로 전환하기 위한 MCP 서버 통합 레이어
 *
 * 지원하는 MCP 서버:
 * 1. Google Calendar MCP - 일정 관리, Free/Busy 조회
 * 2. Google Maps MCP - 장소 검색, 거리 계산
 * 3. Shopping MCP - 상품 검색, 가격 비교
 * 4. News MCP - 뉴스 조회, 브리핑 생성
 */

export { GoogleCalendarMCP, getGoogleCalendarMCP, type CalendarEvent as GCalEvent, type FreeBusyResult } from './googleCalendar.js';
export { GoogleMapsMCP, getGoogleMapsMCP, type PlaceSearchResult, type PlaceDetails, type DistanceResult } from './googleMaps.js';
export { ShoppingMCP, getShoppingMCP, type ProductSearchResult, type ProductDetails } from './shopping.js';
export { NewsMCP, getNewsMCP, type NewsArticle, type NewsBriefing } from './news.js';
export { MCPOrchestrator, getMCPOrchestrator, type MCPToolCall, type MCPToolResult, type MCPConfig } from './orchestrator.js';

// Multi-Provider Shopping System
export { ShoppingMultiProvider, getShoppingMultiProvider, resetShoppingMultiProvider } from './shoppingMultiProvider.js';
export * from './providers/index.js';

// MCP 도구 정의 (OpenAI Function Calling용)
export { mcpToolDefinitions } from './toolDefinitions.js';
