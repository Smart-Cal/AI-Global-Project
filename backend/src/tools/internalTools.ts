/**
 * Internal Tools Registration
 *
 * 기존 Calendar/PALM 도구를 새 레지스트리 시스템에 등록
 */

import { registerTool, ToolExecutionContext, ToolExecutionResult } from './toolRegistry.js';
import {
  getEventsByUser,
  createEvent,
  updateEvent,
  deleteEvent,
  getTodosByUser,
  createTodo,
  updateTodo,
  deleteTodo,
  getGoalsByUser,
  createGoal,
  updateGoal,
  deleteGoal,
} from '../services/database.js';
import {
  decomposeGoalToTodos,
  scheduleWithChronotype,
  generateBriefing,
  generateWeeklyReview,
} from '../agents/tools/palmTools.js';

/**
 * Internal Tools 등록
 */
export function registerInternalTools(): void {
  // ==========================================
  // Calendar Tools (위험도: low - 조회)
  // ==========================================

  registerTool(
    {
      name: 'get_events',
      description: '사용자의 일정을 조회합니다. 날짜 범위를 지정할 수 있습니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          start_date: {
            type: 'string',
            description: '시작 날짜 (YYYY-MM-DD)',
          },
          end_date: {
            type: 'string',
            description: '종료 날짜 (YYYY-MM-DD)',
          },
        },
        required: [],
      },
    },
    async (input, context) => {
      try {
        const events = await getEventsByUser(context.userId, input.start_date, input.end_date);
        return { success: true, data: { events } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get events' };
      }
    }
  );

  registerTool(
    {
      name: 'get_todos',
      description: '사용자의 할 일 목록을 조회합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    async (input, context) => {
      try {
        const todos = await getTodosByUser(context.userId);
        return { success: true, data: { todos } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get todos' };
      }
    }
  );

  registerTool(
    {
      name: 'get_goals',
      description: '사용자의 목표 목록을 조회합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    async (input, context) => {
      try {
        const goals = await getGoalsByUser(context.userId);
        return { success: true, data: { goals } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get goals' };
      }
    }
  );

  // ==========================================
  // Calendar Tools (위험도: medium - 생성/수정)
  // ==========================================

  registerTool(
    {
      name: 'create_event',
      description: '새 일정을 생성합니다.',
      category: 'internal',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '일정 제목' },
          event_date: { type: 'string', description: '일정 날짜 (YYYY-MM-DD)' },
          start_time: { type: 'string', description: '시작 시간 (HH:MM)' },
          end_time: { type: 'string', description: '종료 시간 (HH:MM)' },
          location: { type: 'string', description: '장소' },
          description: { type: 'string', description: '설명' },
          is_all_day: { type: 'boolean', description: '종일 일정 여부' },
          is_fixed: { type: 'boolean', description: '고정 일정 여부' },
          priority: { type: 'number', description: '우선순위 (1-5)' },
        },
        required: ['title', 'event_date'],
      },
    },
    async (input, context) => {
      try {
        const event = await createEvent({
          user_id: context.userId,
          title: input.title,
          event_date: input.event_date,
          start_time: input.start_time,
          end_time: input.end_time,
          location: input.location,
          description: input.description,
          is_all_day: input.is_all_day ?? false,
          is_fixed: input.is_fixed ?? true,
          priority: input.priority ?? 3,
          is_completed: false,
        });
        return { success: true, data: { event, message: `"${event.title}" 일정이 생성되었습니다.` } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create event' };
      }
    },
    // Preview handler
    async (input, context) => {
      return {
        success: true,
        data: {
          action: 'create_event',
          preview: {
            title: input.title,
            date: input.event_date,
            time: input.start_time ? `${input.start_time} - ${input.end_time || ''}` : '종일',
            location: input.location,
          },
        },
      };
    }
  );

  registerTool(
    {
      name: 'create_todo',
      description: '새 할 일을 생성합니다.',
      category: 'internal',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '할 일 제목' },
          description: { type: 'string', description: '설명' },
          deadline: { type: 'string', description: '마감일 (ISO datetime)' },
          estimated_time: { type: 'number', description: '예상 시간 (분)' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '우선순위' },
          goal_id: { type: 'string', description: '연결된 목표 ID' },
        },
        required: ['title'],
      },
    },
    async (input, context) => {
      try {
        const todo = await createTodo({
          user_id: context.userId,
          title: input.title,
          description: input.description,
          deadline: input.deadline,
          estimated_time: input.estimated_time ?? 60,
          priority: input.priority ?? 'medium',
          goal_id: input.goal_id,
          is_completed: false,
          completed_time: 0,
          is_divisible: true,
          is_hard_deadline: false,
        });
        return { success: true, data: { todo, message: `"${todo.title}" 할 일이 생성되었습니다.` } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create todo' };
      }
    },
    async (input, context) => {
      return {
        success: true,
        data: {
          action: 'create_todo',
          preview: {
            title: input.title,
            priority: input.priority || 'medium',
            deadline: input.deadline || '없음',
          },
        },
      };
    }
  );

  registerTool(
    {
      name: 'create_goal',
      description: '새 목표를 생성합니다.',
      category: 'internal',
      riskLevel: 'medium',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '목표 제목' },
          description: { type: 'string', description: '목표 설명' },
          target_date: { type: 'string', description: '목표 달성일 (YYYY-MM-DD)' },
          priority: { type: 'string', enum: ['high', 'medium', 'low'], description: '우선순위' },
          category_id: { type: 'string', description: '카테고리 ID' },
        },
        required: ['title', 'target_date'],
      },
    },
    async (input, context) => {
      try {
        const goal = await createGoal({
          user_id: context.userId,
          title: input.title,
          description: input.description,
          target_date: input.target_date,
          priority: input.priority ?? 'medium',
          category_id: input.category_id,
        });
        return { success: true, data: { goal, message: `"${goal.title}" 목표가 생성되었습니다.` } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to create goal' };
      }
    },
    async (input, context) => {
      return {
        success: true,
        data: {
          action: 'create_goal',
          preview: {
            title: input.title,
            target_date: input.target_date,
            priority: input.priority || 'medium',
          },
        },
      };
    }
  );

  // ==========================================
  // Calendar Tools (위험도: high - 삭제)
  // ==========================================

  registerTool(
    {
      name: 'delete_event',
      description: '일정을 삭제합니다.',
      category: 'internal',
      riskLevel: 'high',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string', description: '삭제할 일정 ID' },
        },
        required: ['event_id'],
      },
    },
    async (input, context) => {
      try {
        await deleteEvent(input.event_id);
        return { success: true, data: { message: '일정이 삭제되었습니다.' } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete event' };
      }
    }
  );

  registerTool(
    {
      name: 'delete_todo',
      description: '할 일을 삭제합니다.',
      category: 'internal',
      riskLevel: 'high',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          todo_id: { type: 'string', description: '삭제할 할 일 ID' },
        },
        required: ['todo_id'],
      },
    },
    async (input, context) => {
      try {
        await deleteTodo(input.todo_id);
        return { success: true, data: { message: '할 일이 삭제되었습니다.' } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete todo' };
      }
    }
  );

  registerTool(
    {
      name: 'delete_goal',
      description: '목표를 삭제합니다.',
      category: 'internal',
      riskLevel: 'high',
      requiresConfirmation: true,
      parameters: {
        type: 'object',
        properties: {
          goal_id: { type: 'string', description: '삭제할 목표 ID' },
        },
        required: ['goal_id'],
      },
    },
    async (input, context) => {
      try {
        await deleteGoal(input.goal_id);
        return { success: true, data: { message: '목표가 삭제되었습니다.' } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete goal' };
      }
    }
  );

  // ==========================================
  // PALM Tools (위험도: low - 조회/분석)
  // ==========================================

  registerTool(
    {
      name: 'decompose_goal',
      description: '장기 목표를 세부 작업(Todo)으로 분해합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          goal_title: { type: 'string', description: '목표 제목' },
          goal_description: { type: 'string', description: '목표 설명' },
          target_date: { type: 'string', description: '목표 달성 예정일 (YYYY-MM-DD)' },
          activity_type: { type: 'string', description: '활동 유형 (공부, 운동, 프로젝트 등)' },
        },
        required: ['goal_title', 'target_date', 'activity_type'],
      },
    },
    async (input, context) => {
      try {
        const result = await decomposeGoalToTodos(
          context.userId,
          input.goal_title,
          input.goal_description || '',
          input.target_date,
          input.activity_type
        );
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to decompose goal' };
      }
    }
  );

  registerTool(
    {
      name: 'smart_schedule',
      description: 'Chronotype을 고려하여 최적의 시간대에 활동을 스케줄링합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          activity_type: { type: 'string', description: '활동 유형 (운동, 공부, 독서 등)' },
          days_ahead: { type: 'number', description: '추천할 기간 (일 수, 기본값 7)' },
        },
        required: ['activity_type'],
      },
    },
    async (input, context) => {
      try {
        const result = await scheduleWithChronotype(
          context.userId,
          input.activity_type,
          context.chronotype || 'neutral',
          input.days_ahead || 7
        );
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to smart schedule' };
      }
    }
  );

  registerTool(
    {
      name: 'get_briefing',
      description: '아침 또는 저녁 브리핑을 생성합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['morning', 'evening'], description: '브리핑 유형' },
        },
        required: ['type'],
      },
    },
    async (input, context) => {
      try {
        const result = await generateBriefing(context.userId, input.type);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get briefing' };
      }
    }
  );

  registerTool(
    {
      name: 'get_weekly_review',
      description: '지난 주의 활동을 리뷰하고 요약합니다.',
      category: 'internal',
      riskLevel: 'low',
      requiresConfirmation: false,
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    async (input, context) => {
      try {
        const result = await generateWeeklyReview(context.userId);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get weekly review' };
      }
    }
  );

  console.log('[InternalTools] All internal tools registered');
}
