import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import type { CalendarEvent, EventCategory } from '../types';
import { CATEGORIES, EVENT_COLORS } from '../types';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, event, defaultDate }) => {
  const { user } = useAuthStore();
  const { addEvent, editEvent, removeEvent } = useEventStore();

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>('personal');
  const [color, setColor] = useState(EVENT_COLORS[7]);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isEditing = !!event;

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDate(event.event_date);
      setStartTime(event.start_time || '09:00');
      setEndTime(event.end_time || '10:00');
      setIsAllDay(event.is_all_day);
      setCategory(event.category);
      setColor(event.color);
      setLocation(event.location || '');
      setDescription(event.description || '');
    } else {
      setTitle('');
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setStartTime('09:00');
      setEndTime('10:00');
      setIsAllDay(false);
      setCategory('personal');
      setColor(EVENT_COLORS[7]);
      setLocation('');
      setDescription('');
    }
  }, [event, defaultDate, isOpen]);

  const handleSave = async () => {
    if (!title.trim() || !user?.id) return;

    setIsLoading(true);
    try {
      if (isEditing && event?.id) {
        await editEvent(event.id, {
          title: title.trim(),
          event_date: date,
          start_time: isAllDay ? undefined : startTime,
          end_time: isAllDay ? undefined : endTime,
          is_all_day: isAllDay,
          category,
          color,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        });
      } else {
        await addEvent({
          user_id: user.id,
          title: title.trim(),
          event_date: date,
          start_time: isAllDay ? undefined : startTime,
          end_time: isAllDay ? undefined : endTime,
          is_all_day: isAllDay,
          category,
          color,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        });
      }
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id || !confirm('이 일정을 삭제하시겠습니까?')) return;
    setIsLoading(true);
    try {
      await removeEvent(event.id);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const categoryOptions = Object.entries(CATEGORIES) as [EventCategory, { icon: string; label: string; color: string }][];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? '일정 수정' : '새 일정 추가'}
      footer={
        <>
          {isEditing && (
            <button className="btn btn-ghost" onClick={handleDelete} disabled={isLoading} style={{ flex: 1 }}>
              삭제
            </button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={isLoading} style={{ flex: 2 }}>
            {isLoading ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <div className="input-group">
        <label className="input-label">일정 제목 *</label>
        <input className="input" placeholder="예: 팀 미팅" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div className="input-group">
        <label className="input-label">날짜 *</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div className="checkbox-row" onClick={() => setIsAllDay(!isAllDay)}>
        <div className={`checkbox ${isAllDay ? 'checked' : ''}`}>{isAllDay && '✓'}</div>
        <span>종일 일정</span>
      </div>

      {!isAllDay && (
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">시작</label>
            <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label">종료</label>
            <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
      )}

      <div className="input-group">
        <label className="input-label">카테고리</label>
        <div className="category-chips">
          {categoryOptions.map(([key, config]) => (
            <button
              key={key}
              className={`category-chip ${category === key ? 'selected' : ''}`}
              onClick={() => { setCategory(key); setColor(config.color); }}
            >
              {config.icon} {config.label}
            </button>
          ))}
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">색상</label>
        <div className="color-picker">
          {EVENT_COLORS.map((c) => (
            <div
              key={c}
              className={`color-dot ${color === c ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>

      <div className="input-group">
        <label className="input-label">장소</label>
        <input className="input" placeholder="예: 강남역 스타벅스" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>

      <div className="input-group">
        <label className="input-label">메모</label>
        <textarea
          className="input"
          placeholder="추가 메모"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ minHeight: '80px', resize: 'vertical' }}
        />
      </div>
    </Modal>
  );
};
