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
  SunIcon,
  MoonIcon,
  CloudIcon,
  ThermometerIcon,
} from '../Icons';
import * as api from '../../services/api';

interface NewDashboardProps {
  onNavigate: (view: 'assistant' | 'calendar' | 'schedule' | 'goal') => void;
}

// Briefing type definition
type BriefingType = 'morning' | 'afternoon' | 'evening' | null;

interface BriefingData {
  type: BriefingType;
  message: string;
  weather?: api.WeatherInfo;
  todayEvents?: api.Event[];
  incompleteTodos?: api.Todo[];
  completedEvents?: api.Event[];
  completedTodos?: api.Todo[];
  completionRate?: number;
  tomorrowFirstEvent?: api.Event;
  tomorrowWeather?: api.WeatherInfo;
  precipitation?: {
    willRain: boolean;
    willSnow: boolean;
    time?: string;
  };
}

// Time formatting helper
function formatTime(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

// Date formatting helper
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (dateStr === today.toISOString().split('T')[0]) {
    return 'Today';
  } else if (dateStr === tomorrow.toISOString().split('T')[0]) {
    return 'Tomorrow';
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

// Priority color
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

// Progress color
function getProgressColor(progress: number): string {
  if (progress >= 80) return '#10B981';
  if (progress >= 50) return '#3B82F6';
  if (progress >= 25) return '#F59E0B';
  return '#9CA3AF';
}

// Weather icon selection helper
function getWeatherIcon(condition: string): React.ReactNode {
  const lowerCondition = condition.toLowerCase();
  if (lowerCondition.includes('rain')) {
    return <CloudIcon size={24} style={{ color: '#60A5FA' }} />;
  }
  if (lowerCondition.includes('cloud')) {
    return <CloudIcon size={24} style={{ color: '#9CA3AF' }} />;
  }
  return <SunIcon size={24} style={{ color: '#FBBF24' }} />;
}

// Determine briefing type based on initial access time
function determineBriefingType(hour: number): BriefingType {
  // 5am~12pm: Morning briefing (today's schedule + weather)
  if (hour >= 5 && hour < 12) return 'morning';
  // 12pm~6pm: Afternoon briefing (remaining schedule + progress)
  if (hour >= 12 && hour < 18) return 'afternoon';
  // 6pm~5am: Evening briefing (today's summary + tomorrow preview)
  return 'evening';
}

export const NewDashboard: React.FC<NewDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuthStore();
  const { events, getEventsByDate, loadEvents } = useEventStore();
  const { todos, fetchTodos, toggleComplete } = useTodoStore();
  const { goals, fetchGoals } = useGoalStore();
  const { categories } = useCategoryStore();

  const [isLoading, setIsLoading] = useState(true);
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationReady, setLocationReady] = useState(false); // Location verification complete status

  const today = new Date().toISOString().split('T')[0];
  const now = new Date();
  const currentHour = now.getHours();

  // Calculate last day of the week
  const getEndOfWeek = () => {
    const date = new Date();
    const day = date.getDay();
    const diff = 7 - day; // Days remaining until Sunday
    date.setDate(date.getDate() + diff);
    return date.toISOString().split('T')[0];
  };

  const endOfWeek = getEndOfWeek();

  // Generate greeting
  const getGreeting = () => {
    if (currentHour < 6) return 'Good early morning';
    if (currentHour < 12) return 'Good morning';
    if (currentHour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Get user location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location obtained:', position.coords.latitude, position.coords.longitude);
          setUserCoords({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationReady(true);
        },
        (error) => {
          console.log('Geolocation error:', error.code, error.message);
          // Continue with default city even if location permission is denied
          setLocationReady(true);
        },
        { timeout: 10000, maximumAge: 300000 } // 10 second timeout, 5 minute cache
      );
    } else {
      console.log('Geolocation not supported');
      setLocationReady(true);
    }
  }, []);

  // Load data
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

  // Load briefing
  useEffect(() => {
    const loadBriefing = async () => {
      const briefingType = determineBriefingType(currentHour);
      if (!briefingType) {
        setBriefing(null);
        return;
      }

      // Check if briefing has already been viewed from session storage
      const dismissedKey = `briefing_dismissed_${briefingType}_${today}`;
      if (sessionStorage.getItem(dismissedKey)) {
        setBriefingDismissed(true);
        return;
      }

      setBriefingLoading(true);
      try {
        // Pass coordinates if available, otherwise undefined (server uses default city)
        const coords = userCoords || undefined;

        if (briefingType === 'morning') {
          // Morning: Today's schedule + weather
          const data = await api.getMorningBriefing(coords);
          setBriefing({
            type: 'morning',
            message: data.message,
            weather: data.weather,
            todayEvents: data.today_events,
            incompleteTodos: data.incomplete_todos,
            precipitation: data.precipitation,
          });
        } else if (briefingType === 'afternoon') {
          // Afternoon: Use morning briefing data but with different message
          const data = await api.getMorningBriefing(coords);
          setBriefing({
            type: 'afternoon',
            message: data.message,
            weather: data.weather,
            todayEvents: data.today_events,
            incompleteTodos: data.incomplete_todos,
            precipitation: data.precipitation,
          });
        } else {
          // Evening: Today's summary + tomorrow preview + tomorrow weather
          const data = await api.getEveningBriefing(coords);
          setBriefing({
            type: 'evening',
            message: data.message,
            completedEvents: data.completed_events,
            completedTodos: data.completed_todos,
            completionRate: data.completion_rate,
            tomorrowFirstEvent: data.tomorrow_first_event,
            tomorrowWeather: data.tomorrow_weather,
            precipitation: data.precipitation,
          });
        }
      } catch (error) {
        console.error('Failed to load briefing:', error);
        setBriefing(null);
      } finally {
        setBriefingLoading(false);
      }
    };

    // Load briefing after data loading and location verification are complete
    if (!isLoading && locationReady) {
      loadBriefing();
    }
  }, [isLoading, locationReady, currentHour, today, userCoords]);

  // Dismiss briefing
  const dismissBriefing = () => {
    if (briefing?.type) {
      const dismissedKey = `briefing_dismissed_${briefing.type}_${today}`;
      sessionStorage.setItem(dismissedKey, 'true');
    }
    setBriefingDismissed(true);
  };

  // Today's events
  const todayEvents = getEventsByDate(today).sort((a, b) => {
    if (!a.start_time) return 1;
    if (!b.start_time) return -1;
    return a.start_time.localeCompare(b.start_time);
  });

  // This week's events (after today ~ end of week)
  const thisWeekEvents = events
    .filter((e) => e.event_date > today && e.event_date <= endOfWeek)
    .sort((a, b) => {
      if (a.event_date !== b.event_date) return a.event_date.localeCompare(b.event_date);
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

  // Today's todos (due today or no deadline)
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

  // Active goals (in progress)
  const activeGoals = goals
    .filter((g) => !['completed', 'failed'].includes(g.status))
    .sort((a, b) => new Date(a.target_date).getTime() - new Date(b.target_date).getTime())
    .slice(0, 3);

  // Get category color
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
      {/* Header - Greeting */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
          {getGreeting()}, {user?.nickname || user?.name}!
        </h1>
        <p style={{ color: '#6B7280', marginTop: '4px' }}>
          {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </p>
      </div>

      {/* Briefing card */}
      {briefing && !briefingDismissed && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            background: briefing.type === 'morning'
              ? 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)'
              : briefing.type === 'afternoon'
                ? 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)'
                : 'linear-gradient(135deg, #E0E7FF 0%, #C7D2FE 100%)',
            border: 'none',
            position: 'relative',
          }}
        >
          {/* Close button */}
          {/* Close button */}
          <button
            onClick={dismissBriefing}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              background: 'rgba(0,0,0,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              color: '#4B5563',
              zIndex: 10,
            }}
          >
            ×
          </button>

          <div style={{ padding: '20px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              {briefing.type === 'morning' ? <SunIcon size={20} style={{ color: '#D97706' }} /> :
                briefing.type === 'afternoon' ? <CloudIcon size={20} style={{ color: '#2563EB' }} /> :
                  <MoonIcon size={20} style={{ color: '#4F46E5' }} />}
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1F2937' }}>
                {briefing.type === 'morning' ? 'Morning Briefing' :
                  briefing.type === 'afternoon' ? 'Afternoon Check' :
                    'Daily Wrap-up'}
              </h3>
            </div>

            {/* 2-Block Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

              {/* Block 1: Weather - Simple */}
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px'
              }}>
                {briefing.weather ? (
                  <>
                    <div style={{ transform: 'scale(1.3)' }}>
                      {getWeatherIcon(briefing.weather.condition)}
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 700, color: '#1F2937' }}>
                        {briefing.weather.temperature}°C
                      </div>
                      <div style={{ fontSize: '14px', color: '#6B7280', marginTop: '2px' }}>
                        {briefing.weather.condition}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: '13px', color: '#9CA3AF' }}>Weather unavailable</div>
                )}
              </div>

              {/* Block 2: Rain Check - Ultra Simple */}
              <div style={{
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '8px',
                border: briefing.precipitation?.willRain || briefing.precipitation?.willSnow ? '2px solid #60A5FA' : 'none'
              }}>
                {briefing.precipitation ? (
                  briefing.precipitation.willRain || briefing.precipitation.willSnow ? (
                    <>
                      <CloudIcon size={28} style={{ color: '#3B82F6' }} />
                      <div style={{ fontSize: '15px', fontWeight: 700, color: '#1F2937', textAlign: 'center' }}>
                        {briefing.precipitation.willSnow ? '눈 예상' : '비 예상'}
                      </div>
                      {briefing.precipitation.time && (
                        <div style={{ fontSize: '13px', color: '#6B7280' }}>
                          {briefing.type === 'evening' ? '내일 ' : ''}{briefing.precipitation.time}경
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <SunIcon size={28} style={{ color: '#F59E0B' }} />
                      <div style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937' }}>
                        맑음
                      </div>
                    </>
                  )
                ) : (
                  <div style={{ fontSize: '13px', color: '#9CA3AF' }}>확인 중...</div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Briefing loading */}
      {briefingLoading && (
        <div
          className="card"
          style={{
            marginBottom: '16px',
            padding: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
          }}
        >
          <div className="spinner" style={{ width: '20px', height: '20px' }} />
          <span style={{ color: '#6B7280' }}>Preparing your briefing...</span>
        </div>
      )}

      {/* Main grid - 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>

        {/* 1. Today's Schedule */}
        <div className="card" style={{ minHeight: '280px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={18} style={{ color: 'var(--primary)' }} />
              Today's Schedule
            </h2>
            <button
              onClick={() => onNavigate('calendar')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              View all <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px', maxHeight: '180px', overflowY: 'auto' }}>
            {todayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No events today
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
                        {event.start_time ? formatTime(event.start_time) : 'All day'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* This week's events preview */}
          {thisWeekEvents.length > 0 && (
            <div style={{ padding: '10px 12px', borderTop: '1px solid #E5E7EB', background: '#F9FAFB' }}>
              <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '6px' }}>This week</div>
              {thisWeekEvents.slice(0, 2).map((event) => (
                <div key={event.id} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#9CA3AF' }}>{formatDate(event.event_date)}</span> {event.title}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. Today's Todos */}
        <div className="card" style={{ minHeight: '280px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckIcon size={18} style={{ color: '#10B981' }} />
              Today's Todos
            </h2>
            <button
              onClick={() => onNavigate('schedule')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              View all <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px', maxHeight: '220px', overflowY: 'auto' }}>
            {todayTodos.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No todos
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
                      {todo.priority === 'high' && 'High'}
                      {todo.priority === 'medium' && 'Medium'}
                      {todo.priority === 'low' && 'Low'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. Active Goals */}
        <div className="card" style={{ minHeight: '200px' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TargetIcon size={18} style={{ color: '#8B5CF6' }} />
              Active Goals
            </h2>
            <button
              onClick={() => onNavigate('goal')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#8B5CF6', display: 'flex', alignItems: 'center', gap: '2px' }}
            >
              View all <ChevronRightIcon size={14} />
            </button>
          </div>

          <div style={{ padding: '12px' }}>
            {activeGoals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontSize: '14px' }}>
                No active goals
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

        {/* 4. AI Assistant */}
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
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>AI Assistant</h3>
          <p style={{ margin: 0, opacity: 0.85, fontSize: '14px', lineHeight: 1.5 }}>
            Schedule management, todo recommendations<br />Ask me anything
          </p>
        </div>
      </div>
    </div>
  );
};

export default NewDashboard;
