import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useTodoStore } from '../../store/todoStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useToast } from '../Toast';
import { useConfirm } from '../ConfirmModal';
import { DEFAULT_CATEGORY_COLOR, type CalendarEvent } from '../../types';

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

interface ScheduleViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date?: string) => void;
  onAddTodo: () => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ onEventClick, onAddEvent, onAddTodo }) => {
  const { events, loadEvents } = useEventStore();
  const { todos, fetchTodos, toggleComplete, deleteTodo, updateTodo } = useTodoStore();
  const { categories, fetchCategories, getCategoryById, deleteCategory, addCategory } = useCategoryStore();
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'events' | 'todos' | 'all'>('all');
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#4A90D9');

  // Todo edit state
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDeadlineDate, setEditDeadlineDate] = useState('');
  const [editDeadlineTime, setEditDeadlineTime] = useState('');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');

  const categoryColors = [
    '#EB5757', '#F2994A', '#F2C94C', '#27AE60', '#2F80ED', '#9B51E0', '#56CCF2', '#828282'
  ];

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast('Please enter a category name', 'error');
      return;
    }
    try {
      await addCategory(newCategoryName.trim(), newCategoryColor);
      showToast(`Category "${newCategoryName}" created`, 'success');
      setNewCategoryName('');
      setNewCategoryColor('#4A90D9');
      setShowAddCategory(false);
    } catch (error) {
      showToast('Failed to create category', 'error');
    }
  };

  useEffect(() => {
    loadEvents();
    fetchTodos();
    fetchCategories();
  }, []);

  const getFilteredEvents = () => {
    if (!selectedCategory) return events;
    return events.filter(e => e.category_id === selectedCategory);
  };

  const getFilteredTodos = () => {
    return todos;
  };

  const groupEventsByDate = (eventList: CalendarEvent[]) => {
    const grouped: Record<string, CalendarEvent[]> = {};
    eventList.forEach(event => {
      if (!grouped[event.event_date]) {
        grouped[event.event_date] = [];
      }
      grouped[event.event_date].push(event);
    });
    return grouped;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayStr = today.toISOString().split('T')[0];
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FECA57';
      case 'low': return '#1DD1A1';
      default: return '#9CA3AF';
    }
  };

  const startEditTodo = (todo: typeof todos[0]) => {
    setEditingTodoId(todo.id || null);
    setEditTitle(todo.title);
    setEditDeadlineDate(getDeadlineDate(todo.deadline) || '');
    setEditDeadlineTime(getDeadlineTime(todo.deadline) || '');
    setEditPriority(todo.priority);
  };

  const cancelEditTodo = () => {
    setEditingTodoId(null);
    setEditTitle('');
    setEditDeadlineDate('');
    setEditDeadlineTime('');
    setEditPriority('medium');
  };

  const saveEditTodo = async () => {
    if (!editingTodoId || !editTitle.trim()) {
      showToast('Title is required', 'error');
      return;
    }

    try {
      const deadline = editDeadlineDate
        ? editDeadlineTime
          ? `${editDeadlineDate}T${editDeadlineTime}:00`
          : `${editDeadlineDate}T23:59:00`
        : undefined;

      await updateTodo(editingTodoId, {
        title: editTitle.trim(),
        deadline,
        priority: editPriority,
      });
      showToast('Todo updated', 'success');
      cancelEditTodo();
    } catch (error) {
      showToast('Failed to update todo', 'error');
    }
  };

  const handleDeleteCategory = async (categoryId: string, categoryName: string, isDefault: boolean) => {
    if (isDefault) {
      showToast('Cannot delete default category', 'error');
      return;
    }
    const confirmed = await confirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category "${categoryName}"?`,
      confirmText: 'Delete',
      confirmVariant: 'danger'
    });
    if (confirmed) {
      try {
        await deleteCategory(categoryId);
        showToast(`Category "${categoryName}" deleted`, 'success');
        // If deleted category was selected, switch to all
        if (selectedCategory === categoryId) {
          setSelectedCategory(null);
        }
      } catch (error) {
        showToast('Failed to delete category', 'error');
      }
    }
  };

  const filteredEvents = getFilteredEvents();
  const filteredTodos = getFilteredTodos();
  const groupedEvents = groupEventsByDate(filteredEvents);
  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="schedule-view">
      <aside className="schedule-sidebar">
        <div className="schedule-sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Categories</h3>
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
            title="Manage Categories"
          >
            ⚙
          </button>
        </div>
        <div className="schedule-category-list">
          <button
            className={`schedule-category-item ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <span className="category-color-dot" style={{ backgroundColor: '#4A90D9' }} />
            <span className="category-name">All</span>
            <span className="category-count">{events.length}</span>
          </button>
          {categories.map(category => {
            const count = events.filter(e => e.category_id === category.id).length;
            return (
              <div
                key={category.id}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <button
                  className={`schedule-category-item ${selectedCategory === category.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(category.id)}
                  style={{ flex: 1 }}
                >
                  <span className="category-color-dot" style={{ backgroundColor: category.color }} />
                  <span className="category-name">{category.name}</span>
                  <span className="category-count">{count}</span>
                </button>
                {showCategoryManager && !category.is_default && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(category.id, category.name, category.is_default);
                    }}
                    style={{
                      width: '20px',
                      height: '20px',
                      border: 'none',
                      borderRadius: '50%',
                      backgroundColor: '#E03E3E',
                      color: 'white',
                      fontSize: '14px',
                      lineHeight: '18px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      flexShrink: 0,
                    }}
                    title={`Delete ${category.name}`}
                  >
                    −
                  </button>
                )}
              </div>
            );
          })}

          {/* Add Category Button */}
          {showCategoryManager && !showAddCategory && (
            <button
              onClick={() => setShowAddCategory(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                border: '1px dashed var(--border-medium)',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '13px',
                cursor: 'pointer',
                marginTop: '8px',
              }}
            >
              <span style={{ fontSize: '16px' }}>+</span>
              Add Category
            </button>
          )}

          {/* Add Category Form */}
          {showAddCategory && (
            <div
              style={{
                marginTop: '8px',
                padding: '12px',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--border-radius)',
                backgroundColor: 'var(--bg-main)',
              }}
            >
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') {
                    setShowAddCategory(false);
                    setNewCategoryName('');
                  }
                }}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid var(--border-light)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  marginBottom: '8px',
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {categoryColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewCategoryColor(color)}
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: color,
                      border: newCategoryColor === color ? '2px solid var(--text-primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  />
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAddCategory}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowAddCategory(false);
                    setNewCategoryName('');
                  }}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    backgroundColor: 'var(--bg-hover)',
                    color: 'var(--text-secondary)',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="schedule-sidebar-divider" />

        <div className="schedule-sidebar-section">
          <h4>View</h4>
          <div className="schedule-view-toggles">
            <button
              className={`schedule-view-toggle ${viewType === 'all' ? 'active' : ''}`}
              onClick={() => setViewType('all')}
            >
              All
            </button>
            <button
              className={`schedule-view-toggle ${viewType === 'events' ? 'active' : ''}`}
              onClick={() => setViewType('events')}
            >
              Events
            </button>
            <button
              className={`schedule-view-toggle ${viewType === 'todos' ? 'active' : ''}`}
              onClick={() => setViewType('todos')}
            >
              TODO
            </button>
          </div>
        </div>
      </aside>

      <div className="schedule-main">
        <div className="schedule-header">
          <h2>
            {selectedCategory
              ? categories.find(c => c.id === selectedCategory)?.name || 'Schedule'
              : 'All Events'}
          </h2>
          <div className="schedule-actions">
            <button className="btn btn-primary btn-sm" onClick={() => onAddEvent()}>
              + Add Event
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onAddTodo}>
              + Add Todo
            </button>
          </div>
        </div>

        <div className="schedule-content">
          {(viewType === 'all' || viewType === 'events') && (
            <div className="schedule-events-section">
              {viewType === 'all' && <h3 className="schedule-section-title">Events</h3>}

              {sortedDates.length === 0 ? (
                <div className="schedule-empty">
                  <p>No events</p>
                </div>
              ) : (
                sortedDates.map(date => (
                  <div key={date} className="schedule-date-group">
                    <div className="schedule-date-header">{formatDate(date)}</div>
                    <div className="schedule-events-list">
                      {groupedEvents[date].map(event => {
                        const category = event.category_id ? getCategoryById(event.category_id) : null;
                        return (
                          <div
                            key={event.id}
                            className={`schedule-event-item ${event.is_completed ? 'completed' : ''}`}
                            onClick={() => onEventClick(event)}
                          >
                            <div
                              className="schedule-event-color"
                              style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                            />
                            <div className="schedule-event-content">
                              <div className="schedule-event-title">{event.title}</div>
                              <div className="schedule-event-meta">
                                {event.is_all_day ? (
                                  <span>All day</span>
                                ) : (
                                  <span>
                                    {event.start_time?.slice(0, 5)}
                                    {event.end_time && ` - ${event.end_time.slice(0, 5)}`}
                                  </span>
                                )}
                                {event.location && (
                                  <span className="schedule-event-location">{event.location}</span>
                                )}
                              </div>
                            </div>
                            {event.is_completed && (
                              <span className="schedule-event-check">✓</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {(viewType === 'all' || viewType === 'todos') && (
            <div className="schedule-todos-section">
              {viewType === 'all' && <h3 className="schedule-section-title">TODO</h3>}

              {filteredTodos.length === 0 ? (
                <div className="schedule-empty">
                  <p>No todos</p>
                </div>
              ) : (
                <div className="schedule-todos-list">
                  {filteredTodos.map(todo => {
                    const todoCategory = todo.category_id ? getCategoryById(todo.category_id) : null;
                    const isEditing = editingTodoId === todo.id;

                    if (isEditing) {
                      return (
                        <div key={todo.id} className="schedule-todo-item editing">
                          <div className="schedule-todo-edit-form">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              placeholder="Todo title"
                              className="schedule-todo-edit-input"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditTodo();
                                if (e.key === 'Escape') cancelEditTodo();
                              }}
                            />
                            <div className="schedule-todo-edit-row">
                              <input
                                type="date"
                                value={editDeadlineDate}
                                onChange={(e) => setEditDeadlineDate(e.target.value)}
                                className="schedule-todo-edit-date"
                              />
                              <input
                                type="time"
                                value={editDeadlineTime}
                                onChange={(e) => setEditDeadlineTime(e.target.value)}
                                className="schedule-todo-edit-time"
                              />
                              <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value as 'high' | 'medium' | 'low')}
                                className="schedule-todo-edit-priority"
                              >
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                              </select>
                            </div>
                            <div className="schedule-todo-edit-actions">
                              <button
                                onClick={saveEditTodo}
                                className="btn btn-primary btn-xs"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditTodo}
                                className="btn btn-secondary btn-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={todo.id}
                        className={`schedule-todo-item ${todo.is_completed ? 'completed' : ''}`}
                      >
                        <button
                          className={`schedule-todo-checkbox ${todo.is_completed ? 'checked' : ''}`}
                          onClick={() => todo.id && toggleComplete(todo.id)}
                        >
                          {todo.is_completed && '✓'}
                        </button>
                        <div className="schedule-todo-content">
                          <div className="schedule-todo-title">{todo.title}</div>
                          <div className="schedule-todo-meta">
                            {getDeadlineDate(todo.deadline) && (
                              <span className="schedule-todo-due">
                                {formatDate(getDeadlineDate(todo.deadline)!)}
                                {getDeadlineTime(todo.deadline) && ` ${getDeadlineTime(todo.deadline)}`}
                              </span>
                            )}
                            {todoCategory && (
                              <span
                                className="schedule-todo-category"
                                style={{
                                  backgroundColor: todoCategory.color + '20',
                                  color: todoCategory.color,
                                  borderColor: todoCategory.color
                                }}
                              >
                                {todoCategory.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          className="schedule-todo-priority"
                          style={{ backgroundColor: getPriorityColor(todo.priority) }}
                        >
                          {todo.priority === 'high' ? 'High' : todo.priority === 'medium' ? 'Medium' : 'Low'}
                        </div>
                        <button
                          className="schedule-todo-edit"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditTodo(todo);
                          }}
                          title="Edit todo"
                        >
                          ✎
                        </button>
                        <button
                          className="schedule-todo-delete"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (todo.id) {
                              const confirmed = await confirm({
                                title: 'Delete Todo',
                                message: 'Are you sure you want to delete this todo?',
                                confirmText: 'Delete',
                                confirmVariant: 'danger'
                              });
                              if (confirmed) {
                                deleteTodo(todo.id);
                                showToast('Todo deleted', 'success');
                              }
                            }
                          }}
                          title="Delete todo"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleView;
