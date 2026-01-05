import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Home' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/schedule', label: 'Schedule' },
  { path: '/groups', label: 'Groups' }, // Added Groups based on project structure if needed, or stick to current
];
// Actually, I should check if 'Groups' is in the original file. It was not in the original file I viewed. 
// Original file had: Home, Calendar, Schedule. I will stick to that.

const navItemsOriginal = [
  { path: '/', label: 'Home' },
  { path: '/calendar', label: 'Calendar' },
  { path: '/schedule', label: 'Schedule' },
];

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="bottom-nav">
      {navItemsOriginal.map((item) => (
        <button
          key={item.path}
          className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
