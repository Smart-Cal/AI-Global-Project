import React, { useState } from 'react';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useAuthStore } from '../store/authStore';
import { useCategoryStore } from '../store/categoryStore';
import { type Goal, DEFAULT_CATEGORY_COLOR } from '../types';

interface GoalsViewProps {
  onAddGoal: () => void;
}

// Check if Goal is active (not completed or failed)
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
    if (confirm('Are you sure you want to delete this goal?')) {
      deleteGoal(goalId);
      setSelectedGoal(null);
    }
  };

  return (
    <div className="goals-container">
      <div className="goals-header">
        <h1 className="goals-title">My Goals</h1>
        <button className="btn btn-primary" onClick={onAddGoal}>
          + New Goal
        </button>
      </div>

      {activeGoals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No goals yet</div>
          <div className="empty-state-text">
            Set a goal and AI will recommend personalized schedules and action plans
          </div>
          <button className="btn btn-primary" onClick={onAddGoal}>
            Set your first goal
          </button>
        </div>
      ) : (
        <div>
          <div className="todo-section">
            <div className="todo-section-header">
              <div className="todo-section-title">
                <span>In Progress</span>
                <span className="todo-count">{activeGoals.length}</span>
              </div>
            </div>

            {activeGoals.map((goal) => {
              const category = goal.category_id ? getCategoryById(goal.category_id) : null;
              const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
              const categoryName = category?.name || 'Default';
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
                      {goal.priority === 'high' && 'High'}
                      {goal.priority === 'medium' && 'Medium'}
                      {goal.priority === 'low' && 'Low'}
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
                    <span>{calculateGoalProgress(goal)}% Completed</span>
                    <div style={{ display: 'flex', gap: '16px' }}>
                      {goalTodos.length > 0 && (
                        <span>Todos: {completedTodos}/{goalTodos.length}</span>
                      )}
                      {goal.target_date && <span>Target Date: {goal.target_date}</span>}
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
                  <span>Completed</span>
                  <span className="todo-count">{completedGoals.length}</span>
                </div>
              </div>

              {completedGoals.map((goal) => {
                const category = goal.category_id ? getCategoryById(goal.category_id) : null;
                const categoryColor = category?.color || DEFAULT_CATEGORY_COLOR;
                const categoryName = category?.name || 'Default';
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
                        {cat?.name || 'Default'}
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
                <label className="form-label">Progress</label>
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
                    Recalculate Progress
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '20px' }}>
                <div className="form-label">Related Todos</div>
                {getGoalTodos(selectedGoal.id!).length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px' }}>
                    <div className="empty-state-text">No todos linked to this goal</div>
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
                              <span>Due: {todo.deadline.split('T')[0]}</span>
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
                Delete
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedGoal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
