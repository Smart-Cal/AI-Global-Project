import React from 'react';
import { useEventStore } from '../store/eventStore';
import { useCategoryStore } from '../store/categoryStore';
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

  if (!isOpen || !propEvent) return null;

  // store에서 최신 이벤트 상태 가져오기 (완료 상태 즉각 반영)
  const event = events.find(e => e.id === propEvent.id) || propEvent;

  const category = event.category_id ? getCategoryById(event.category_id) : null;
  const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
  const categoryName = category?.name || '기본';

  const formatTime = (time?: string) => {
    if (!time) return '';
    return time.slice(0, 5);
  };

  const handleDelete = async () => {
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      await removeEvent(event.id!);
      onClose();
    }
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (event.id) {
      await toggleComplete(event.id);
      // 강제로 컴포넌트 재렌더링을 트리거
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">일정 상세</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={onEdit}
              title="수정"
            >
              ✎
            </button>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body">
          {/* 카테고리 배지 */}
          <div className="event-detail-category">
            <span
              className="event-detail-badge"
              style={{ backgroundColor: categoryColor }}
            >
              {categoryName}
            </span>
            {event.is_ai_suggested && (
              <span className="event-detail-ai-badge">AI 추천</span>
            )}
          </div>

          {/* 제목 + 완료 체크박스 */}
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

          {/* 날짜/시간 */}
          <div className="event-detail-row">
            <span>
              {event.event_date}
              {event.is_all_day ? ' (종일)' : ''}
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

          {/* 장소 */}
          {event.location && (
            <div className="event-detail-row">
              <span>{event.location}</span>
            </div>
          )}

          {/* 메모 */}
          {event.description && (
            <div className="event-detail-section">
              <div className="event-detail-label">메모</div>
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
            삭제
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            닫기
          </button>
          <button className="btn btn-primary" onClick={onEdit}>
            수정하기
          </button>
        </div>
      </div>
    </div>
  );
};
