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
  ClockIcon,
  ChevronRightIcon,
  PlusIcon,
  SparkleIcon,
} from '../Icons';
import type { CalendarEvent, Todo, Goal } from '../../types';

interface NewDashboardProps {
  onNavigate: (view: 'assistant' | 'calendar' | 'schedule' | 'goal') => void;
  onAddEvent: () => void;
  onAddTodo: () => void;
  onAddGoal: () => void;
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

export const NewDashboard: React.FC<NewDashboardProps> = ({
  onNavigate,
  onAddEvent,
  onAddTodo,
  onAddGoal,
}) => {
  const { user } = useAuthStore();
  const { events, getEventsByDate, loadEvents } = useEventStore();
  const { todos, fetchTodos, toggleComplete } = useTodoStore();
  const { goals, fetchGoals } = useGoalStore();
  const { categories } = useCategoryStore();

  const [isLoading, setIsLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

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
        // 오늘부터 일주일 일정 로드
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 7);
        await Promise.all([
          loadEvents(today, endDate.toISOString().split('T')[0]),
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

  // 다음 일정 (오늘 이후)
  const upcomingEvents = events
    .filter((e) => e.event_date > today)
    .sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    })
    .slice(0, 5);

  // 오늘 할 일 (마감이 오늘이거나 마감 없는 것)
  const todayTodos = todos
    .filter((t) => {
      if (t.is_completed) return false;
      if (!t.deadline) return true;
      const deadlineDate = t.deadline.split('T')[0];
      return deadlineDate <= today;
    })
    .sort((a, b) => {
      // 우선순위순
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })
    .slice(0, 5);

  // 지연된 할 일
  const overdueTodos = todos.filter((t) => {
    if (t.is_completed) return false;
    if (!t.deadline) return false;
    const deadlineDate = t.deadline.split('T')[0];
    return deadlineDate < today;
  });

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
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* 헤더 - 인사말 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
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

        {/* 빠른 추가 버튼들 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onAddEvent}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <PlusIcon size={14} /> 일정
          </button>
          <button
            onClick={onAddTodo}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <PlusIcon size={14} /> 할 일
          </button>
          <button
            onClick={onAddGoal}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <PlusIcon size={14} /> 목표
          </button>
        </div>
      </div>

      {/* 요약 카드들 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* 오늘 일정 요약 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '8px', background: '#EEF2FF', borderRadius: '8px' }}>
                <CalendarIcon size={20} className="text-primary" />
              </div>
              <span style={{ fontWeight: 500 }}>오늘 일정</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>
              {todayEvents.length}
            </span>
          </div>
          {todayEvents.length > 0 && (
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              다음: {todayEvents.find((e) => !e.is_completed)?.title || '모든 일정 완료'}
            </p>
          )}
        </div>

        {/* 할 일 요약 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '8px', background: '#ECFDF5', borderRadius: '8px' }}>
                <CheckIcon size={20} style={{ color: '#10B981' }} />
              </div>
              <span style={{ fontWeight: 500 }}>오늘 할 일</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#10B981' }}>
              {todayTodos.length}
            </span>
          </div>
          {overdueTodos.length > 0 && (
            <p style={{ fontSize: '14px', color: '#EF4444', margin: 0 }}>
              ⚠️ {overdueTodos.length}개 지연됨
            </p>
          )}
        </div>

        {/* 목표 요약 */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ padding: '8px', background: '#F3E8FF', borderRadius: '8px' }}>
                <TargetIcon size={20} style={{ color: '#8B5CF6' }} />
              </div>
              <span style={{ fontWeight: 500 }}>진행 중 목표</span>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B5CF6' }}>
              {activeGoals.length}
            </span>
          </div>
          {activeGoals.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1, height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    background: getProgressColor(calculateGoalProgress(activeGoals[0])),
                    width: `${calculateGoalProgress(activeGoals[0])}%`,
                  }}
                />
              </div>
              <span style={{ fontSize: '12px', color: '#6B7280' }}>
                {calculateGoalProgress(activeGoals[0])}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 메인 컨텐츠 그리드 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {/* 왼쪽: 오늘 일정 타임라인 */}
        <div className="card">
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClockIcon size={18} style={{ color: 'var(--primary)' }} />
              오늘 일정
            </h2>
            <button
              onClick={() => onNavigate('calendar')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              전체 보기 <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '16px', maxHeight: '300px', overflowY: 'auto' }}>
            {todayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF' }}>
                <CalendarIcon size={48} style={{ opacity: 0.5, marginBottom: '8px' }} />
                <p>오늘 예정된 일정이 없어요</p>
                <button
                  onClick={onAddEvent}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: '14px' }}
                >
                  새 일정 추가하기
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {todayEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      padding: '12px',
                      background: event.is_completed ? '#F9FAFB' : '#F9FAFB',
                      borderRadius: '8px',
                      opacity: event.is_completed ? 0.6 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: '4px',
                        minHeight: '40px',
                        borderRadius: '2px',
                        background: getCategoryColor(event.category_id),
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3
                          style={{
                            margin: 0,
                            fontSize: '14px',
                            fontWeight: 500,
                            textDecoration: event.is_completed ? 'line-through' : 'none',
                            color: event.is_completed ? '#9CA3AF' : 'inherit',
                          }}
                        >
                          {event.title}
                        </h3>
                        {!event.is_fixed && (
                          <span style={{ fontSize: '11px', background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: '4px' }}>
                            유동
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '13px', color: '#6B7280' }}>
                        {event.start_time && (
                          <span>
                            {formatTime(event.start_time)}
                            {event.end_time && ` - ${formatTime(event.end_time)}`}
                          </span>
                        )}
                        {event.is_all_day && <span>종일</span>}
                        {event.location && (
                          <>
                            <span>•</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 다가오는 일정 미리보기 */}
          {upcomingEvents.length > 0 && (
            <div style={{ padding: '16px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 500, color: '#6B7280' }}>
                다가오는 일정
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {upcomingEvents.slice(0, 3).map((event) => (
                  <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#9CA3AF' }}>{formatDate(event.event_date)}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 오른쪽: 할 일 + 목표 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 오늘 할 일 */}
          <div className="card">
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckIcon size={18} style={{ color: '#10B981' }} />
                오늘 할 일
              </h2>
              <button
                onClick={() => onNavigate('schedule')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                전체 보기 <ChevronRightIcon size={14} />
              </button>
            </div>

            <div style={{ padding: '16px', maxHeight: '200px', overflowY: 'auto' }}>
              {todayTodos.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                  <CheckIcon size={40} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px' }}>할 일이 없어요</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {todayTodos.map((todo) => (
                    <div
                      key={todo.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                      }}
                      className="hover-bg"
                    >
                      <button
                        onClick={() => todo.id && toggleComplete(todo.id)}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: `2px solid ${todo.is_completed ? '#10B981' : '#D1D5DB'}`,
                          background: todo.is_completed ? '#10B981' : 'transparent',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                        }}
                      >
                        {todo.is_completed && '✓'}
                      </button>
                      <span
                        style={{
                          flex: 1,
                          textDecoration: todo.is_completed ? 'line-through' : 'none',
                          color: todo.is_completed ? '#9CA3AF' : 'inherit',
                        }}
                      >
                        {todo.title}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: `${getPriorityColor(todo.priority)}20`,
                          color: getPriorityColor(todo.priority),
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

          {/* 목표 */}
          <div className="card">
            <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TargetIcon size={18} style={{ color: '#8B5CF6' }} />
                내 목표
              </h2>
              <button
                onClick={() => onNavigate('goal')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                전체 보기 <ChevronRightIcon size={14} />
              </button>
            </div>

            <div style={{ padding: '16px' }}>
              {activeGoals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
                  <TargetIcon size={40} style={{ opacity: 0.5, marginBottom: '8px' }} />
                  <p style={{ fontSize: '14px' }}>설정된 목표가 없어요</p>
                  <button
                    onClick={onAddGoal}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B5CF6', fontSize: '14px' }}
                  >
                    새 목표 추가하기
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {activeGoals.map((goal) => {
                    const progress = calculateGoalProgress(goal);
                    return (
                      <div
                        key={goal.id}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          border: '1px solid #E5E7EB',
                          background: '#F9FAFB',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {goal.title}
                          </h3>
                          <span style={{ fontSize: '12px', color: '#6B7280' }}>
                            {formatDate(goal.target_date)}까지
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '8px', background: '#E5E7EB', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                background: getProgressColor(progress),
                                width: `${progress}%`,
                                transition: 'width 0.3s',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B7280' }}>
                            {progress}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI 비서 퀵 액세스 */}
      <div
        style={{
          marginTop: '24px',
          padding: '24px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.2)', borderRadius: '12px' }}>
            <SparkleIcon size={32} />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 600 }}>AI 비서에게 물어보세요</h3>
            <p style={{ margin: 0, opacity: 0.8, fontSize: '14px' }}>
              일정 추가, 할 일 관리, 브리핑 등 무엇이든 도와드려요
            </p>
          </div>
          <button
            onClick={() => onNavigate('assistant')}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: '#6366F1',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            대화 시작하기
          </button>
        </div>

        {/* 빠른 질문 예시 */}
        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {['오늘 일정 알려줘', '내일 3시에 회의 잡아줘', '이번 주 브리핑해줘'].map((prompt) => (
            <button
              key={prompt}
              onClick={() => onNavigate('assistant')}
              style={{
                padding: '8px 16px',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewDashboard;
