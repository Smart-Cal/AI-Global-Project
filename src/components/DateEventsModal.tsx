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
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()} (${days[d.getDay()]})`;
  };

  const formatTime = (time?: string) => {
    if (!time) return 'All day';
    return time.slice(0, 5);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`${formatDate(date)}`}>
      <div style={{ marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={onAddEvent}>
          + Add New Event
        </button>
      </div>

      {events.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>No events on this day</p>
        </div>
      ) : (
        <div>
          {events.map((event) => {
            const category = event.category_id ? getCategoryById(event.category_id) : null;
            const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
            const categoryName = category?.name || 'Default';
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
