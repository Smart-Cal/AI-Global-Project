import React, { useState } from 'react';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { type Goal, DEFAULT_CATEGORY_COLOR } from '../types';

interface GoalsViewProps {
  onAddGoal: () => void;
}

// Goal이 활성 상태인지 확인 (completed, failed가 아닌 경우)
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
}

export const GoalsView: React.FC<GoalsViewProps> = ({ onAddGoal }) => {
  const { user } = useAuthStore();
  const { goals, recalculateProgress, deleteGoal } = useGoalStore();
  const { todos } = useTodoStore();
  const { getCategoryById } = useCategoryStore();
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const activeGoals = goals.filter(isGoalActive);
  const completedGoals = goals.filter((g) => !isGoalActive(g) || calculateGoalProgress(g) >= 100);

  const getGoalTodos = (goalId: string) => {
    return todos.filter((t) => t.goal_id === goalId);
  };

  const handleProgressRecalculate = (goalId: string) => {
    recalculateProgress(goalId);
  };

  const handleDeleteGoal = (goalId: string) => {
    if (confirm('이 목표를 삭제하시겠습니까?')) {
      deleteGoal(goalId);
      setSelectedGoal(null);
    }
  };

  return (
    <div className="goals-container">
      <div className="goals-header">
        <h1 className="goals-title">내 목표</h1>
        <button className="btn btn-primary" onClick={onAddGoal}>
          + 새 목표
        </button>
      </div>

      {activeGoals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">아직 목표가 없어요</div>
          <div className="empty-state-text">
            목표를 설정하면 AI가 맞춤형 일정과 실천 방법을 추천해 드려요
          </div>
          <button className="btn btn-primary" onClick={onAddGoal}>
            첫 목표 설정하기
          </button>
        </div>
      ) : (
        <div>
          <div className="todo-section">
            <div className="todo-section-header">
              <div className="todo-section-title">
                <span>진행 중</span>
                <span className="todo-count">{activeGoals.length}</span>
              </div>
            </div>

            {activeGoals.map((goal) => {
              const category = goal.category_id ? getCategoryById(goal.category_id) : null;
              const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
              const categoryName = category?.name || '기본';
              const goalTodos = getGoalTodos(goal.id!);
              const completedTodos = goalTodos.filter((t) => t.is_completed).length;

              return (
                <div
                  key={goal.id}
                  className="goal-card"
                  onClick={() => setSelectedGoal(goal)}
                >
                  <div className="goal-card-header">
                    <span
                      className="goal-card-category-badge"
                      style={{
                        backgroundColor: categoryColor,
                        color: '#fff',
                        padding: '4px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                      }}
                    >
                      {categoryName}
                    </span>
                    <div className="goal-card-info">
                      <div className="goal-card-title">{goal.title}</div>
                    </div>
                    <div className={`goal-card-priority ${goal.priority}`}>
                      {goal.priority === 'high' && '높음'}
                      {goal.priority === 'medium' && '보통'}
                      {goal.priority === 'low' && '낮음'}
                    </div>
                  </div>

                  {goal.description && (
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      {goal.description}
                    </p>
                  )}

                  <div className="goal-progress-bar">
                    <div
                      className="goal-progress-fill"
                      style={{
                        width: `${calculateGoalProgress(goal)}%`,
                        backgroundColor: categoryColor,
                      }}
                    />
                  </div>

                  <div className="goal-progress-text">
                    <span>{calculateGoalProgress(goal)}% 완료</span>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {goalTodos.length > 0 && (
                        <span>할 일: {completedTodos}/{goalTodos.length}</span>
                      )}
                      {goal.target_date && <span>목표일: {goal.target_date}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {completedGoals.length > 0 && (
            <div className="todo-section">
              <div className="todo-section-header">
                <div className="todo-section-title">
                  <span>완료됨</span>
                  <span className="todo-count">{completedGoals.length}</span>
                </div>
              </div>

              {completedGoals.map((goal) => {
                const category = goal.category_id ? getCategoryById(goal.category_id) : null;
                const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
                const categoryName = category?.name || '기본';
                return (
                  <div
                    key={goal.id}
                    className="goal-card"
                    style={{ opacity: 0.7 }}
                  >
                    <div className="goal-card-header">
                      <span
                        className="goal-card-category-badge"
                        style={{
                          backgroundColor: categoryColor,
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '4px',
                          fontSize: '12px',
                        }}
                      >
                        {categoryName}
                      </span>
                      <div className="goal-card-info">
                        <div className="goal-card-title">{goal.title}</div>
                      </div>
                    </div>
                    <div className="goal-progress-bar">
                      <div
                        className="goal-progress-fill"
                        style={{ width: '100%', backgroundColor: '#0F7B6C' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Goal Detail Modal */}
      {selectedGoal && (
        <div className="modal-overlay" onClick={() => setSelectedGoal(null)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {(() => {
                  const cat = selectedGoal.category_id ? getCategoryById(selectedGoal.category_id) : null;
                  return (
                    <>
                      <span
                        style={{
                          backgroundColor: cat?.color || DEFAULT_CATEGORY_COLOR,
                          color: '#fff',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          marginRight: '8px',
                        }}
                      >
                        {cat?.name || '기본'}
                      </span>
                      {selectedGoal.title}
                    </>
                  );
                })()}
              </div>
              <button className="modal-close" onClick={() => setSelectedGoal(null)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {selectedGoal.description && (
                <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                  {selectedGoal.description}
                </p>
              )}

              <div className="form-group">
                <label className="form-label">진행률</label>
                <div className="goal-progress-bar" style={{ marginTop: '8px' }}>
                  <div
                    className="goal-progress-fill"
                    style={{
                      width: `${calculateGoalProgress(selectedGoal)}%`,
                      backgroundColor: 'var(--primary-color)',
                    }}
                  />
                </div>
                <div style={{ textAlign: 'center', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{calculateGoalProgress(selectedGoal)}%</span>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleProgressRecalculate(selectedGoal.id!)}
                  >
                    진행률 재계산
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div className="form-label">관련 할 일</div>
                {getGoalTodos(selectedGoal.id!).length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <div className="empty-state-text">이 목표와 연결된 할 일이 없어요</div>
                  </div>
                ) : (
                  <div className="todo-list">
                    {getGoalTodos(selectedGoal.id!).map((todo) => (
                      <div key={todo.id} className={`todo-item ${todo.is_completed ? 'completed' : ''}`}>
                        <div className={`todo-checkbox ${todo.is_completed ? 'checked' : ''}`} />
                        <div className="todo-content">
                          <div className="todo-title">{todo.title}</div>
                          {todo.deadline && (
                            <div className="todo-meta">
                              <span>기한: {todo.deadline.split('T')[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-danger"
                onClick={() => handleDeleteGoal(selectedGoal.id!)}
              >
                삭제
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedGoal(null)}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
