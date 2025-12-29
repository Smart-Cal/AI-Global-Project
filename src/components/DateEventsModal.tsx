import React from 'react';
import { Modal } from './Modal';
import type { CalendarEvent } from '../types';
import { CATEGORIES } from '../types';

interface DateEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  events: CalendarEvent[];
  onAddEvent: () => void;
  onEditEvent: (event: CalendarEvent) => void;
}

export const DateEventsModal: React.FC<DateEventsModalProps> = ({
  isOpen,
  onClose,
  date,
  events,
  onAddEvent,
  onEditEvent,
}) => {
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
  };

  const formatTime = (time?: string) => {
    if (!time) return '종일';
    return time.slice(0, 5);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`📅 ${formatDate(date)}`}>
      <div style={{ marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={onAddEvent}>
          + 새 일정 추가
        </button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>이 날짜에 일정이 없습니다</p>
        </div>
      ) : (
        <div>
          {events.map((event) => {
            const category = CATEGORIES[event.category] || CATEGORIES.other;
            return (
              <div
                key={event.id}
                className="event-item"
                onClick={() => onEditEvent(event)}
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
