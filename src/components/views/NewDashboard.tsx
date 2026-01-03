import React, { useState, useEffect } from 'react';
import { useEventStore } from '../../store/eventStore';
import { useTodoStore } from '../../store/todoStore';
import { useGoalStore, calculateGoalProgress } from '../../store/goalStore';
import { useAuthStore } from '../../store/authStore';
import { useCategoryStore } from '../../store/categoryStore';
import {
  CalendarIcon,
  TargetIcon,
  CheckIcon,
  ChevronRightIcon,
  SparkleIcon,
} from '../Icons';

interface NewDashboardProps {
  onNavigate: (view: 'assistant' | 'calendar' | 'schedule' | 'goal') => void;
}

// 시간 포맷팅 헬퍼
function formatTime(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? '오후' : '오전';
  const hour12 = hour % 12 || 12;
  return `${ampm} ${hour12}:${m}`;
}

// 날짜 포맷팅 헬퍼
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return '오늘';
  } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return '내일';
  }

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

// 우선순위 색상
function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high':
      return '#EF4444';
    case 'medium':
      return '#F59E0B';
    case 'low':
      return '#10B981';
    default:
      return '#6B7280';
  }
}

// 진행률 색상
function getProgressColor(progress: number): string {
  if (progress >= 80) return '#10B981';
  if (progress >= 50) return '#3B82F6';
  if (progress >= 25) return '#F59E0B';
  return '#9CA3AF';
}

export const NewDashboard: React.FC<NewDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const { events, getEventsByDate, loadEvents } = useEventStore();
  const { todos, fetchTodos, toggleComplete } = useTodoStore();
  const { goals, fetchGoals } = useGoalStore();
  const { categories } = useCategoryStore();

  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

  // 이번주 마지막 날 계산
  const getEndOfWeek = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = 7 - day; // 일요일까지 남은 일수
    date.setDate(date.getDate() + diff);
    return date.toISOString().split('T')[0];
  };

  const endOfWeek = getEndOfWeek();

  // 인사말 생성
  const getGreeting = () => {
    if (currentHour < 6) return '좋은 새벽이에요';
    if (currentHour < 12) return '좋은 아침이에요';
    if (currentHour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  // 데이터 로드
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          loadEvents(today, endOfWeek),
          fetchTodos(),
          fetchGoals(),
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // 오늘 일정
  const todayEvents = getEventsByDate(today).sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });

  // 이번주 일정 (오늘 이후 ~ 이번주 끝)
  const thisWeekEvents = events
    .filter((e) => e.event_date > today && e.event_date <= endOfWeek)
    .sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

  // 오늘 할 일 (마감이 오늘이거나 마감 없는 것)
  const todayTodos = todos
    .filter((t) => {
      if (t.is_completed) return false;
      if (!t.deadline) return true;
      const deadlineDate = t.deadline.split('T')[0];
      return deadlineDate <= today;
    })
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  // 활성 목표 (진행 중인 것들)
  const activeGoals = goals
    .filter((g) => !['completed', 'failed'].includes(g.status))
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
    .slice(0, 3);

  // 카테고리 색상 가져오기
  const getCategoryColor = (categoryId?: string) => {
    if (!categoryId) return '#9CA3AF';
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || '#9CA3AF';
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      {/* 헤더 - 인사말 */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
          {getGreeting()}, {user?.nickname || user?.name}님!
        </h1>
        <p style={{ color: '#6B7280', marginTop: '4px' }}>
          {new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* 메인 그리드 - 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>

        {/* 1. 오늘 일정 */}
        <div className="card" style={{ minHeight: '280px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={18} style={{ color: 'var(--primary)' }} />
              오늘 일정
            </h2>
            <button
              onClick={() => onNavigate('calendar')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              더보기 <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px', maxHeight: '180px', overflowY: 'auto' }}>
            {todayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                오늘 일정이 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {todayEvents.slice(0, 4).map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      background: '#F9FAFB',
                      borderRadius: '6px',
                      opacity: event.is_completed ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: '3px',
                        height: '32px',
                        borderRadius: '2px',
                        background: getCategoryColor(event.category_id),
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {event.title}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280' }}>
                        {event.start_time ? formatTime(event.start_time) : '종일'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 이번주 일정 미리보기 */}
          {thisWeekEvents.length > 0 && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '6px' }}>이번 주</div>
              {thisWeekEvents.slice(0, 2).map((event) => (
                <div key={event.id} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#9CA3AF' }}>{formatDate(event.event_date)}</span> {event.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. 오늘 할 일 */}
        <div className="card" style={{ minHeight: '280px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckIcon size={18} style={{ color: '#10B981' }} />
              오늘 할 일
            </h2>
            <button
              onClick={() => onNavigate('schedule')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              더보기 <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px', maxHeight: '220px', overflowY: 'auto' }}>
            {todayTodos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                할 일이 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {todayTodos.map((todo) => (
                  <div
                    key={todo.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    }}
                    className="hover-bg"
                  >
                    <button
                      onClick={() => todo.id && toggleComplete(todo.id)}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '4px',
                        border: `2px solid ${todo.is_completed ? '#10B981' : '#D1D5DB'}`,
                        background: todo.is_completed ? '#10B981' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '10px',
                        flexShrink: 0,
                      }}
                    >
                      {todo.is_completed && '✓'}
                    </button>
                    <span
                      style={{
                        flex: 1,
                        fontSize: '13px',
                        textDecoration: todo.is_completed ? 'line-through' : 'none',
                        color: todo.is_completed ? '#9CA3AF' : 'inherit',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {todo.title}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: `${getPriorityColor(todo.priority)}15`,
                        color: getPriorityColor(todo.priority),
                        flexShrink: 0,
                      }}
                    >
                      {todo.priority === 'high' && '높음'}
                      {todo.priority === 'medium' && '보통'}
                      {todo.priority === 'low' && '낮음'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. 진행 중인 목표 */}
        <div className="card" style={{ minHeight: '200px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TargetIcon size={18} style={{ color: '#8B5CF6' }} />
              진행 중인 목표
            </h2>
            <button
              onClick={() => onNavigate('goal')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              더보기 <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px' }}>
            {activeGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                진행 중인 목표가 없어요
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {activeGoals.map((goal) => {
                  const progress = calculateGoalProgress(goal);
                  return (
                    <div key={goal.id} style={{ padding: '10px', borderRadius: '6px', background: '#F9FAFB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {goal.title}
                        </span>
                        <span style={{ fontSize: '12px', color: '#6B7280', flexShrink: 0 }}>
                          {progress}%
                        </span>
                      </div>
                      <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            background: getProgressColor(progress),
                            width: `${progress}%`,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* 4. AI 비서 */}
        <div
          className="card"
          style={{
            minHeight: '200px',
            background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            padding: '24px',
          }}
          onClick={() => onNavigate('assistant')}
        >
          <div style={{ padding: '16px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', marginBottom: '16px' }}>
            <SparkleIcon size={32} />
          </div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>AI 비서</h3>
          <p style={{ margin: 0, opacity: 0.85, fontSize: '14px', lineHeight: 1.5 }}>
            일정 관리, 할 일 추천<br />무엇이든 물어보세요
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewDashboard;
