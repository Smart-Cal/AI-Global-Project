import React, { useState, useEffect } from 'react';
import { useGoalStore } from '../store/goalStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { type Goal, CATEGORY_COLORS } from '../types';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingGoal?: Goal | null;
}

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose, editingGoal }) => {
  const { user } = useAuthStore();
  const { addGoal, updateGoal } = useGoalStore();
  const { categories, addCategory, getDefaultCategory } = useCategoryStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [targetDate, setTargetDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 새 카테고리 추가용 상태
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setDescription(editingGoal.description || '');
      setCategoryId(editingGoal.category_id || '');
      setPriority(editingGoal.priority);
      setTargetDate(editingGoal.target_date || '');
    } else {
      setTitle('');
      setDescription('');
      const defaultCat = getDefaultCategory();
      setCategoryId(defaultCat?.id || '');
      setPriority('medium');
      setTargetDate('');
    }
    setShowNewCategory(false);
    setNewCategoryName('');
    setNewCategoryColor(CATEGORY_COLORS[0]);
  }, [editingGoal, isOpen, getDefaultCategory]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!title.trim() || !user) return;

    setIsLoading(true);
    try {
      if (editingGoal?.id) {
        await updateGoal(editingGoal.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          category_id: categoryId || undefined,
          priority,
          target_date: targetDate || undefined,
        });
      } else {
        await addGoal({
          user_id: user.id,
          title: title.trim(),
          description: description.trim() || undefined,
          category_id: categoryId || undefined,
          priority,
          target_date: targetDate || undefined,
          progress: 0,
          is_active: true,
        });
      }
      onClose();
    } catch (error) {
      console.error('Failed to save goal:', error);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{editingGoal ? '목표 수정' : '새 목표'}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">목표 이름 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="예: 토익 900점 달성, 10kg 감량"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">설명</label>
            <textarea
              className="form-input"
              placeholder="목표에 대한 상세 설명을 입력하세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

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
            <label className="form-label">우선순위</label>
            <div className="priority-select">
              <div
                className={`priority-option ${priority === 'high' ? 'selected high' : ''}`}
                onClick={() => setPriority('high')}
              >
                높음
              </div>
              <div
                className={`priority-option ${priority === 'medium' ? 'selected medium' : ''}`}
                onClick={() => setPriority('medium')}
              >
                보통
              </div>
              <div
                className={`priority-option ${priority === 'low' ? 'selected low' : ''}`}
                onClick={() => setPriority('low')}
              >
                낮음
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">목표 달성일</label>
            <input
              type="date"
              className="form-input"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title.trim() || isLoading}
          >
            {isLoading ? '저장 중...' : editingGoal ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
};
