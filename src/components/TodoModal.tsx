import React, { useState } from 'react';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore } from '../store/goalStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useToast } from './Toast';
import type { Todo } from '../types';

interface TodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTodo?: Todo | null;
  preselectedGoalId?: string;
}

export const TodoModal: React.FC<TodoModalProps> = ({
  isOpen,
  onClose,
  editingTodo,
  preselectedGoalId,
}) => {
  const { user } = useAuthStore();
  const { addTodo, updateTodo } = useTodoStore();
  const { goals } = useGoalStore();
  const { getCategoryById } = useCategoryStore();
  const { showToast } = useToast();

  const [title, setTitle] = useState(editingTodo?.title || '');
  const [description, setDescription] = useState(editingTodo?.description || '');
  const [dueDate, setDueDate] = useState(editingTodo?.due_date || '');
  const [dueTime, setDueTime] = useState(editingTodo?.due_time || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(editingTodo?.priority || 'medium');
  const [goalId, setGoalId] = useState(editingTodo?.goal_id || preselectedGoalId || '');
  const [isRecurring, setIsRecurring] = useState(editingTodo?.is_recurring || false);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>(
    editingTodo?.recurrence_pattern || 'daily'
  );
  const [isLoading, setIsLoading] = useState(false);

  const activeGoals = goals.filter((g) => g.is_active);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;

    setIsLoading(true);
    try {
      const todoData = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        due_time: dueTime || undefined,
        priority,
        goal_id: goalId || undefined,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
      };

      if (editingTodo?.id) {
        updateTodo(editingTodo.id, todoData);
        showToast('할 일이 수정되었습니다', 'success');
      } else {
        await addTodo(todoData);
        showToast('할 일이 추가되었습니다', 'success');
      }
      onClose();
    } catch (error) {
      console.error('Failed to save todo:', error);
      showToast('할 일 저장에 실패했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{editingTodo ? '할 일 수정' : '새 할 일'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">할 일 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="무엇을 해야 하나요?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">상세 설명</label>
            <textarea
              className="form-input"
              placeholder="추가 메모나 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">기한 날짜</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">기한 시간</label>
              <input
                type="time"
                className="form-input"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">우선순위</label>
            <div className="priority-select">
              <div
                className={`priority-option ${priority === 'high' ? 'selected high' : ''}`}
                onClick={() => setPriority('high')}
              >
                🔴 높음
              </div>
              <div
                className={`priority-option ${priority === 'medium' ? 'selected medium' : ''}`}
                onClick={() => setPriority('medium')}
              >
                🟡 보통
              </div>
              <div
                className={`priority-option ${priority === 'low' ? 'selected low' : ''}`}
                onClick={() => setPriority('low')}
              >
                🟢 낮음
              </div>
            </div>
          </div>

          {activeGoals.length > 0 && (
            <div className="form-group">
              <label className="form-label">연결된 목표</label>
              <select
                className="form-input"
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
              >
                <option value="">목표 선택 (선택사항)</option>
                {activeGoals.map((goal) => {
                  const category = goal.category_id ? getCategoryById(goal.category_id) : null;
                  return (
                    <option key={goal.id} value={goal.id}>
                      {category ? `[${category.name}] ` : ''}{goal.title}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                padding: '12px 0',
              }}
            >
              <div
                className={`todo-checkbox ${isRecurring ? 'checked' : ''}`}
                onClick={() => setIsRecurring(!isRecurring)}
              />
              <span>반복 할 일로 설정</span>
            </label>

            {isRecurring && (
              <div className="priority-select" style={{ marginTop: '8px' }}>
                <div
                  className={`priority-option ${recurrencePattern === 'daily' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('daily')}
                >
                  매일
                </div>
                <div
                  className={`priority-option ${recurrencePattern === 'weekly' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('weekly')}
                >
                  매주
                </div>
                <div
                  className={`priority-option ${recurrencePattern === 'monthly' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('monthly')}
                >
                  매월
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? '저장 중...' : editingTodo ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};
