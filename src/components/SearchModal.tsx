import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEventStore } from '../store/eventStore';
import { useTodoStore } from '../store/todoStore';
import { useGoalStore, calculateGoalProgress } from '../store/goalStore';
import { useCategoryStore } from '../store/categoryStore';
import type { CalendarEvent, Todo, Goal } from '../types';

// Extract date from deadline
function getDeadlineDate(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  return deadline.split('T')[0];
}

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

  // Handle keyboard shortcuts
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

    // Search Events
    if (filter === 'all' || filter === 'event') {
      events.forEach((event) => {
        if (!event.id) return; // Skip items without ID

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

    // Search Todos
    if (filter === 'all' || filter === 'todo') {
      todos.forEach((todo) => {
        if (!todo.id) return; // Skip items without ID

        const matchTitle = todo.title.toLowerCase().includes(lowerQuery);
        const matchDescription = todo.description?.toLowerCase().includes(lowerQuery);

        if (matchTitle || matchDescription) {
          const deadlineDate = getDeadlineDate(todo.deadline);
          results.push({
            type: 'todo',
            id: todo.id,
            title: todo.title,
            subtitle: deadlineDate ? `Due: ${formatDate(deadlineDate)}` : 'No Deadline',
            date: deadlineDate,
            item: todo,
          });
        }
      });
    }

    // Search Goals
    if (filter === 'all' || filter === 'goal') {
      goals.forEach((goal) => {
        if (!goal.id) return; // Skip items without ID

        const matchTitle = goal.title.toLowerCase().includes(lowerQuery);
        const matchDescription = goal.description?.toLowerCase().includes(lowerQuery);

        if (matchTitle || matchDescription) {
          results.push({
            type: 'goal',
            id: goal.id,
            title: goal.title,
            subtitle: `Progress ${calculateGoalProgress(goal)}%`,
            item: goal,
          });
        }
      });
    }

    // Sort by date (newest first)
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
    return `${month}/${day}`;
  };

  const formatEventDate = (dateStr: string, timeStr?: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    let result = `${month}/${day}`;
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const ampm = hours < 12 ? 'AM' : 'PM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      result += ` ${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    return result;
  };

  const getTypeLabel = (type: SearchResultType) => {
    switch (type) {
      case 'event':
        return 'Event';
      case 'todo':
        return 'Todo';
      case 'goal':
        return 'Goal';
    }
  };

  const getTypeIcon = (type: SearchResultType) => {
    switch (type) {
      case 'event':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 6h12" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 1v3M11 1v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'todo':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        );
      case 'goal':
        return (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="8" cy="8" r="1" fill="currentColor" />
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
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2" />
              <path d="M14 14l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              placeholder="Search events, todos, goals..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4l-8 8M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
          <div className="search-filters">
            <button
              className={`search-filter-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={`search-filter-btn ${filter === 'event' ? 'active' : ''}`}
              onClick={() => setFilter('event')}
            >
              Event
            </button>
            <button
              className={`search-filter-btn ${filter === 'todo' ? 'active' : ''}`}
              onClick={() => setFilter('todo')}
            >
              Todo
            </button>
            <button
              className={`search-filter-btn ${filter === 'goal' ? 'active' : ''}`}
              onClick={() => setFilter('goal')}
            >
              Goal
            </button>
          </div>
        </div>

        <div className="search-modal-body">
          {query.trim() === '' ? (
            <div className="search-empty">
              <p>Enter search term</p>
              <p className="search-hint">Tip: Press Ctrl+K to search quickly</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="search-empty">
              <p>No results found for "{query}"</p>
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
            <kbd>Esc</kbd> Close
          </span>
          <span className="search-result-count">
            {query.trim() && `${searchResults.length} results`}
          </span>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
