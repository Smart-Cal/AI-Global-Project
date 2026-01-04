import React, { useState } from 'react';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore } from '../store/goalStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useToast } from './Toast';
import type { Todo, Goal } from '../types';

interface TodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTodo?: Todo | null;
  preselectedGoalId?: string;
}

// Check if goal is active
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
}

// Extract date and time from deadline
function getDeadlineDate(deadline?: string): string {
  if (!deadline) return '';
  return deadline.split('T')[0];
}

function getDeadlineTime(deadline?: string): string {
  if (!deadline) return '';
  const timePart = deadline.split('T')[1];
  return timePart ? timePart.slice(0, 5) : '';
}

// Combine date and time into deadline format
function combineDeadline(date?: string, time?: string): string | undefined {
  if (!date) return undefined;
  const timeStr = time || '23:59';
  return `${date}T${timeStr}:00`;
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
  const [dueDate, setDueDate] = useState(getDeadlineDate(editingTodo?.deadline));
  const [dueTime, setDueTime] = useState(getDeadlineTime(editingTodo?.deadline));
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(editingTodo?.priority || 'medium');
  const [goalId, setGoalId] = useState(editingTodo?.goal_id || preselectedGoalId || '');
  const [isRecurring, setIsRecurring] = useState(editingTodo?.is_recurring || false);
  const [recurrencePattern, setRecurrencePattern] = useState<'daily' | 'weekly' | 'monthly'>(
    (editingTodo?.recurrence_pattern as 'daily' | 'weekly' | 'monthly') || 'daily'
  );
  const [estimatedTime, setEstimatedTime] = useState(editingTodo?.estimated_time || 60);
  const [isLoading, setIsLoading] = useState(false);

  const activeGoals = goals.filter(isGoalActive);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;

    setIsLoading(true);
    try {
      const todoData = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: combineDeadline(dueDate, dueTime),
        is_hard_deadline: false,
        estimated_time: estimatedTime,
        completed_time: editingTodo?.completed_time || 0,
        is_divisible: true,
        priority,
        goal_id: goalId || undefined,
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : undefined,
      };

      if (editingTodo?.id) {
        updateTodo(editingTodo.id, todoData);
        showToast('Todo updated', 'success');
      } else {
        await addTodo(todoData);
        showToast('Todo added', 'success');
      }
      onClose();
    } catch (error) {
      console.error('Failed to save todo:', error);
      showToast('Failed to save todo', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{editingTodo ? 'Edit Todo' : 'New Todo'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Todo *</label>
            <input
              type="text"
              className="form-input"
              placeholder="What do you need to do?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              placeholder="Add notes or details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Due Time</label>
              <input
                type="time"
                className="form-input"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Estimated Time (minutes)</label>
            <input
              type="number"
              className="form-input"
              min="1"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(parseInt(e.target.value) || 60)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Priority</label>
            <div className="priority-select">
              <div
                className={`priority-option ${priority === 'high' ? 'selected high' : ''}`}
                onClick={() => setPriority('high')}
              >
                🔴 High
              </div>
              <div
                className={`priority-option ${priority === 'medium' ? 'selected medium' : ''}`}
                onClick={() => setPriority('medium')}
              >
                🟡 Medium
              </div>
              <div
                className={`priority-option ${priority === 'low' ? 'selected low' : ''}`}
                onClick={() => setPriority('low')}
              >
                🟢 Low
              </div>
            </div>
          </div>

          {activeGoals.length > 0 && (
            <div className="form-group">
              <label className="form-label">Linked Goal</label>
              <select
                className="form-input"
                value={goalId}
                onChange={(e) => setGoalId(e.target.value)}
              >
                <option value="">Select goal (optional)</option>
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
              <span>Set as recurring</span>
            </label>

            {isRecurring && (
              <div className="priority-select" style={{ marginTop: '8px' }}>
                <div
                  className={`priority-option ${recurrencePattern === 'daily' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('daily')}
                >
                  Daily
                </div>
                <div
                  className={`priority-option ${recurrencePattern === 'weekly' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('weekly')}
                >
                  Weekly
                </div>
                <div
                  className={`priority-option ${recurrencePattern === 'monthly' ? 'selected medium' : ''}`}
                  onClick={() => setRecurrencePattern('monthly')}
                >
                  Monthly
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
          >
            {editingTodo ? 'Save' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  );
};
