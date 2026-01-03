/**
 * MCP-style Tool Registry System
 *
 * 위험도 기반 실행과 외부 서비스 연동을 지원하는 도구 레지스트리
 */

import { createToolExecution, updateToolExecutionStatus, getExternalServiceConfig } from '../services/database.js';

// 위험도 레벨
export type RiskLevel = 'low' | 'medium' | 'high';

// 도구 카테고리
export type ToolCategory = 'internal' | 'external' | 'integration';

// 도구 실행 상태
export type ExecutionStatus = 'pending' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'cancelled' | 'expired';

// 도구 메타데이터
export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  riskLevel: RiskLevel;
  requiresConfirmation: boolean;
  externalService?: string; // 외부 서비스 연동 시 서비스 이름
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
      required?: boolean;
    }>;
    required: string[];
  };
}

// 도구 실행 결과
export interface ToolExecutionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  preview?: any; // 확인 전 미리보기 데이터
  requiresConfirmation?: boolean;
  executionId?: string;
}

// 도구 핸들러 타입
export type ToolHandler<TInput = any, TOutput = any> = (
  input: TInput,
  context: ToolExecutionContext
) => Promise<ToolExecutionResult<TOutput>>;

// 도구 실행 컨텍스트
export interface ToolExecutionContext {
  userId: string;
  conversationId?: string;
  chronotype?: 'morning' | 'evening' | 'neutral';
  skipConfirmation?: boolean; // 관리자나 테스트용
}

// 등록된 도구
interface RegisteredTool {
  metadata: ToolMetadata;
  handler: ToolHandler;
  previewHandler?: ToolHandler; // 미리보기용 핸들러 (선택적)
}

/**
 * Tool Registry - 모든 도구를 관리하는 중앙 레지스트리
 */
class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * 도구 등록
   */
  register(metadata: ToolMetadata, handler: ToolHandler, previewHandler?: ToolHandler): void {
    this.tools.set(metadata.name, {
      metadata,
      handler,
      previewHandler,
    });
    console.log(`[ToolRegistry] Registered tool: ${metadata.name} (${metadata.category}, risk: ${metadata.riskLevel})`);
  }

  /**
   * 도구 조회
   */
  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * 모든 도구 메타데이터 조회
   */
  getAllToolDefinitions(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(t => t.metadata);
  }

  /**
   * OpenAI Function Calling 형식으로 변환
   */
  toOpenAITools(): { type: 'function'; function: any }[] {
    return Array.from(this.tools.values()).map(t => ({
      type: 'function' as const,
      function: {
        name: t.metadata.name,
        description: t.metadata.description,
        parameters: t.metadata.parameters,
      },
    }));
  }

  /**
   * 카테고리별 도구 조회
   */
  getToolsByCategory(category: ToolCategory): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(t => t.metadata.category === category);
  }

  /**
   * 위험도별 도구 조회
   */
  getToolsByRiskLevel(riskLevel: RiskLevel): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(t => t.metadata.riskLevel === riskLevel);
  }

  /**
   * 도구 실행 (위험도 기반 확인 포함)
   */
  async execute(
    toolName: string,
    input: any,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}`,
      };
    }

    const { metadata, handler, previewHandler } = tool;

    // 외부 서비스 도구인 경우 설정 확인
    if (metadata.category === 'external' && metadata.externalService) {
      try {
        const serviceConfig = await getExternalServiceConfig(context.userId, metadata.externalService);
        if (!serviceConfig || !serviceConfig.is_enabled) {
          return {
            success: false,
            error: `External service '${metadata.externalService}' is not configured or disabled.`,
          };
        }
      } catch (error) {
        console.error(`[ToolRegistry] Error checking external service:`, error);
        // 서비스 확인 실패해도 계속 진행 (내부 도구도 이 경로를 탈 수 있음)
      }
    }

    // 확인이 필요한 경우
    if (metadata.requiresConfirmation && !context.skipConfirmation) {
      // 미리보기 생성
      let preview = null;
      if (previewHandler) {
        const previewResult = await previewHandler(input, context);
        preview = previewResult.data;
      }

      // 실행 기록 생성 (pending 상태)
      try {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 5); // 5분 후 만료

        const executionId = await createToolExecution({
          user_id: context.userId,
          conversation_id: context.conversationId,
          tool_name: toolName,
          tool_category: metadata.category,
          risk_level: metadata.riskLevel,
          input_params: input,
          preview_data: preview,
          requires_confirmation: true,
          expires_at: expiresAt.toISOString(),
        });

        return {
          success: true,
          requiresConfirmation: true,
          executionId,
          preview,
        };
      } catch (error) {
        console.error(`[ToolRegistry] Error creating tool execution:`, error);
        // DB 오류 시에도 계속 실행
      }
    }

    // 바로 실행
    try {
      const result = await handler(input, context);

      // 실행 기록 업데이트 (성공)
      if (result.success) {
        // 여기서 action_log에 기록할 수 있음
      }

      return result;
    } catch (error) {
      console.error(`[ToolRegistry] Tool execution error:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * 확인된 실행 처리
   */
  async executeConfirmed(
    executionId: string,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    // TODO: DB에서 실행 정보 조회 후 처리
    // 현재는 기본 구현
    return {
      success: false,
      error: 'Confirmed execution not yet implemented',
    };
  }
}

// 싱글톤 인스턴스
export const toolRegistry = new ToolRegistry();

/**
 * 도구 등록 헬퍼 함수
 */
export function registerTool(
  metadata: ToolMetadata,
  handler: ToolHandler,
  previewHandler?: ToolHandler
): void {
  toolRegistry.register(metadata, handler, previewHandler);
}

/**
 * 위험도에 따른 확인 필요 여부 판단
 */
export function shouldRequireConfirmation(riskLevel: RiskLevel): boolean {
  switch (riskLevel) {
    case 'low':
      return false; // 즉시 실행
    case 'medium':
      return true; // 인라인 확인
    case 'high':
      return true; // 모달 확인 (UI에서 구분)
    default:
      return true;
  }
}

/**
 * 위험도 설명
 */
export function getRiskLevelDescription(riskLevel: RiskLevel): string {
  switch (riskLevel) {
    case 'low':
      return '읽기 전용 또는 복구 가능한 작업';
    case 'medium':
      return '데이터 생성/수정 작업';
    case 'high':
      return '외부 서비스 연동 또는 삭제 작업';
    default:
      return '알 수 없음';
  }
}
