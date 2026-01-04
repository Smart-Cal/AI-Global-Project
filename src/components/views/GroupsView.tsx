import React, { useState, useEffect } from 'react';
import {
  getGroups,
  createGroup,
  deleteGroup,
  getPendingInvitations,
  respondToInvitation,
  type Group,
  type GroupInvitation,
} from '../../services/api';

interface GroupsViewProps {
  onGroupClick: (groupId: string) => void;
}

const GroupsView: React.FC<GroupsViewProps> = ({ onGroupClick }) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [groupsRes, invitationsRes] = await Promise.all([
        getGroups(),
        getPendingInvitations(),
      ]);
      setGroups(groupsRes.groups);
      setInvitations(invitationsRes.invitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
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
      setError(err instanceof Error ? err.message : '그룹 생성에 실패했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('정말 이 그룹을 삭제하시겠습니까?')) return;

    try {
      await deleteGroup(groupId);
      setGroups(groups.filter(g => g.id !== groupId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '그룹 삭제에 실패했습니다.');
    }
  };

  const handleInvitationResponse = async (invitationId: string, accept: boolean) => {
    try {
      await respondToInvitation(invitationId, accept);
      setInvitations(invitations.filter(i => i.id !== invitationId));
      if (accept) {
        loadData(); // 수락 시 그룹 목록 새로고침
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 응답에 실패했습니다.');
    }
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
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="groups-view">
      <div className="groups-header">
        <h2>그룹</h2>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          + 새 그룹
        </button>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* 대기 중인 초대 */}
      {invitations.length > 0 && (
        <div className="invitations-section">
          <h3>받은 초대 ({invitations.length})</h3>
          <div className="invitation-list">
            {invitations.map(invitation => (
              <div key={invitation.id} className="invitation-card">
                <div className="invitation-info">
                  <span className="invitation-group-name">{invitation.group_name}</span>
                  <span className="invitation-from">
                    {invitation.inviter_name}님이 초대했습니다
                  </span>
                </div>
                <div className="invitation-actions">
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => handleInvitationResponse(invitation.id, true)}
                  >
                    수락
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleInvitationResponse(invitation.id, false)}
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 그룹 목록 */}
      <div className="groups-section">
        <h3>내 그룹 ({groups.length})</h3>
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>아직 그룹이 없습니다.</p>
            <p>새 그룹을 만들어 친구들과 일정을 조율해보세요!</p>
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
                  <span className="group-date">생성일: {formatDate(group.created_at)}</span>
                </div>
                <button
                  className="btn btn-icon btn-danger-ghost"
                  onClick={(e) => handleDeleteGroup(group.id, e)}
                  title="그룹 삭제"
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

      {/* 그룹 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>새 그룹 만들기</h3>
              <button className="btn btn-icon" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label htmlFor="groupName">그룹 이름</label>
                <input
                  id="groupName"
                  type="text"
                  className="form-input"
                  placeholder="예: 대학동기, 프로젝트팀"
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
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateGroup}
                disabled={!newGroupName.trim() || isCreating}
              >
                {isCreating ? '생성 중...' : '만들기'}
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

        .invitations-section {
          margin-bottom: 24px;
        }

        .invitations-section h3,
        .groups-section h3 {
          font-size: 16px;
          font-weight: 500;
          color: #666;
          margin-bottom: 12px;
        }

        .invitation-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .invitation-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: linear-gradient(135deg, #4A90A4 0%, #357ABD 100%);
          border-radius: 12px;
          color: white;
        }

        .invitation-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .invitation-group-name {
          font-weight: 600;
          font-size: 16px;
        }

        .invitation-from {
          font-size: 13px;
          opacity: 0.9;
        }

        .invitation-actions {
          display: flex;
          gap: 8px;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .btn-success {
          background: #10B981;
          color: white;
          border: none;
        }

        .btn-danger {
          background: #EF4444;
          color: white;
          border: none;
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

        .group-date {
          font-size: 13px;
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
