import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEventStore } from '../store/eventStore';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore } from '../store/goalStore';
import { useCategoryStore } from '../store/categoryStore';
import type { CalendarEvent, Todo, Goal } from '../types';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEventClick?: (event: CalendarEvent) => void;
  onTodoClick?: (todo: Todo) => void;
  onGoalClick?: (goal: Goal) => void;
}

type SearchResultType = 'event' | 'todo' | 'goal';

interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  date?: string;
  categoryColor?: string;
  item: CalendarEvent | Todo | Goal;
}

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onEventClick,
  onTodoClick,
  onGoalClick,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | SearchResultType>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  const { events } = useEventStore();
  const { todos } = useTodoStore();
  const { goals } = useGoalStore();
  const { getCategoryById } = useCategoryStore();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    if (!isOpen) {
      setQuery('');
      setFilter('all');
    }
  }, [isOpen]);

  // 키보드 단축키 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    // 일정 검색
    if (filter === 'all' || filter === 'event') {
      events.forEach((event) => {
        if (!event.id) return; // id가 없는 항목은 건너뜀

        const matchTitle = event.title.toLowerCase().includes(lowerQuery);
        const matchDescription = event.description?.toLowerCase().includes(lowerQuery);
        const matchLocation = event.location?.toLowerCase().includes(lowerQuery);

        if (matchTitle || matchDescription || matchLocation) {
          const category = event.category_id ? getCategoryById(event.category_id) : null;
          results.push({
            type: 'event',
            id: event.id,
            title: event.title,
            subtitle: formatEventDate(event.event_date, event.start_time),
            date: event.event_date,
            categoryColor: category?.color,
            item: event,
          });
        }
      });
    }

    // TODO 검색
    if (filter === 'all' || filter === 'todo') {
      todos.forEach((todo) => {
        if (!todo.id) return; // id가 없는 항목은 건너뜀

        const matchTitle = todo.title.toLowerCase().includes(lowerQuery);
        const matchDescription = todo.description?.toLowerCase().includes(lowerQuery);

        if (matchTitle || matchDescription) {
          results.push({
            type: 'todo',
            id: todo.id,
            title: todo.title,
            subtitle: todo.due_date ? `마감: ${formatDate(todo.due_date)}` : '마감일 없음',
            date: todo.due_date,
            item: todo,
          });
        }
      });
    }

    // Goal 검색
    if (filter === 'all' || filter === 'goal') {
      goals.forEach((goal) => {
        if (!goal.id) return; // id가 없는 항목은 건너뜀

        const matchTitle = goal.title.toLowerCase().includes(lowerQuery);
        const matchDescription = goal.description?.toLowerCase().includes(lowerQuery);

        if (matchTitle || matchDescription) {
          results.push({
            type: 'goal',
            id: goal.id,
            title: goal.title,
            subtitle: `진행률 ${goal.progress}%`,
            item: goal,
          });
        }
      });
    }

    // 날짜순 정렬 (최신순)
    return results.sort((a, b) => {
      if (!a.date && !b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return b.date.localeCompare(a.date);
    });
  }, [query, filter, events, todos, goals, getCategoryById]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'event':
        onEventClick?.(result.item as CalendarEvent);
        break;
      case 'todo':
        onTodoClick?.(result.item as Todo);
        break;
      case 'goal':
        onGoalClick?.(result.item as Goal);
        break;
    }
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${month}월 ${day}일`;
  };

  const formatEventDate = (dateStr: string, timeStr?: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    let result = `${month}월 ${day}일`;
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const ampm = hours < 12 ? '오전' : '오후';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      result += ` ${ampm} ${displayHours}:${minutes.toString().padStart(2, '0')}`;
    }
    return result;
  };

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'event':
        return '일정';
      case 'todo':
        return '할 일';
      case 'goal':
        return '목표';
    }
  };

  const getTypeIcon = (type: SearchResultType) => {
    switch (type) {
      case 'event':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        );
      case 'todo':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'goal':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="8" cy="8" r="1" fill="currentColor"/>
          </svg>
        );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay search-modal-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <div className="search-input-wrapper">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="일정, 할 일, 목표 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4l-8 8M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
          <div className="search-filters">
            <button
              className={`search-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              전체
            </button>
            <button
              className={`search-filter-btn ${filter === 'event' ? 'active' : ''}`}
              onClick={() => setFilter('event')}
            >
              일정
            </button>
            <button
              className={`search-filter-btn ${filter === 'todo' ? 'active' : ''}`}
              onClick={() => setFilter('todo')}
            >
              할 일
            </button>
            <button
              className={`search-filter-btn ${filter === 'goal' ? 'active' : ''}`}
              onClick={() => setFilter('goal')}
            >
              목표
            </button>
          </div>
        </div>

        <div className="search-modal-body">
          {query.trim() === '' ? (
            <div className="search-empty">
              <p>검색어를 입력하세요</p>
              <p className="search-hint">Tip: Ctrl+K 로 빠르게 검색할 수 있습니다</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="search-empty">
              <p>"{query}"에 대한 검색 결과가 없습니다</p>
            </div>
          ) : (
            <div className="search-results">
              {searchResults.map((result) => (
                <div
                  key={`${result.type}-${result.id}`}
                  className="search-result-item"
                  onClick={() => handleResultClick(result)}
                >
                  <div className="search-result-icon" style={{ color: result.categoryColor || 'var(--text-muted)' }}>
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="search-result-content">
                    <div className="search-result-title">{result.title}</div>
                    <div className="search-result-subtitle">{result.subtitle}</div>
                  </div>
                  <span className="search-result-type">{getTypeLabel(result.type)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="search-modal-footer">
          <span className="search-shortcut">
            <kbd>Esc</kbd> 닫기
          </span>
          <span className="search-result-count">
            {query.trim() && `${searchResults.length}개 결과`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
