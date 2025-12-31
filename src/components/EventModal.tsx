import React, { useState, useEffect } from 'react';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { type CalendarEvent, DEFAULT_CATEGORY_COLOR, CATEGORY_COLORS } from '../types';
import TimePicker from './TimePicker';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | null;
  defaultDate?: string;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  event,
  defaultDate,
}) => {
  const { user } = useAuthStore();
  const { addEvent, editEvent, removeEvent } = useEventStore();
  const { categories, addCategory, getDefaultCategory } = useCategoryStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [categoryId, setCategoryId] = useState('');
  const [location, setLocation] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 새 카테고리 추가용 상태
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  const isEditing = !!event;

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setDescription(event.description || '');
      setEventDate(event.event_date);
      setStartTime(event.start_time || '');
      setEndTime(event.end_time || '');
      setIsAllDay(event.is_all_day);
      setCategoryId(event.category_id || '');
      setLocation(event.location || '');
    } else {
      setTitle('');
      setDescription('');
      setEventDate(defaultDate || new Date().toISOString().split('T')[0]);
      setStartTime('');
      setEndTime('');
      setIsAllDay(false);
      // 기본 카테고리 선택
      const defaultCat = getDefaultCategory();
      setCategoryId(defaultCat?.id || '');
      setLocation('');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLORS[0]);
  }, [event, defaultDate, isOpen, getDefaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !eventDate || !user) return;

    setIsLoading(true);
    try {
      const eventData = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || undefined,
        event_date: eventDate,
        start_time: isAllDay ? undefined : startTime || undefined,
        end_time: isAllDay ? undefined : endTime || undefined,
        is_all_day: isAllDay,
        category_id: categoryId || undefined,
        location: location.trim() || undefined,
        is_completed: event?.is_completed || false,
      };

      if (isEditing && event?.id) {
        await editEvent(event.id, eventData);
      } else {
        await addEvent(eventData);
      }
      onClose();
    } catch (error) {
      console.error('Failed to save event:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event?.id) return;
    if (confirm('이 일정을 삭제하시겠습니까?')) {
      await removeEvent(event.id);
      onClose();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const newCat = await addCategory(newCategoryName.trim(), newCategoryColor);
      setCategoryId(newCat.id);
      setShowNewCategory(false);
      setNewCategoryName('');
      setNewCategoryColor(CATEGORY_COLORS[0]);
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('카테고리 추가에 실패했습니다.');
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEditing ? '일정 수정' : '새 일정'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">일정 제목 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="일정 제목을 입력하세요"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">날짜 *</label>
            <input
              type="date"
              className="form-input"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                padding: '8px 0',
              }}
            >
              <div
                className={`todo-checkbox ${isAllDay ? 'checked' : ''}`}
                onClick={() => setIsAllDay(!isAllDay)}
              />
              <span>종일</span>
            </label>
          </div>

          {!isAllDay && (
            <div className="form-row">
              <div className="form-group">
                <TimePicker
                  label="시작 시간"
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="시작 시간 선택"
                />
              </div>
              <div className="form-group">
                <TimePicker
                  label="종료 시간"
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="종료 시간 선택"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">카테고리</label>
            <div className="category-select">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className={`category-option ${categoryId === cat.id ? 'selected' : ''}`}
                  style={{
                    borderColor: categoryId === cat.id ? cat.color : 'transparent',
                    backgroundColor: categoryId === cat.id ? `${cat.color}20` : undefined,
                  }}
                  onClick={() => setCategoryId(cat.id)}
                >
                  <span
                    className="category-dot"
                    style={{ backgroundColor: cat.color, width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block' }}
                  />
                  <span>{cat.name}</span>
                </div>
              ))}
              <div
                className="category-option add-new"
                onClick={() => setShowNewCategory(true)}
                style={{ borderStyle: 'dashed' }}
              >
                <span>+ 추가</span>
              </div>
            </div>

            {showNewCategory && (
              <div className="new-category-form" style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                <div className="form-group" style={{ marginBottom: '8px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="새 카테고리 이름"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                  />
                </div>
                <div className="color-picker" style={{ marginBottom: '8px' }}>
                  {CATEGORY_COLORS.map((c) => (
                    <div
                      key={c}
                      className={`color-option ${newCategoryColor === c ? 'selected' : ''}`}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewCategoryColor(c)}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-sm btn-primary" onClick={handleAddCategory}>
                    추가
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={() => setShowNewCategory(false)}>
                    취소
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">장소</label>
            <input
              type="text"
              className="form-input"
              placeholder="장소를 입력하세요"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">메모</label>
            <textarea
              className="form-input"
              placeholder="메모를 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          {isEditing && (
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              style={{ marginRight: 'auto' }}
            >
              삭제
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || !eventDate || isLoading}
          >
            {isLoading ? '저장 중...' : isEditing ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};
