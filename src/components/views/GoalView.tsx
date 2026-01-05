import React, { useState, useEffect, useRef } from 'react';
import { useGoalStore, calculateGoalProgress } from '../../store/goalStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useTodoStore } from '../../store/todoStore';
import { useConfirm } from '../ConfirmModal';
import { DEFAULT_CATEGORY_COLOR, type Goal } from '../../types';
import GoalDecomposition from '../GoalDecomposition';

// Check if goal is active
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
}

interface GoalViewProps {
  onGoalClick: (goal: Goal) => void;
  onAddGoal: () => void;
}

const GoalView: React.FC<GoalViewProps> = ({ onGoalClick, onAddGoal }) => {
  const { goals, fetchGoals, updateGoal, deleteGoal } = useGoalStore();
  const { getCategoryById } = useCategoryStore();
  const { getTodosByGoal } = useTodoStore();
  const { confirm } = useConfirm();

  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [showFilter, setShowFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [decomposeGoal, setDecomposeGoal] = useState<Goal | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchGoals();
  }, []);

  const getFilteredGoals = () => {
    switch (showFilter) {
      case 'active':
        return goals.filter(g => isGoalActive(g) && calculateGoalProgress(g) < 100);
      case 'completed':
        return goals.filter(g => calculateGoalProgress(g) >= 100 || !isGoalActive(g));
      default:
        return goals;
    }
  };

  const filteredGoals = getFilteredGoals();

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return { text: 'High', color: '#FF6B6B' };
      case 'medium': return { text: 'Medium', color: '#FECA57' };
      case 'low': return { text: 'Low', color: '#1DD1A1' };
      default: return { text: 'Medium', color: '#FECA57' };
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
    if (diff < 0) return { text: `${Math.abs(diff)} days overdue`, isOverdue: true };
    if (diff === 0) return { text: 'Due today', isOverdue: false };
    return { text: `${diff} days left`, isOverdue: false };
  };

  // Progress is automatically calculated based on Todo completion - manual update removed

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      console.log('Selected files for goal:', files);
    }
  };

  return (
    <div className="goal-view">
      <div className="goal-header">
        <h2>Goal</h2>
        <button className="btn btn-primary" onClick={onAddGoal}>
          + New Goal
        </button>
      </div>

      <div className="goal-filter-tabs">
        <button
          className={`goal-filter-tab ${showFilter === 'all' ? 'active' : ''}`}
          onClick={() => setShowFilter('all')}
        >
          All ({goals.length})
        </button>
        <button
          className={`goal-filter-tab ${showFilter === 'active' ? 'active' : ''}`}
          onClick={() => setShowFilter('active')}
        >
          Active ({goals.filter(g => isGoalActive(g) && calculateGoalProgress(g) < 100).length})
        </button>
        <button
          className={`goal-filter-tab ${showFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setShowFilter('completed')}
        >
          Completed ({goals.filter(g => calculateGoalProgress(g) >= 100 || !isGoalActive(g)).length})
        </button>
      </div>

      <div className="goal-content">
        <div className="goal-list">
          {filteredGoals.length === 0 ? (
            <div className="goal-empty">
              <p>No goals found</p>
              <button className="btn btn-primary" onClick={onAddGoal}>
                Set your first goal
              </button>
            </div>
          ) : (
            filteredGoals.map(goal => {
              const category = goal.category_id ? getCategoryById(goal.category_id) : null;
              const priority = getPriorityLabel(goal.priority);
              const daysRemaining = getDaysRemaining(goal.target_date);
              const isSelected = selectedGoal?.id === goal.id;
              const linkedTodos = goal.id ? getTodosByGoal(goal.id) : [];
              const completedTodos = linkedTodos.filter(t => t.is_completed);

              return (
                <div
                  key={goal.id}
                  className={`goal-card ${isSelected ? 'selected' : ''} ${calculateGoalProgress(goal) >= 100 ? 'completed' : ''}`}
                  onClick={() => setSelectedGoal(goal)}
                >
                  <div className="goal-card-header">
                    <div
                      className="goal-card-category"
                      style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
                    >
                      {category?.name || 'Default'}
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
                          width: `${calculateGoalProgress(goal)}%`,
                          backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR
                        }}
                      />
                    </div>
                    <span className="goal-progress-text">{calculateGoalProgress(goal)}%</span>
                  </div>

                  {/* Display Linked Todos */}
                  {linkedTodos.length > 0 && (
                    <div className="goal-card-todos">
                      <span className="todo-count">
                        ✓ {completedTodos.length}/{linkedTodos.length} tasks
                      </span>
                    </div>
                  )}

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
              <div className="goal-detail-section">
                <h4>Description</h4>
                <p>{selectedGoal.description || 'No description'}</p>
              </div>

              <div className="goal-detail-section">
                <h4>Progress</h4>
                <div className="goal-detail-progress">
                  <div className="goal-progress-bar" style={{ flex: 1 }}>
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: `${calculateGoalProgress(selectedGoal)}%`,
                        backgroundColor: 'var(--primary-color)'
                      }}
                    />
                  </div>
                  <span>{calculateGoalProgress(selectedGoal)}%</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Progress is automatically calculated based on linked Todo completion
                </p>
              </div>

              {selectedGoal.target_date && (
                <div className="goal-detail-section">
                  <h4>Target Date</h4>
                  <p>{formatDate(selectedGoal.target_date)}</p>
                </div>
              )}

              <div className="goal-detail-section">
                <h4>Attachments</h4>
                <div className="goal-attachments">
                  <button className="goal-attachment-add" onClick={handleFileUpload}>
                    <span>+</span>
                    <span>Add File</span>
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

              <div className="goal-detail-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => setDecomposeGoal(selectedGoal)}
                >
                  Decompose Goal
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => onGoalClick(selectedGoal)}
                >
                  Edit
                </button>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (selectedGoal.id) {
                      const confirmed = await confirm({
                        title: 'Delete Goal',
                        message: 'Are you sure you want to delete this goal?',
                        confirmText: 'Delete',
                        confirmVariant: 'danger'
                      });
                      if (confirmed) {
                        await deleteGoal(selectedGoal.id);
                        setSelectedGoal(null);
                      }
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Goal Decomposition Modal */}
      {decomposeGoal && (
        <GoalDecomposition
          goal={decomposeGoal}
          onClose={() => setDecomposeGoal(null)}
        />
      )}
    </div>
  );
};

export default GoalView;
