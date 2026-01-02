import React, { useState } from 'react';
import { useGoalStore } from '../store/goalStore';
import { useTodoStore } from '../store/todoStore';
import { useCategoryStore } from '../store/categoryStore';
import type { Goal, Todo } from '../types';
import { useToast } from './Toast';

interface GoalDecompositionProps {
  goal: Goal;
  onClose: () => void;
}

interface DecomposedTodo {
  title: string;
  duration: number;
  order: number;
  isSelected: boolean;
}

const GoalDecomposition: React.FC<GoalDecompositionProps> = ({ goal, onClose }) => {
  const { showToast } = useToast();
  const { updateGoal } = useGoalStore();
  const { addTodo, getTodosByGoal } = useTodoStore();
  const { categories } = useCategoryStore();

  const [isLoading, setIsLoading] = useState(false);
  const [decomposedTodos, setDecomposedTodos] = useState<DecomposedTodo[]>([]);
  const [strategy, setStrategy] = useState('');
  const [activityType, setActivityType] = useState('공부');
  const [hasDecomposed, setHasDecomposed] = useState(false);

  // Goal에 연결된 기존 Todo들
  const existingTodos = goal.id ? getTodosByGoal(goal.id) : [];

  const activityTypes = [
    { value: '공부', label: '공부/학습' },
    { value: '운동', label: '운동/건강' },
    { value: '프로젝트', label: '프로젝트' },
    { value: '자격증', label: '자격증/시험' },
    { value: '기타', label: '기타' },
  ];

  const handleDecompose = async () => {
    if (!goal.target_date) {
      showToast('목표 날짜를 먼저 설정해주세요', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const token = localStorage.getItem('palm_auth_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: `목표를 분해해줘: ${goal.title}`,
          mode: 'goal',
          conversation_history: [],
        }),
      });

      if (!response.ok) {
        throw new Error('API 호출 실패');
      }

      // 간단한 분해 로직 (백엔드 응답 대신 클라이언트에서 처리)
      const strategies: Record<string, { steps: string[]; durations: number[] }> = {
        '공부': {
          steps: ['개념 학습', '연습 문제 풀이', '복습', '모의 테스트'],
          durations: [90, 60, 45, 60]
        },
        '운동': {
          steps: ['워밍업', '본 운동', '쿨다운', '스트레칭'],
          durations: [10, 40, 10, 15]
        },
        '프로젝트': {
          steps: ['기획 및 설계', '구현', '테스트', '리뷰 및 개선'],
          durations: [60, 120, 60, 30]
        },
        '자격증': {
          steps: ['이론 공부', '기출문제 풀이', '오답 노트 정리', '모의고사'],
          durations: [90, 60, 30, 60]
        },
        '기타': {
          steps: ['준비', '실행', '정리', '검토'],
          durations: [30, 60, 20, 15]
        }
      };

      const selectedStrategy = strategies[activityType] || strategies['기타'];

      const todos = selectedStrategy.steps.map((step, index) => ({
        title: `${goal.title} - ${step}`,
        duration: selectedStrategy.durations[index],
        order: index + 1,
        isSelected: true,
      }));

      // D-day 계산
      const today = new Date();
      const target = new Date(goal.target_date);
      const daysUntilTarget = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let frequency = '';
      if (daysUntilTarget <= 7) {
        frequency = '매일';
      } else if (daysUntilTarget <= 30) {
        frequency = '주 3-4회';
      } else {
        frequency = '주 2-3회';
      }

      setDecomposedTodos(todos);
      setStrategy(`${goal.title}을 위해 ${frequency} ${todos.length}단계로 진행하는 것을 추천합니다. (D-${daysUntilTarget})`);
      setHasDecomposed(true);
      showToast('목표가 세부 작업으로 분해되었습니다', 'success');
    } catch (error) {
      console.error('Failed to decompose goal:', error);
      showToast('목표 분해에 실패했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTodo = (index: number) => {
    setDecomposedTodos(prev =>
      prev.map((todo, i) =>
        i === index ? { ...todo, isSelected: !todo.isSelected } : todo
      )
    );
  };

  const handleCreateTodos = async () => {
    const selectedTodos = decomposedTodos.filter(t => t.isSelected);
    if (selectedTodos.length === 0) {
      showToast('최소 하나의 작업을 선택해주세요', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      for (const todo of selectedTodos) {
        await addTodo({
          user_id: goal.user_id,
          goal_id: goal.id,
          title: todo.title,
          description: `${goal.title} 목표의 세부 작업`,
          priority: goal.priority,
          is_recurring: false,
        });
      }
      showToast(`${selectedTodos.length}개의 작업이 생성되었습니다`, 'success');
      onClose();
    } catch (error) {
      console.error('Failed to create todos:', error);
      showToast('작업 생성에 실패했습니다', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#FF6B6B';
      case 'medium': return '#FECA57';
      case 'low': return '#1DD1A1';
      default: return '#9CA3AF';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}분`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">목표 분해</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Goal 정보 */}
          <div className="goal-decompose-header">
            <h3>{goal.title}</h3>
            {goal.description && <p className="goal-description">{goal.description}</p>}
            <div className="goal-meta">
              <span
                className="goal-priority-badge"
                style={{ backgroundColor: getPriorityColor(goal.priority) }}
              >
                {goal.priority === 'high' ? '높음' : goal.priority === 'medium' ? '중간' : '낮음'}
              </span>
              {goal.target_date && (
                <span className="goal-target-date">
                  목표일: {new Date(goal.target_date).toLocaleDateString('ko-KR')}
                </span>
              )}
              <span className="goal-progress-badge">
                진행률: {goal.progress}%
              </span>
            </div>
          </div>

          {/* 기존 연결된 Todo */}
          {existingTodos.length > 0 && (
            <div className="goal-existing-todos">
              <h4>연결된 작업 ({existingTodos.length})</h4>
              <div className="existing-todo-list">
                {existingTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className={`existing-todo-item ${todo.is_completed ? 'completed' : ''}`}
                  >
                    <span className={`todo-status ${todo.is_completed ? 'done' : ''}`}>
                      {todo.is_completed ? '✓' : '○'}
                    </span>
                    <span className="todo-title">{todo.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 활동 유형 선택 */}
          {!hasDecomposed && (
            <div className="goal-decompose-options">
              <h4>활동 유형 선택</h4>
              <div className="activity-type-selector">
                {activityTypes.map((type) => (
                  <button
                    key={type.value}
                    className={`activity-type-btn ${activityType === type.value ? 'active' : ''}`}
                    onClick={() => setActivityType(type.value)}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 분해 결과 */}
          {hasDecomposed && (
            <div className="goal-decompose-result">
              <div className="decompose-strategy">
                <span className="strategy-icon">💡</span>
                <p>{strategy}</p>
              </div>

              <h4>생성할 세부 작업</h4>
              <div className="decomposed-todo-list">
                {decomposedTodos.map((todo, index) => (
                  <div
                    key={index}
                    className={`decomposed-todo-item ${todo.isSelected ? 'selected' : ''}`}
                    onClick={() => handleToggleTodo(index)}
                  >
                    <div className="todo-checkbox-wrapper">
                      <div className={`todo-checkbox ${todo.isSelected ? 'checked' : ''}`} />
                    </div>
                    <div className="todo-content">
                      <span className="todo-order">{todo.order}.</span>
                      <span className="todo-title">{todo.title}</span>
                    </div>
                    <span className="todo-duration">{formatDuration(todo.duration)}</span>
                  </div>
                ))}
              </div>

              <div className="decompose-summary">
                <span>선택된 작업: {decomposedTodos.filter(t => t.isSelected).length}개</span>
                <span>총 소요 시간: {formatDuration(
                  decomposedTodos.filter(t => t.isSelected).reduce((sum, t) => sum + t.duration, 0)
                )}</span>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>
          {!hasDecomposed ? (
            <button
              className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
              onClick={handleDecompose}
              disabled={isLoading || !goal.target_date}
            >
              {isLoading ? '분해 중...' : '목표 분해하기'}
            </button>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setHasDecomposed(false)}
              >
                다시 분해
              </button>
              <button
                className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                onClick={handleCreateTodos}
                disabled={isLoading || decomposedTodos.filter(t => t.isSelected).length === 0}
              >
                {isLoading ? '생성 중...' : '작업 생성'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GoalDecomposition;
