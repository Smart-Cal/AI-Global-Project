import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useTodoStore } from '../../store/todoStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useToast } from '../Toast';
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
  const { todos, fetchTodos, toggleComplete, deleteTodo } = useTodoStore();
  const { categories, fetchCategories, getCategoryById, deleteCategory } = useCategoryStore();
  const { showToast } = useToast();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'events' | 'todos' | 'all'>('all');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

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

  const handleDeleteCategory = async (categoryId: string, categoryName: string, isDefault: boolean) => {
    if (isDefault) {
      showToast('Cannot delete default category', 'error');
      return;
    }
    if (confirm(`Are you sure you want to delete category "${categoryName}"?`)) {
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
                          className="schedule-todo-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (todo.id && confirm('Delete this todo?')) {
                              deleteTodo(todo.id);
                              showToast('Todo deleted', 'success');
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
