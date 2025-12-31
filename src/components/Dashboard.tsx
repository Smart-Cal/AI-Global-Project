import React from 'react';
import { useEventStore } from '../store/eventStore';
import { useGoalStore } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { AGENT_CONFIGS, DEFAULT_CATEGORY_COLOR, type CalendarEvent, type Goal } from '../types';

interface DashboardProps {
  onEventClick: (event: CalendarEvent) => void;
  onGoalClick: (goal: Goal) => void;
  onViewChange: (view: 'calendar' | 'goals' | 'todos') => void;
  onOpenChat: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onEventClick,
  onGoalClick,
  onViewChange,
  onOpenChat,
}) => {
  const { user } = useAuthStore();
  const { events, getEventsByDate } = useEventStore();
  const { goals, getActiveGoals } = useGoalStore();
  const { todos, getTodayTodos, getUpcomingTodos, getOverdueTodos, toggleComplete } = useTodoStore();
  const { getCategoryById } = useCategoryStore();

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayEvents = getEventsByDate(todayStr);
  const activeGoals = getActiveGoals();
  const todayTodos = getTodayTodos();
  const overdueTodos = getOverdueTodos();
  const upcomingTodos = getUpcomingTodos(7);

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  const formatDate = (date: Date) => {
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일`;
  };

  // 다가오는 일정 (오늘 이후 7일)
  const getUpcomingEvents = () => {
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 7);
    const futureDateStr = futureDate.toISOString().split('T')[0];

    return events
      .filter((e) => e.event_date > todayStr && e.event_date <= futureDateStr)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 5);
  };

  const upcomingEvents = getUpcomingEvents();

  return (
    <div className="dashboard">
      <div className="dashboard-greeting">
        <h1>{getGreeting()}, {user?.nickname || user?.name}님!</h1>
        <p>{formatDate(today)}</p>
      </div>

      <div className="dashboard-grid">
        {/* 오늘의 일정 */}
        <div className="dashboard-card today-events">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <span>📅</span>
              <span>오늘의 일정</span>
            </div>
            <span className="dashboard-card-action" onClick={() => onViewChange('calendar')}>
              전체 보기
            </span>
          </div>

          {todayEvents.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <div className="empty-state-icon">📭</div>
              <div className="empty-state-text">오늘 등록된 일정이 없어요</div>
              <button className="btn btn-primary btn-sm" onClick={onOpenChat}>
                AI에게 일정 추천받기
              </button>
            </div>
          ) : (
            <div className="event-list">
              {todayEvents.map((event) => {
                const category = event.category_id ? getCategoryById(event.category_id) : null;
                const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
                const categoryName = category?.name || '기본';
                return (
                  <div
                    key={event.id}
                    className={`event-item ${event.is_completed ? 'completed' : ''}`}
                    onClick={() => onEventClick(event)}
                    style={{ opacity: event.is_completed ? 0.6 : 1 }}
                  >
                    <div
                      className="event-color-bar"
                      style={{ backgroundColor: categoryColor }}
                    />
                    <div className="event-time-badge">
                      <div className="event-time">
                        {event.is_all_day ? '종일' : event.start_time?.slice(0, 5)}
                      </div>
                    </div>
                    <div className="event-content">
                      <div className="event-title" style={{ textDecoration: event.is_completed ? 'line-through' : 'none' }}>
                        {event.is_completed && '✓ '}{event.title}
                      </div>
                      <div className="event-meta">
                        <span style={{ backgroundColor: categoryColor, color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                          {categoryName}
                        </span>
                        {event.location && <span>📍 {event.location}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 빠른 통계 */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <span>📊</span>
              <span>요약</span>
            </div>
          </div>
          <div className="quick-stats">
            <div className="stat-item">
              <div className="stat-icon">📅</div>
              <div>
                <div className="stat-value">{todayEvents.length}</div>
                <div className="stat-label">오늘 일정</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">✅</div>
              <div>
                <div className="stat-value">{todayTodos.length + overdueTodos.length}</div>
                <div className="stat-label">해야 할 일</div>
              </div>
            </div>
            <div className="stat-item">
              <div className="stat-icon">🎯</div>
              <div>
                <div className="stat-value">{activeGoals.length}</div>
                <div className="stat-label">진행 중인 목표</div>
              </div>
            </div>
          </div>
        </div>

        {/* 할 일 목록 */}
        <div className="dashboard-card" style={{ gridColumn: 'span 2' }}>
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <span>✅</span>
              <span>오늘 할 일</span>
              {(todayTodos.length + overdueTodos.length) > 0 && (
                <span className="todo-count">{todayTodos.length + overdueTodos.length}</span>
              )}
            </div>
            <span className="dashboard-card-action" onClick={() => onViewChange('todos')}>
              전체 보기
            </span>
          </div>

          <div className="todo-list">
            {overdueTodos.map((todo) => (
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
                    <span style={{ color: '#E03E3E' }}>기한 초과</span>
                    {todo.goal_id && (
                      <span className="todo-goal-tag">
                        {goals.find((g) => g.id === todo.goal_id)?.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {todayTodos.map((todo) => (
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
                    {todo.due_time && <span>{todo.due_time}</span>}
                    {todo.goal_id && (
                      <span className="todo-goal-tag">
                        {goals.find((g) => g.id === todo.goal_id)?.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {todayTodos.length + overdueTodos.length === 0 && (
              <div className="empty-state" style={{ padding: '20px' }}>
                <div className="empty-state-text">오늘 할 일이 없어요</div>
              </div>
            )}
          </div>
        </div>

        {/* 내 목표 */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <span>🎯</span>
              <span>내 목표</span>
            </div>
            <span className="dashboard-card-action" onClick={() => onViewChange('goals')}>
              전체 보기
            </span>
          </div>

          {activeGoals.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <div className="empty-state-text">설정된 목표가 없어요</div>
              <button className="btn btn-primary btn-sm" onClick={() => onViewChange('goals')}>
                목표 설정하기
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeGoals.slice(0, 3).map((goal) => {
                const category = goal.category_id ? getCategoryById(goal.category_id) : null;
                const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
                const categoryName = category?.name || '기본';
                return (
                  <div
                    key={goal.id}
                    style={{
                      padding: '12px',
                      background: 'var(--bg-sidebar)',
                      borderRadius: 'var(--border-radius)',
                      cursor: 'pointer',
                    }}
                    onClick={() => onGoalClick(goal)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span
                        style={{
                          backgroundColor: categoryColor,
                          color: '#fff',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {categoryName}
                      </span>
                      <span style={{ fontWeight: 500 }}>{goal.title}</span>
                    </div>
                    <div className="goal-progress-bar">
                      <div
                        className="goal-progress-fill"
                        style={{
                          width: `${goal.progress}%`,
                          backgroundColor: categoryColor,
                        }}
                      />
                    </div>
                    <div className="goal-progress-text">
                      <span>{goal.progress}% 완료</span>
                      {goal.target_date && <span>목표일: {goal.target_date}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI 추천 */}
        <div className="dashboard-card ai-recommendations">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <span>🤖</span>
              <span>AI 추천</span>
            </div>
            <span className="dashboard-card-action" onClick={onOpenChat}>
              대화하기
            </span>
          </div>

          <div className="recommendation-list">
            {activeGoals.slice(0, 3).map((goal) => {
              const category = goal.category_id ? getCategoryById(goal.category_id) : null;
              const agentConfig = AGENT_CONFIGS['master'];

              return (
                <div key={goal.id} className="recommendation-card">
                  <div className="recommendation-header">
                    <span className="recommendation-agent">{agentConfig.icon}</span>
                    <span className="recommendation-agent-name">{agentConfig.name}</span>
                  </div>
                  <div className="recommendation-content">
                    <h4>{goal.title} 달성을 위한 추천</h4>
                    <p>
                      {goal.target_date
                        ? `목표일(${goal.target_date})까지 ${goal.progress}% 진행 중입니다. 일정을 추천해 드릴까요?`
                        : '목표 달성을 위한 일정을 추천해 드릴까요?'}
                    </p>
                    <div className="recommendation-actions">
                      <button className="btn btn-primary btn-sm" onClick={onOpenChat}>
                        자세히 보기
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {activeGoals.length === 0 && (
              <div className="recommendation-card" style={{ minWidth: '100%' }}>
                <div className="recommendation-header">
                  <span className="recommendation-agent">🤖</span>
                  <span className="recommendation-agent-name">통합 매니저</span>
                </div>
                <div className="recommendation-content">
                  <h4>목표를 설정해보세요!</h4>
                  <p>목표를 설정하면 AI가 맞춤형 일정과 실천 방법을 추천해 드립니다.</p>
                  <div className="recommendation-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => onViewChange('goals')}>
                      목표 설정하기
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
