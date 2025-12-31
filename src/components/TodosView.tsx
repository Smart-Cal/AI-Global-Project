import React, { useState } from 'react';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore } from '../store/goalStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import type { Todo } from '../types';

interface TodosViewProps {
  onAddTodo: () => void;
}

export const TodosView: React.FC<TodosViewProps> = ({ onAddTodo }) => {
  const { user } = useAuthStore();
  const {
    todos,
    toggleComplete,
    deleteTodo,
    getTodayTodos,
    getUpcomingTodos,
    getOverdueTodos,
    getCompletedTodos,
    getPendingTodos,
  } = useTodoStore();
  const { goals } = useGoalStore();
  const { getCategoryById } = useCategoryStore();

  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [newTodoTitle, setNewTodoTitle] = useState('');

  const getFilteredTodos = () => {
    switch (filter) {
      case 'today':
        return getTodayTodos();
      case 'upcoming':
        return getUpcomingTodos(7);
      case 'overdue':
        return getOverdueTodos();
      case 'completed':
        return getCompletedTodos();
      default:
        return getPendingTodos();
    }
  };

  const filteredTodos = getFilteredTodos();
  const overdueTodos = getOverdueTodos();
  const todayTodos = getTodayTodos();

  const handleQuickAdd = async () => {
    if (!newTodoTitle.trim() || !user) return;

    await useTodoStore.getState().addTodo({
      user_id: user.id,
      title: newTodoTitle.trim(),
      priority: 'medium',
      is_recurring: false,
    });
    setNewTodoTitle('');
  };

  const handleDelete = (todoId: string) => {
    if (confirm('이 할 일을 삭제하시겠습니까?')) {
      deleteTodo(todoId);
    }
  };

  const filters = [
    { id: 'all', label: '전체', count: getPendingTodos().length },
    { id: 'today', label: '오늘', count: todayTodos.length },
    { id: 'upcoming', label: '예정', count: getUpcomingTodos(7).length },
    { id: 'overdue', label: '지연', count: overdueTodos.length },
    { id: 'completed', label: '완료', count: getCompletedTodos().length },
  ];

  return (
    <div className="goals-container">
      <div className="goals-header">
        <h1 className="goals-title">할 일</h1>
        <button className="btn btn-primary" onClick={onAddTodo}>
          + 새 할 일
        </button>
      </div>

      {/* Quick Add */}
      <div
        className="add-todo-input"
        style={{
          background: 'var(--bg-sidebar)',
          borderRadius: 'var(--border-radius)',
          marginBottom: '20px',
        }}
      >
        <span style={{ fontSize: '18px', color: 'var(--text-muted)' }}>+</span>
        <input
          type="text"
          placeholder="할 일 추가..."
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleQuickAdd();
            }
          }}
        />
        {newTodoTitle && (
          <button className="btn btn-primary btn-sm" onClick={handleQuickAdd}>
            추가
          </button>
        )}
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          overflowX: 'auto',
          paddingBottom: '8px',
        }}
      >
        {filters.map((f) => (
          <button
            key={f.id}
            className={`btn ${filter === f.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setFilter(f.id as typeof filter)}
            style={{
              whiteSpace: 'nowrap',
              ...(f.id === 'overdue' && f.count > 0 && filter !== 'overdue'
                ? { borderColor: '#E03E3E', color: '#E03E3E' }
                : {}),
            }}
          >
            {f.label}
            {f.count > 0 && ` (${f.count})`}
          </button>
        ))}
      </div>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            {filter === 'completed' ? '🎉' : '✅'}
          </div>
          <div className="empty-state-title">
            {filter === 'completed'
              ? '완료된 할 일이 없어요'
              : filter === 'overdue'
              ? '지연된 할 일이 없어요!'
              : '할 일이 없어요'}
          </div>
          <div className="empty-state-text">
            {filter !== 'completed' && filter !== 'overdue' && '새 할 일을 추가해보세요'}
          </div>
        </div>
      ) : (
        <div className="todo-list" style={{ background: 'var(--bg-main)', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-light)' }}>
          {filteredTodos.map((todo) => {
            const goal = todo.goal_id ? goals.find((g) => g.id === todo.goal_id) : null;
            const goalCategory = goal?.category_id ? getCategoryById(goal.category_id) : null;
            const isOverdue = todo.due_date && todo.due_date < new Date().toISOString().split('T')[0] && !todo.is_completed;

            return (
              <div
                key={todo.id}
                className={`todo-item ${todo.is_completed ? 'completed' : ''}`}
              >
                <div
                  className={`todo-checkbox ${todo.is_completed ? 'checked' : ''}`}
                  onClick={() => toggleComplete(todo.id!)}
                />
                <div className="todo-content">
                  <div className="todo-title">{todo.title}</div>
                  <div className="todo-meta">
                    <span className={`todo-priority ${todo.priority}`} />
                    {todo.due_date && (
                      <span style={{ color: isOverdue ? '#E03E3E' : 'inherit' }}>
                        {isOverdue ? '기한 초과: ' : ''}
                        {todo.due_date}
                        {todo.due_time && ` ${todo.due_time}`}
                      </span>
                    )}
                    {goal && (
                      <span
                        className="todo-goal-tag"
                        style={{
                          backgroundColor: (goalCategory?.color || '#9CA3AF') + '20',
                          color: goalCategory?.color || '#9CA3AF',
                        }}
                      >
                        {goal.title}
                      </span>
                    )}
                    {todo.is_recurring && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        🔄 {todo.recurrence_pattern === 'daily' ? '매일' : todo.recurrence_pattern === 'weekly' ? '매주' : '매월'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => handleDelete(todo.id!)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Section */}
      {filter === 'all' && getCompletedTodos().length > 0 && (
        <div className="todo-section" style={{ marginTop: '24px' }}>
          <div className="todo-section-header">
            <div className="todo-section-title">
              <span>✅</span>
              <span>완료됨</span>
              <span className="todo-count">{getCompletedTodos().length}</span>
            </div>
          </div>
          <div className="todo-list" style={{ background: 'var(--bg-main)', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-light)', opacity: 0.7 }}>
            {getCompletedTodos().slice(0, 5).map((todo) => (
              <div
                key={todo.id}
                className="todo-item completed"
              >
                <div
                  className="todo-checkbox checked"
                  onClick={() => toggleComplete(todo.id!)}
                />
                <div className="todo-content">
                  <div className="todo-title">{todo.title}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
