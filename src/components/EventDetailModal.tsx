import React from 'react';
import { useEventStore } from '../store/eventStore';
import { useCategoryStore } from '../store/categoryStore';
import { useConfirm } from './ConfirmModal';
import { type CalendarEvent, DEFAULT_CATEGORY_COLOR } from '../types';

interface EventDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  onEdit: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  isOpen,
  onClose,
  event: propEvent,
  onEdit,
}) => {
  const { events, removeEvent, toggleComplete } = useEventStore();
  const { getCategoryById } = useCategoryStore();
  const { confirm } = useConfirm();

  if (!isOpen || !propEvent) return null;

  // Get latest event state from store (to reflect completion status immediately)
  const event = events.find(e => e.id === propEvent.id) || propEvent;

  const category = event.category_id ? getCategoryById(event.category_id) : null;
  const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
  const categoryName = category?.name || 'Default';

  const formatTime = (time?: string) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Event',
      message: 'Are you sure you want to delete this event?',
      confirmText: 'Delete',
      confirmVariant: 'danger'
    });
    if (confirmed) {
      await removeEvent(event.id!);
      onClose();
    }
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.id) {
      await toggleComplete(event.id);
      // Trigger re-render explicitly if needed
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Event Details</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onEdit}
              title="Edit"
            >
              ✎
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          {/* Category Badge */}
          <div className="event-detail-category">
            <span
              className="event-detail-badge"
              style={{ backgroundColor: categoryColor }}
            >
              {categoryName}
            </span>
            {event.is_ai_suggested && (
              <span className="event-detail-ai-badge">AI Suggested</span>
            )}
          </div>

          {/* Title + Completion Checkbox */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              className={`todo-checkbox ${event.is_completed ? 'checked' : ''}`}
              style={{ cursor: 'pointer', flexShrink: 0 }}
              onClick={(e) => handleToggleComplete(e)}
            />
            <h2 className="event-detail-title" style={{ margin: 0 }}>
              {event.title}
            </h2>
          </div>

          {/* Date/Time */}
          <div className="event-detail-row">
            <span>
              {event.event_date}
              {event.is_all_day ? ' (All day)' : ''}
            </span>
          </div>

          {!event.is_all_day && event.start_time && (
            <div className="event-detail-row">
              <span>
                {formatTime(event.start_time)}
                {event.end_time && ` ~ ${formatTime(event.end_time)}`}
              </span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="event-detail-row">
              <span>{event.location}</span>
            </div>
          )}

          {/* Memo */}
          {event.description && (
            <div className="event-detail-section">
              <div className="event-detail-label">Memo</div>
              <div className="event-detail-description">{event.description}</div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-danger"
            onClick={handleDelete}
            style={{ marginRight: 'auto' }}
          >
            Delete
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={onEdit}>
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};
