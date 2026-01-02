import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useTodoStore } from '../../store/todoStore';
import { useCategoryStore } from '../../store/categoryStore';
import { DEFAULT_CATEGORY_COLOR, type CalendarEvent } from '../../types';

interface ScheduleViewProps {
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date?: string) => void;
  onAddTodo: () => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ onEventClick, onAddEvent, onAddTodo }) => {
  const { events, loadEvents } = useEventStore();
  const { todos, fetchTodos, toggleComplete } = useTodoStore();
  const { categories, fetchCategories, getCategoryById } = useCategoryStore();

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewType, setViewType] = useState<'events' | 'todos' | 'all'>('all');

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

    if (dateStr === todayStr) return '오늘';
    if (dateStr === tomorrowStr) return '내일';

    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FECA57';
      case 'low': return '#1DD1A1';
      default: return '#9CA3AF';
    }
  };

  const filteredEvents = getFilteredEvents();
  const filteredTodos = getFilteredTodos();
  const groupedEvents = groupEventsByDate(filteredEvents);
  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="schedule-view">
      <aside className="schedule-sidebar">
        <div className="schedule-sidebar-header">
          <h3>카테고리</h3>
        </div>
        <div className="schedule-category-list">
          <button
            className={`schedule-category-item ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            <span className="category-color-dot" style={{ backgroundColor: '#4A90D9' }} />
            <span className="category-name">전체</span>
            <span className="category-count">{events.length}</span>
          </button>
          {categories.map(category => {
            const count = events.filter(e => e.category_id === category.id).length;
            return (
              <button
                key={category.id}
                className={`schedule-category-item ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(category.id)}
              >
                <span className="category-color-dot" style={{ backgroundColor: category.color }} />
                <span className="category-name">{category.name}</span>
                <span className="category-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="schedule-sidebar-divider" />

        <div className="schedule-sidebar-section">
          <h4>보기</h4>
          <div className="schedule-view-toggles">
            <button
              className={`schedule-view-toggle ${viewType === 'all' ? 'active' : ''}`}
              onClick={() => setViewType('all')}
            >
              전체
            </button>
            <button
              className={`schedule-view-toggle ${viewType === 'events' ? 'active' : ''}`}
              onClick={() => setViewType('events')}
            >
              일정
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
              ? categories.find(c => c.id === selectedCategory)?.name || '일정'
              : '전체 일정'}
          </h2>
          <div className="schedule-actions">
            <button className="btn btn-primary btn-sm" onClick={() => onAddEvent()}>
              + 일정 추가
            </button>
            <button className="btn btn-secondary btn-sm" onClick={onAddTodo}>
              + TODO 추가
            </button>
          </div>
        </div>

        <div className="schedule-content">
          {(viewType === 'all' || viewType === 'events') && (
            <div className="schedule-events-section">
              {viewType === 'all' && <h3 className="schedule-section-title">일정</h3>}

              {sortedDates.length === 0 ? (
                <div className="schedule-empty">
                  <p>일정이 없습니다</p>
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
                                  <span>종일</span>
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
                  <p>할 일이 없습니다</p>
                </div>
              ) : (
                <div className="schedule-todos-list">
                  {filteredTodos.map(todo => (
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
                        {todo.due_date && (
                          <div className="schedule-todo-due">
                            {formatDate(todo.due_date)}
                            {todo.due_time && ` ${todo.due_time.slice(0, 5)}`}
                          </div>
                        )}
                      </div>
                      <div
                        className="schedule-todo-priority"
                        style={{ backgroundColor: getPriorityColor(todo.priority) }}
                      >
                        {todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '중간' : '낮음'}
                      </div>
                    </div>
                  ))}
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
