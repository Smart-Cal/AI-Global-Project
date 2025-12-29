import React, { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { EventModal } from '../components';
import { CATEGORIES } from '../types';
import type { CalendarEvent, EventCategory } from '../types';

type PeriodFilter = 'week' | 'month' | 'all';

const SchedulePage: React.FC = () => {
  const { user } = useAuthStore();
  const { events, loadEventsRange } = useEventStore();

  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'all'>('all');
  const [period, setPeriod] = useState<PeriodFilter>('week');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => {
    if (user?.id) {
      const start = todayStr;
      let end: Date;

      if (period === 'week') {
        end = new Date(today);
        end.setDate(end.getDate() + 7);
      } else if (period === 'month') {
        end = new Date(today);
        end.setMonth(end.getMonth() + 1);
      } else {
        end = new Date(today);
        end.setFullYear(end.getFullYear() + 1);
      }

      loadEventsRange(user.id, start, end.toISOString().split('T')[0]);
    }
  }, [user?.id, period, loadEventsRange, todayStr]);

  const filteredEvents = useMemo(() => {
    let filtered = [...events];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((e) => e.category === selectedCategory);
    }

    // Sort by date and time
    filtered.sort((a, b) => {
      if (a.event_date !== b.event_date) {
        return a.event_date.localeCompare(b.event_date);
      }
      return (a.start_time || '').localeCompare(b.start_time || '');
    });

    return filtered;
  }, [events, selectedCategory]);

  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {};

    filteredEvents.forEach((event) => {
      if (!groups[event.event_date]) {
        groups[event.event_date] = [];
      }
      groups[event.event_date].push(event);
    });

    return groups;
  }, [filteredEvents]);

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const isToday = dateStr === todayStr;
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})${isToday ? ' - 오늘' : ''}`;
  };

  const formatTime = (time?: string) => {
    if (!time) return '종일';
    return time.slice(0, 5);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  const categories = Object.entries(CATEGORIES) as Array<[EventCategory, typeof CATEGORIES[EventCategory]]>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="greeting">📋 일정 관리</div>
        <div className="date-text">카테고리별로 일정을 확인하세요</div>
      </div>

      {/* Period Selector */}
      <div className="period-selector">
        <button
          className={`period-btn ${period === 'week' ? 'active' : ''}`}
          onClick={() => setPeriod('week')}
        >
          이번 주
        </button>
        <button
          className={`period-btn ${period === 'month' ? 'active' : ''}`}
          onClick={() => setPeriod('month')}
        >
          이번 달
        </button>
        <button
          className={`period-btn ${period === 'all' ? 'active' : ''}`}
          onClick={() => setPeriod('all')}
        >
          전체
        </button>
      </div>

      {/* Category Filter */}
      <div style={{ padding: '0 16px', marginBottom: '16px' }}>
        <div className="category-chips">
          <button
            className={`category-chip ${selectedCategory === 'all' ? 'selected' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            전체
          </button>
          {categories.map(([key, config]) => (
            <button
              key={key}
              className={`category-chip ${selectedCategory === key ? 'selected' : ''}`}
              onClick={() => setSelectedCategory(key)}
              style={selectedCategory === key ? { background: config.color + '20', borderColor: config.color } : {}}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      <div className="section">
        {Object.keys(groupedEvents).length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>해당 기간에 일정이 없어요</p>
            </div>
          </div>
        ) : (
          Object.entries(groupedEvents).map(([date, dayEvents]) => (
            <div key={date} style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>
                {formatDateHeader(date)}
              </div>
              <div className="card">
                {dayEvents.map((event) => {
                  const category = CATEGORIES[event.category] || CATEGORIES.other;
                  return (
                    <div
                      key={event.id}
                      className="event-item"
                      onClick={() => handleEditEvent(event)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="event-time">{formatTime(event.start_time)}</div>
                      <div className="event-content">
                        <div className="event-title">
                          <span
                            className="category-tag"
                            style={{ background: event.color || category.color, color: 'white' }}
                          >
                            {category.icon} {category.label}
                          </span>
                          {event.title}
                        </div>
                        {event.location && (
                          <div className="event-meta">📍 {event.location}</div>
                        )}
                        {event.description && (
                          <div className="event-meta" style={{ marginTop: '4px' }}>
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Event Button */}
      <div className="section">
        <button
          className="btn btn-primary"
          onClick={() => {
            setEditingEvent(null);
            setEventModalOpen(true);
          }}
        >
          ➕ 새 일정 추가
        </button>
      </div>

      {/* Event Modal */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        defaultDate={todayStr}
      />
    </div>
  );
};

export default SchedulePage;
