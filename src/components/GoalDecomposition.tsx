import React, { useState } from 'react';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useCategoryStore } from '../store/categoryStore';
import type { Goal, Todo } from '../types';
import { useToast } from './Toast';

interface GoalDecompositionProps {
  goal: Goal;
  onClose: () => void;
}

interface DecomposedTodo {
  title: string;
  duration: number;
  order: number;
  isSelected: boolean;
}

const GoalDecomposition: React.FC<GoalDecompositionProps> = ({ goal, onClose }) => {
  const { showToast } = useToast();
  const { updateGoal } = useGoalStore();
  const { addTodo, getTodosByGoal } = useTodoStore();
  const { categories } = useCategoryStore();

  const [isLoading, setIsLoading] = useState(false);
  const [decomposedTodos, setDecomposedTodos] = useState<DecomposedTodo[]>([]);
  const [strategy, setStrategy] = useState('');
  const [activityType, setActivityType] = useState('Study');
  const [hasDecomposed, setHasDecomposed] = useState(false);

  // Existing Todos connected to Goal
  const existingTodos = goal.id ? getTodosByGoal(goal.id) : [];

  const activityTypes = [
    { value: 'Study', label: 'Study/Learning' },
    { value: 'Exercise', label: 'Exercise/Health' },
    { value: 'Project', label: 'Project' },
    { value: 'Certification', label: 'Cert/Exam' },
    { value: 'Other', label: 'Other' },
  ];

  const handleDecompose = async () => {
    if (!goal.target_date) {
      showToast('Please set a target date first', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('palm_auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `Break down this goal: ${goal.title}`,
          mode: 'goal',
          conversation_history: [],
        }),
      });

      if (!response.ok) {
        throw new Error('API call failed');
      }

      // Simple decomposition logic (processed on client instead of backend response for now)
      const strategies: Record<string, { steps: string[]; durations: number[] }> = {
        'Study': {
          steps: ['Concept Learning', 'Practice Problems', 'Review', 'Mock Test'],
          durations: [90, 60, 45, 60]
        },
        'Exercise': {
          steps: ['Warm-up', 'Main Workout', 'Cool-down', 'Stretching'],
          durations: [10, 40, 10, 15]
        },
        'Project': {
          steps: ['Planning & Design', 'Implementation', 'Testing', 'Review & Improvement'],
          durations: [60, 120, 60, 30]
        },
        'Certification': {
          steps: ['Theory Study', 'Past Exam Problems', 'Review Incorrect Answers', 'Mock Exam'],
          durations: [90, 60, 30, 60]
        },
        'Other': {
          steps: ['Preparation', 'Execution', 'Cleanup', 'Review'],
          durations: [30, 60, 20, 15]
        }
      };

      const selectedStrategy = strategies[activityType] || strategies['Other'];

      const todos = selectedStrategy.steps.map((step, index) => ({
        title: `${goal.title} - ${step}`,
        duration: selectedStrategy.durations[index],
        order: index + 1,
        isSelected: true,
      }));

      // D-day calculation
      const today = new Date();
      const target = new Date(goal.target_date);
      const daysUntilTarget = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let frequency = '';
      if (daysUntilTarget <= 7) {
        frequency = 'Daily';
      } else if (daysUntilTarget <= 30) {
        frequency = '3-4 times a week';
      } else {
        frequency = '2-3 times a week';
      }

      setDecomposedTodos(todos);
      setStrategy(`Recommended ${todos.length} steps ${frequency} for ${goal.title}. (${daysUntilTarget} days left)`);
      setHasDecomposed(true);
      showToast('Goal has been broken down into sub-tasks', 'success');
    } catch (error) {
      console.error('Failed to decompose goal:', error);
      showToast('Failed to decompose goal', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTodo = (index: number) => {
    setDecomposedTodos(prev =>
      prev.map((todo, i) =>
        i === index ? { ...todo, isSelected: !todo.isSelected } : todo
      )
    );
  };

  const handleCreateTodos = async () => {
    const selectedTodos = decomposedTodos.filter(t => t.isSelected);
    if (selectedTodos.length === 0) {
      showToast('Please select at least one task', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      for (const todo of selectedTodos) {
        await addTodo({
          user_id: goal.user_id,
          goal_id: goal.id,
          title: todo.title,
          description: `Sub-task for goal: ${goal.title}`,
          priority: goal.priority,
          is_recurring: false,
          is_hard_deadline: false,
          is_divisible: true,
          completed_time: 0,
          estimated_time: todo.duration,
        });
      }
      showToast(`${selectedTodos.length} tasks created`, 'success');
      onClose();
    } catch (error) {
      console.error('Failed to create todos:', error);
      showToast('Failed to create tasks', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FECA57';
      case 'low': return '#1DD1A1';
      default: return '#9CA3AF';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Break Down Goal</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Goal Info */}
          <div className="goal-decompose-header">
            <h3>{goal.title}</h3>
            {goal.description && <p className="goal-description">{goal.description}</p>}
            <div className="goal-meta">
              <span
                className="goal-priority-badge"
                style={{ backgroundColor: getPriorityColor(goal.priority) }}
              >
                {goal.priority === 'high' ? 'High' : goal.priority === 'medium' ? 'Medium' : 'Low'}
              </span>
              {goal.target_date && (
                <span className="goal-target-date">
                  Target: {new Date(goal.target_date).toLocaleDateString()}
                </span>
              )}
              <span className="goal-progress-badge">
                Progress: {calculateGoalProgress(goal)}%
              </span>
            </div>
          </div>

          {/* Existing Connected Todos */}
          {existingTodos.length > 0 && (
            <div className="goal-existing-todos">
              <h4>Linked Tasks ({existingTodos.length})</h4>
              <div className="existing-todo-list">
                {existingTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`existing-todo-item ${todo.is_completed ? 'completed' : ''}`}
                  >
                    <span className={`todo-status ${todo.is_completed ? 'done' : ''}`}>
                      {todo.is_completed ? '✓' : '○'}
                    </span>
                    <span className="todo-title">{todo.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Type Selection */}
          {!hasDecomposed && (
            <div className="goal-decompose-options">
              <h4>Select Activity Type</h4>
              <div className="activity-type-selector">
                {activityTypes.map((type) => (
                  <button
                    key={type.value}
                    className={`activity-type-btn ${activityType === type.value ? 'active' : ''}`}
                    onClick={() => setActivityType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Decomposition Result */}
          {hasDecomposed && (
            <div className="goal-decompose-result">
              <div className="decompose-strategy">
                <span className="strategy-icon">💡</span>
                <p>{strategy}</p>
              </div>

              <h4>Sub-tasks to Create</h4>
              <div className="decomposed-todo-list">
                {decomposedTodos.map((todo, index) => (
                  <div
                    key={index}
                    className={`decomposed-todo-item ${todo.isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleTodo(index)}
                  >
                    <div className="todo-checkbox-wrapper">
                      <div className={`todo-checkbox ${todo.isSelected ? 'checked' : ''}`} />
                    </div>
                    <div className="todo-content">
                      <span className="todo-order">{todo.order}.</span>
                      <span className="todo-title">{todo.title}</span>
                    </div>
                    <span className="todo-duration">{formatDuration(todo.duration)}</span>
                  </div>
                ))}
              </div>

              <div className="decompose-summary">
                <span>Selected: {decomposedTodos.filter(t => t.isSelected).length}</span>
                <span>Total Time: {formatDuration(
                  decomposedTodos.filter(t => t.isSelected).reduce((sum, t) => sum + t.duration, 0)
                )}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!hasDecomposed ? (
            <button
              className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
              onClick={handleDecompose}
              disabled={isLoading || !goal.target_date}
            >
              {isLoading ? 'Breaking down...' : 'Break Down Goal'}
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setHasDecomposed(false)}
              >
                Reset
              </button>
              <button
                className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                onClick={handleCreateTodos}
                disabled={isLoading || decomposedTodos.filter(t => t.isSelected).length === 0}
              >
                {isLoading ? 'Creating...' : 'Create Tasks'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalDecomposition;
