import React from 'react';
import { Modal } from './Modal';
import { useCategoryStore } from '../store/categoryStore';
import type { CalendarEvent } from '../types';
import { DEFAULT_CATEGORY_COLOR } from '../types';

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
  const { getCategoryById } = useCategoryStore();

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
    <Modal isOpen={isOpen} onClose={onClose} title={`${formatDate(date)}`}>
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
            const category = event.category_id ? getCategoryById(event.category_id) : null;
            const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
            const categoryName = category?.name || '기본';
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
                      style={{ background: categoryColor, color: 'white' }}
                    >
                      {categoryName}
                    </span>
                    {event.is_completed && '✓ '}
                    {event.title}
                  </div>
                  {event.location && (
                    <div className="event-meta">{event.location}</div>
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
