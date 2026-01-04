// AI Agent Layer Exports
export { parseUserInput, classifyEventType, parseTimeExpression } from './parserAgent.js';
export {
  scheduleTodos,
  calculateAvailableSlots,
  checkConflicts,
  findBestSlotForTodo,
  calculateChronotypeScore,
  scoreTimeSlot,
  scheduleWithAI
} from './schedulerAgent.js';
export { createPlan, decomposeGoal, createStudyPlan } from './plannerAgent.js';
export { MainOrchestrator, createOrchestrator } from './orchestrator.js';

// New Agent Loop (with Function Calling + Router → Specialized Agent Pattern)
export { AgentLoop, createAgentLoop } from './agentLoop.js';

// MCP-Enhanced Agent Loop ("말하는 AI" → "행동하는 AI")
export { MCPAgentLoop, createMCPAgentLoop } from './mcpAgentLoop.js';

// Router Agent - 의도 파악 전문
export { routeIntent, type RouterResult, type IntentType } from './routerAgent.js';

// Specialized Agents - 각 의도별 처리 전문
export {
  processEvent,
  processGoal,
  processTodo,
  processBriefing,
  processGeneral
} from './specializedAgents.js';

// Shopping Agent - MCP 패턴 기반 상품 추천 에이전트
export {
  ShoppingAgent,
  processShopping,
  getDefaultProductCatalog,
  type UserProfile,
  type ShoppingContext,
  type Product,
  type ProductCatalog,
  type RankedProduct,
  type ShoppingAgentOutput,
  type ShoppingIntent,
  type RecommendationRules
} from './shoppingAgent.js';
export {
  calendarToolDefinitions,
  executeCalendarTool,
  getEvents,
  checkConflicts as checkEventConflicts,
  findFreeSlots,
  getGoals,
  suggestScheduleForGoal
} from './tools/calendarTools.js';

// PALM Tools (Goal 분해, Chronotype, Briefing)
export {
  palmToolDefinitions,
  executePalmTool,
  decomposeGoalToTodos,
  scheduleWithChronotype,
  generateBriefing,
  generateWeeklyReview,
  getOptimalTimeForActivity,
  type Chronotype as LegacyChronotype
} from './tools/palmTools.js';

// MCP (Model Context Protocol) Integration
export {
  GoogleCalendarMCP,
  GoogleMapsMCP,
  ShoppingMCP,
  MCPOrchestrator,
  getMCPOrchestrator,
  mcpToolDefinitions
} from '../mcp/index.js';
