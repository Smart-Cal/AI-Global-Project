import React, { useState } from 'react';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore } from '../store/goalStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { useToast } from './Toast';
import type { Todo } from '../types';

interface TodosViewProps {
  onAddTodo: () => void;
}

// Extract date and time from deadline
function getDeadlineDate(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  return deadline.split('T')[0];
}

function getDeadlineTime(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  const timePart = deadline.split('T')[1];
  return timePart ? timePart.slice(0, 5) : undefined;
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
  const { categories, getCategoryById, deleteCategory } = useCategoryStore();
  const { showToast } = useToast();

  const [filter, setFilter] = useState<'all' | 'today' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

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
      is_hard_deadline: false,
      is_divisible: true,
      completed_time: 0,
    });
    setNewTodoTitle('');
  };

  const handleDelete = (todoId: string) => {
    if (confirm('Are you sure you want to delete this todo?')) {
      deleteTodo(todoId);
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string, isDefault: boolean) => {
    if (isDefault) {
      showToast('Cannot delete default category', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete category "${categoryName}"?`)) {
      try {
        await deleteCategory(categoryId);
        showToast(`Category "${categoryName}" deleted`, 'success');
      } catch (error) {
        showToast('Failed to delete category', 'error');
      }
    }
  };

  const filters = [
    { id: 'all', label: 'All', count: getPendingTodos().length },
    { id: 'today', label: 'Today', count: todayTodos.length },
    { id: 'upcoming', label: 'Upcoming', count: getUpcomingTodos(7).length },
    { id: 'overdue', label: 'Overdue', count: overdueTodos.length },
    { id: 'completed', label: 'Completed', count: getCompletedTodos().length },
  ];

  return (
    <div className="goals-container">
      <div className="goals-header">
        <h1 className="goals-title">Todos</h1>
        <button className="btn btn-primary" onClick={onAddTodo}>
          + New Todo
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
          placeholder="Add todo..."
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
            Add
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

      {/* Categories Section */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '4px' }}>
          Categories:
        </span>
        {categories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: cat.color + '20',
              border: `1px solid ${cat.color}40`,
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: cat.color,
              }}
            />
            <span style={{ fontSize: '12px', color: cat.color }}>{cat.name}</span>
            {showCategoryManager && !cat.is_default && (
              <button
                onClick={() => handleDeleteCategory(cat.id, cat.name, cat.is_default)}
                style={{
                  marginLeft: '2px',
                  width: '16px',
                  height: '16px',
                  border: 'none',
                  borderRadius: '50%',
                  backgroundColor: '#E03E3E',
                  color: 'white',
                  fontSize: '12px',
                  lineHeight: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title={`Delete ${cat.name}`}
              >
                −
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          style={{
            width: '24px',
            height: '24px',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            backgroundColor: showCategoryManager ? 'var(--primary)' : 'var(--bg-sidebar)',
            color: showCategoryManager ? 'white' : 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
          title="Manage categories"
        >
          ⚙
        </button>
      </div>

      {/* Todo List */}
      {filteredTodos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">
            {filter === 'completed'
              ? 'No completed todos'
              : filter === 'overdue'
              ? 'No overdue todos!'
              : 'No todos'}
          </div>
          <div className="empty-state-text">
            {filter !== 'completed' && filter !== 'overdue' && 'Add a new todo to get started'}
          </div>
        </div>
      ) : (
        <div className="todo-list" style={{ background: 'var(--bg-main)', borderRadius: 'var(--border-radius-lg)', border: '1px solid var(--border-light)' }}>
          {filteredTodos.map((todo) => {
            const goal = todo.goal_id ? goals.find((g) => g.id === todo.goal_id) : null;
            const goalCategory = goal?.category_id ? getCategoryById(goal.category_id) : null;
            const deadlineDate = getDeadlineDate(todo.deadline);
            const deadlineTime = getDeadlineTime(todo.deadline);
            const isOverdue = deadlineDate && deadlineDate < new Date().toISOString().split('T')[0] && !todo.is_completed;

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
                    {deadlineDate && (
                      <span style={{ color: isOverdue ? '#E03E3E' : 'inherit' }}>
                        {isOverdue ? 'Overdue: ' : ''}
                        {deadlineDate}
                        {deadlineTime && ` ${deadlineTime}`}
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
                        {todo.recurrence_pattern === 'daily' ? 'Daily' : todo.recurrence_pattern === 'weekly' ? 'Weekly' : 'Monthly'}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => handleDelete(todo.id!)}
                  style={{ color: 'var(--text-muted)' }}
                >
                  Delete
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
              <span>Completed</span>
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
