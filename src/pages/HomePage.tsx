import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useEventStore } from '../store/eventStore';
import { EventModal, AIChatModal } from '../components';
import { CATEGORIES } from '../types';
import type { CalendarEvent } from '../types';

const HomePage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const { events, loadEventsRange, selectedDate } = useEventStore();
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  useEffect(() => {
    if (user?.id) {
      const end = new Date(today);
      end.setDate(end.getDate() + 7);
      loadEventsRange(user.id, todayStr, end.toISOString().split('T')[0]);
    }
  }, [user?.id, loadEventsRange, todayStr]);

  const getGreeting = () => {
    const hour = today.getHours();
    if (hour < 12) return '좋은 아침이에요';
    if (hour < 18) return '좋은 오후예요';
    return '좋은 저녁이에요';
  };

  const formatDate = () => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${today.getMonth() + 1}월 ${today.getDate()}일 ${days[today.getDay()]}요일`;
  };

  const todayEvents = events.filter((e) => e.event_date === todayStr);
  const upcomingEvents = events
    .filter((e) => e.event_date > todayStr)
    .slice(0, 5);

  const formatTime = (time?: string) => {
    if (!time) return '종일';
    return time.slice(0, 5);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventModalOpen(true);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    setEventModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="greeting">{getGreeting()}, {user?.nickname || user?.name}님 👋</div>
            <div className="date-text">{formatDate()}</div>
          </div>
          <button
            className="btn btn-ghost"
            style={{ padding: '8px', width: 'auto' }}
            onClick={logout}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* Today's Events */}
      <div className="section">
        <div className="section-title">📌 오늘의 일정</div>
        <div className="card">
          {todayEvents.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎉</div>
              <p>오늘 일정이 없어요!</p>
            </div>
          ) : (
            todayEvents.map((event) => {
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
                        {category.icon}
                      </span>
                      {event.title}
                    </div>
                    {event.location && (
                      <div className="event-meta">📍 {event.location}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Upcoming Events */}
      <div className="section">
        <div className="section-title">📆 다가오는 일정</div>
        <div className="card">
          {upcomingEvents.length === 0 ? (
            <div className="empty-state">
              <div className="icon">📭</div>
              <p>예정된 일정이 없어요</p>
            </div>
          ) : (
            upcomingEvents.map((event) => {
              const category = CATEGORIES[event.category] || CATEGORIES.other;
              const eventDate = new Date(event.event_date);
              const dateLabel = `${eventDate.getMonth() + 1}/${eventDate.getDate()}`;
              return (
                <div
                  key={event.id}
                  className="event-item"
                  onClick={() => handleEditEvent(event)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="event-time">{dateLabel}</div>
                  <div className="event-content">
                    <div className="event-title">
                      <span
                        className="category-tag"
                        style={{ background: event.color || category.color, color: 'white' }}
                      >
                        {category.icon}
                      </span>
                      {event.title}
                    </div>
                    <div className="event-meta">
                      {formatTime(event.start_time)}
                      {event.location && ` · 📍 ${event.location}`}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="section">
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddEvent}>
            ➕ 새 일정
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setAiChatOpen(true)}>
            💬 AI 도우미
          </button>
        </div>
      </div>

      {/* Modals */}
      <EventModal
        isOpen={eventModalOpen}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        event={editingEvent}
        defaultDate={selectedDate || todayStr}
      />

      <AIChatModal
        isOpen={aiChatOpen}
        onClose={() => setAiChatOpen(false)}
      />
    </div>
  );
};

export default HomePage;
