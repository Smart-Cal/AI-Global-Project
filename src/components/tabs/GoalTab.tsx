import React, { useState, useEffect, useRef } from 'react';
import { useGoalStore } from '../../store/goalStore';
import { useCategoryStore } from '../../store/categoryStore';
import { DEFAULT_CATEGORY_COLOR, type Goal } from '../../types';

interface GoalTabProps {
  onGoalClick: (goal: Goal) => void;
  onAddGoal: () => void;
}

const GoalTab: React.FC<GoalTabProps> = ({ onGoalClick, onAddGoal }) => {
  const { goals, fetchGoals, updateGoal, deleteGoal } = useGoalStore();
  const { getCategoryById } = useCategoryStore();

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showFilter, setShowFilter] = useState<'all' | 'active' | 'completed'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  const getFilteredGoals = () => {
    switch (showFilter) {
      case 'active':
        return goals.filter(g => g.is_active && g.progress < 100);
      case 'completed':
        return goals.filter(g => g.progress >= 100 || !g.is_active);
      default:
        return goals;
    }
  };

  const filteredGoals = getFilteredGoals();

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return { text: '높음', color: '#FF6B6B' };
      case 'medium': return { text: '중간', color: '#FECA57' };
      case 'low': return { text: '낮음', color: '#1DD1A1' };
      default: return { text: '중간', color: '#FECA57' };
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  };

  const getDaysRemaining = (targetDate?: string) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}일 지남`, isOverdue: true };
    if (diff === 0) return { text: '오늘까지', isOverdue: false };
    return { text: `${diff}일 남음`, isOverdue: false };
  };

  const handleProgressChange = async (goalId: string, newProgress: number) => {
    await updateGoal(goalId, { progress: newProgress });
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // TODO: Handle file upload for goal
      console.log('Selected files for goal:', files);
    }
  };

  return (
    <div className="goal-tab">
      {/* Header */}
      <div className="goal-header">
        <h2>Goal</h2>
        <button className="btn btn-primary" onClick={onAddGoal}>
          + 새 목표
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="goal-filter-tabs">
        <button
          className={`goal-filter-tab ${showFilter === 'all' ? 'active' : ''}`}
          onClick={() => setShowFilter('all')}
        >
          전체 ({goals.length})
        </button>
        <button
          className={`goal-filter-tab ${showFilter === 'active' ? 'active' : ''}`}
          onClick={() => setShowFilter('active')}
        >
          진행중 ({goals.filter(g => g.is_active && g.progress < 100).length})
        </button>
        <button
          className={`goal-filter-tab ${showFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setShowFilter('completed')}
        >
          완료 ({goals.filter(g => g.progress >= 100 || !g.is_active).length})
        </button>
      </div>

      {/* Goals Content */}
      <div className="goal-content">
        {/* Goals List */}
        <div className="goal-list">
          {filteredGoals.length === 0 ? (
            <div className="goal-empty">
              <p>목표가 없습니다</p>
              <button className="btn btn-primary" onClick={onAddGoal}>
                첫 번째 목표 설정하기
              </button>
            </div>
          ) : (
            filteredGoals.map(goal => {
              const category = goal.category_id ? getCategoryById(goal.category_id) : null;
              const priority = getPriorityLabel(goal.priority);
              const daysRemaining = getDaysRemaining(goal.target_date);
              const isSelected = selectedGoal?.id === goal.id;

              return (
                <div
                  key={goal.id}
                  className={`goal-card ${isSelected ? 'selected' : ''} ${goal.progress >= 100 ? 'completed' : ''}`}
                  onClick={() => setSelectedGoal(goal)}
                >
                  <div className="goal-card-header">
                    <div
                      className="goal-card-category"
                      style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                    >
                      {category?.name || '기본'}
                    </div>
                    <div
                      className="goal-card-priority"
                      style={{ color: priority.color }}
                    >
                      {priority.text}
                    </div>
                  </div>

                  <h3 className="goal-card-title">{goal.title}</h3>

                  {goal.description && (
                    <p className="goal-card-description">{goal.description}</p>
                  )}

                  <div className="goal-card-progress">
                    <div className="goal-progress-bar">
                      <div
                        className="goal-progress-fill"
                        style={{
                          width: `${goal.progress}%`,
                          backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR
                        }}
                      />
                    </div>
                    <span className="goal-progress-text">{goal.progress}%</span>
                  </div>

                  <div className="goal-card-footer">
                    {goal.target_date && (
                      <span className={`goal-card-date ${daysRemaining?.isOverdue ? 'overdue' : ''}`}>
                        {formatDate(goal.target_date)}
                        {daysRemaining && ` (${daysRemaining.text})`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Goal Detail Panel */}
        {selectedGoal && (
          <div className="goal-detail-panel">
            <div className="goal-detail-header">
              <h3>{selectedGoal.title}</h3>
              <button
                className="goal-detail-close"
                onClick={() => setSelectedGoal(null)}
              >
                ×
              </button>
            </div>

            <div className="goal-detail-content">
              {/* Description */}
              <div className="goal-detail-section">
                <h4>설명</h4>
                <p>{selectedGoal.description || '설명이 없습니다'}</p>
              </div>

              {/* Progress */}
              <div className="goal-detail-section">
                <h4>진행률</h4>
                <div className="goal-detail-progress">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={selectedGoal.progress}
                    onChange={(e) => {
                      if (selectedGoal.id) {
                        handleProgressChange(selectedGoal.id, parseInt(e.target.value));
                      }
                    }}
                  />
                  <span>{selectedGoal.progress}%</span>
                </div>
              </div>

              {/* Target Date */}
              {selectedGoal.target_date && (
                <div className="goal-detail-section">
                  <h4>목표 날짜</h4>
                  <p>{formatDate(selectedGoal.target_date)}</p>
                </div>
              )}

              {/* Attachments */}
              <div className="goal-detail-section">
                <h4>첨부 파일</h4>
                <div className="goal-attachments">
                  <button className="goal-attachment-add" onClick={handleFileUpload}>
                    <span>+</span>
                    <span>파일 추가</span>
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  multiple
                  accept="image/*,.pdf,.doc,.docx"
                />
              </div>

              {/* Actions */}
              <div className="goal-detail-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => onGoalClick(selectedGoal)}
                >
                  편집
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (selectedGoal.id && window.confirm('정말 삭제하시겠습니까?')) {
                      await deleteGoal(selectedGoal.id);
                      setSelectedGoal(null);
                    }
                  }}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GoalTab;
