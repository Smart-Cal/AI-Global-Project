import React, { useState, useEffect } from 'react';
import {
  getGroups,
  createGroup,
  deleteGroup,
  joinGroupByCode,
  getGroupByCode,
  type Group,
} from '../../services/api';

interface GroupsViewProps {
  onGroupClick: (groupId: string) => void;
}

const GroupsView: React.FC<GroupsViewProps> = ({ onGroupClick }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [previewGroup, setPreviewGroup] = useState<{ id: string; name: string; member_count: number } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const groupsRes = await getGroups();
      setGroups(groupsRes.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setIsLoading(false);
    }
  };

  // Check invite code (auto-verify when 6 digits entered)
  const handleInviteCodeChange = async (code: string) => {
    const upperCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setInviteCode(upperCode);
    setPreviewGroup(null);
    setError(null);

    if (upperCode.length === 6) {
      setIsCheckingCode(true);
      try {
        const { group } = await getGroupByCode(upperCode);
        setPreviewGroup(group);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Invalid invite code.');
      } finally {
        setIsCheckingCode(false);
      }
    }
  };

  // Join group with invite code
  const handleJoinGroup = async () => {
    if (!previewGroup) return;

    setIsJoining(true);
    setError(null);
    try {
      const { message, group } = await joinGroupByCode(inviteCode);
      setGroups([...groups, group]);
      setSuccessMessage(message);
      setShowJoinModal(false);
      setInviteCode('');
      setPreviewGroup(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join group.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;

    setIsCreating(true);
    try {
      const { group } = await createGroup(newGroupName.trim());
      setGroups([...groups, group]);
      setNewGroupName('');
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await deleteGroup(groupId);
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group.');
    }
  };

  const closeJoinModal = () => {
    setShowJoinModal(false);
    setInviteCode('');
    setPreviewGroup(null);
    setError(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="groups-view">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="groups-view">
      <div className="groups-header">
        <h2>Groups</h2>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowJoinModal(true)}>
            Join with Code
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Group
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {error && !showJoinModal && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Group List */}
      <div className="groups-section">
        <h3>My Groups ({groups.length})</h3>
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>No groups yet.</p>
            <p>Create a new group to coordinate schedules with friends!</p>
          </div>
        ) : (
          <div className="group-list">
            {groups.map(group => (
              <div
                key={group.id}
                className="group-card"
                onClick={() => onGroupClick(group.id)}
              >
                <div className="group-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                  </svg>
                </div>
                <div className="group-info">
                  <span className="group-name">{group.name}</span>
                  <span className="group-meta">
                    <span className="group-members">{group.member_count || 1} {(group.member_count || 1) === 1 ? 'member' : 'members'}</span>
                    <span className="group-separator">·</span>
                    <span className="group-date">Created {formatDate(group.created_at)}</span>
                  </span>
                </div>
                <button
                  className="btn btn-icon btn-danger-ghost"
                  onClick={(e) => handleDeleteGroup(group.id, e)}
                  title="Delete group"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Group</h3>
              <button className="btn btn-icon" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="groupName">Group Name</label>
                <input
                  id="groupName"
                  type="text"
                  className="form-input"
                  placeholder="e.g., Study Group, Project Team"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateGroup()}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join with Invite Code Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={closeJoinModal}>
          <div className="modal-content join-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Join with Invite Code</h3>
              <button className="btn btn-icon" onClick={closeJoinModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="inviteCode">Enter Invite Code</label>
                <input
                  id="inviteCode"
                  type="text"
                  className="form-input invite-code-input"
                  placeholder="ABC123"
                  value={inviteCode}
                  onChange={(e) => handleInviteCodeChange(e.target.value)}
                  maxLength={6}
                  autoFocus
                />
                <p className="input-hint">Enter the 6-digit code from your group admin</p>
              </div>

              {isCheckingCode && (
                <div className="checking-status">
                  <div className="spinner-small"></div>
                  <span>Checking code...</span>
                </div>
              )}

              {error && showJoinModal && (
                <div className="error-inline">{error}</div>
              )}

              {previewGroup && (
                <div className="group-preview">
                  <div className="preview-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                      <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                    </svg>
                  </div>
                  <div className="preview-info">
                    <span className="preview-name">{previewGroup.name}</span>
                    <span className="preview-members">{previewGroup.member_count} members</span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeJoinModal}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleJoinGroup}
                disabled={!previewGroup || isJoining}
              >
                {isJoining ? 'Joining...' : 'Join'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .groups-view {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .groups-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .groups-header h2 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .success-message {
          background: #d4edda;
          color: #155724;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          gap: 12px;
        }

        .spinner {
          width: 32px;
          height: 32px;
          border: 3px solid #e0e0e0;
          border-top-color: #4A90A4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .error-message {
          background: #fee;
          color: #c00;
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .error-message button {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
          color: #c00;
        }

        .groups-section h3 {
          font-size: 16px;
          font-weight: 500;
          color: #666;
          margin-bottom: 12px;
        }

        /* Invite code join modal styles */
        .join-modal .invite-code-input {
          font-size: 24px;
          text-align: center;
          letter-spacing: 8px;
          font-family: monospace;
          text-transform: uppercase;
        }

        .input-hint {
          font-size: 13px;
          color: #888;
          margin-top: 8px;
          text-align: center;
        }

        .checking-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          color: #666;
        }

        .spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid #e0e0e0;
          border-top-color: #4A90A4;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .error-inline {
          background: #fee;
          color: #c00;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          margin-top: 12px;
        }

        .group-preview {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: linear-gradient(135deg, #4A90A4 0%, #357ABD 100%);
          border-radius: 12px;
          color: white;
          margin-top: 16px;
        }

        .preview-icon {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .preview-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .preview-name {
          font-weight: 600;
          font-size: 18px;
        }

        .preview-members {
          font-size: 14px;
          opacity: 0.9;
        }

        .group-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .group-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .group-card:hover {
          border-color: #4A90A4;
          box-shadow: 0 2px 8px rgba(74, 144, 164, 0.15);
        }

        .group-icon {
          width: 48px;
          height: 48px;
          background: #E8F4F8;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #4A90A4;
          flex-shrink: 0;
        }

        .group-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .group-name {
          font-weight: 600;
          font-size: 16px;
          color: #333;
        }

        .group-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #888;
        }

        .group-members {
          color: #4A90A4;
          font-weight: 500;
        }

        .group-separator {
          color: #ccc;
        }

        .group-date {
          color: #888;
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-danger-ghost {
          color: #ccc;
        }

        .btn-danger-ghost:hover {
          background: #fee;
          color: #EF4444;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #888;
        }

        .empty-state p {
          margin: 8px 0;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 400px;
          overflow: hidden;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #eee;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 16px 20px;
          border-top: 1px solid #eee;
        }

        .form-group {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
        }

        .form-input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #4A90A4;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #4A90A4;
          color: white;
          border: none;
        }

        .btn-primary:hover {
          background: #3d7a8c;
        }

        .btn-primary:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
        }

        .btn-secondary:hover {
          background: #eee;
        }
      `}</style>
    </div>
  );
};

export default GroupsView;
