/**
 * Tool System Entry Point
 *
 * MCP-style 도구 시스템 초기화 및 내보내기
 */

export * from './toolRegistry.js';
export { registerInternalTools } from './internalTools.js';

import { registerInternalTools } from './internalTools.js';
import { toolRegistry } from './toolRegistry.js';

let initialized = false;

/**
 * 도구 시스템 초기화
 * 서버 시작 시 한 번만 호출
 */
export function initializeTools(): void {
  if (initialized) {
    console.log('[Tools] Already initialized, skipping...');
    return;
  }

  console.log('[Tools] Initializing tool system...');

  // 내부 도구 등록
  registerInternalTools();

  // TODO: 외부 도구 등록 (Phase 3에서 추가)
  // registerExternalTools();

  initialized = true;

  const tools = toolRegistry.getAllToolDefinitions();
  console.log(`[Tools] Initialized with ${tools.length} tools:`);

  // 카테고리별 도구 수 출력
  const internal = toolRegistry.getToolsByCategory('internal');
  const external = toolRegistry.getToolsByCategory('external');
  const integration = toolRegistry.getToolsByCategory('integration');

  console.log(`  - Internal: ${internal.length}`);
  console.log(`  - External: ${external.length}`);
  console.log(`  - Integration: ${integration.length}`);

  // 위험도별 도구 수 출력
  const low = toolRegistry.getToolsByRiskLevel('low');
  const medium = toolRegistry.getToolsByRiskLevel('medium');
  const high = toolRegistry.getToolsByRiskLevel('high');

  console.log(`  Risk levels: low=${low.length}, medium=${medium.length}, high=${high.length}`);
}

/**
 * 도구 실행 편의 함수
 */
export async function executeTool(
  toolName: string,
  input: any,
  userId: string,
  conversationId?: string,
  chronotype?: 'morning' | 'evening' | 'neutral'
) {
  return toolRegistry.execute(toolName, input, {
    userId,
    conversationId,
    chronotype,
  });
}
