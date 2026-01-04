import React, { useState, useEffect } from 'react';
import {
  getGroup,
  removeGroupMember,
  leaveGroup,
  regenerateInviteCode,
  getGroupAvailableSlots,
  findMeetingTime,
  createGroupMeeting,
  type Group,
  type GroupMember,
  type AvailableSlot,
} from '../../services/api';

interface GroupDetailViewProps {
  groupId: string;
  onBack: () => void;
}

type TabType = 'members' | 'schedule' | 'meeting';

const GroupDetailView: React.FC<GroupDetailViewProps> = ({ groupId, onBack }) => {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('members');

  // 초대 코드 관련
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // 일정 매칭 관련
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // 미팅 생성 관련
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    date: '',
    start_time: '',
    end_time: '',
    location: '',
  });
  const [isCreatingMeeting, setIsCreatingMeeting] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    loadGroupData();
  }, [groupId]);

  const loadGroupData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const groupRes = await getGroup(groupId);
      setGroup(groupRes.group);
      setMembers(groupRes.members);
      setIsOwner(groupRes.is_owner);
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 초대 코드 복사
  const handleCopyInviteCode = async () => {
    if (!group?.invite_code) return;

    try {
      await navigator.clipboard.writeText(group.invite_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = group.invite_code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // 초대 코드 재생성 (owner만)
  const handleRegenerateCode = async () => {
    if (!confirm('새 초대 코드를 생성하면 기존 코드는 사용할 수 없게 됩니다. 계속하시겠습니까?')) return;

    setIsRegenerating(true);
    try {
      const { invite_code } = await regenerateInviteCode(groupId);
      setGroup(prev => prev ? { ...prev, invite_code } : null);
      setSuccessMessage('새 초대 코드가 생성되었습니다.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '초대 코드 재생성에 실패했습니다.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('정말 이 멤버를 내보내시겠습니까?')) return;

    try {
      await removeGroupMember(groupId, memberId);
      setMembers(members.filter(m => m.user_id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '멤버 제거에 실패했습니다.');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('정말 이 그룹을 나가시겠습니까?')) return;

    try {
      await leaveGroup(groupId);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : '그룹 나가기에 실패했습니다.');
    }
  };

  const loadAvailableSlots = async () => {
    setIsLoadingSlots(true);
    try {
      const result = await getGroupAvailableSlots(groupId);
      setAvailableSlots(result.slots);
      setDateRange(result.date_range);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가용 시간 조회에 실패했습니다.');
    } finally {
      setIsLoadingSlots(false);
    }
  };

  const loadRecommendations = async () => {
    try {
      const result = await findMeetingTime(groupId);
      setRecommendations(result.recommendations);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const handleSelectSlot = (slot: AvailableSlot) => {
    setMeetingForm({
      ...meetingForm,
      date: slot.date,
      start_time: slot.start_time,
      end_time: slot.end_time,
    });
    setShowMeetingModal(true);
  };

  const handleCreateMeeting = async () => {
    if (!meetingForm.title || !meetingForm.date || !meetingForm.start_time) return;

    setIsCreatingMeeting(true);
    try {
      await createGroupMeeting(groupId, meetingForm);
      setShowMeetingModal(false);
      setMeetingForm({ title: '', date: '', start_time: '', end_time: '', location: '' });
      alert('모든 멤버의 캘린더에 일정이 추가되었습니다!');
    } catch (err) {
      setError(err instanceof Error ? err.message : '미팅 생성에 실패했습니다.');
    } finally {
      setIsCreatingMeeting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'schedule' && availableSlots.length === 0) {
      loadAvailableSlots();
      loadRecommendations();
    }
  }, [activeTab]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return `${date.getMonth() + 1}/${date.getDate()} (${days[date.getDay()]})`;
  };

  if (isLoading) {
    return (
      <div className="group-detail-view">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="group-detail-view">
        <div className="error-container">
          <p>그룹을 찾을 수 없습니다.</p>
          <button className="btn btn-primary" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="group-detail-view">
      {/* Header */}
      <div className="detail-header">
        <button className="btn btn-icon" onClick={onBack}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h2>{group.name}</h2>
        <div className="header-actions">
          {!isOwner && (
            <button className="btn btn-danger-ghost btn-sm" onClick={handleLeaveGroup}>
              나가기
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'members' ? 'active' : ''}`}
          onClick={() => setActiveTab('members')}
        >
          멤버 ({members.length})
        </button>
        <button
          className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          일정 조율
        </button>
      </div>

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="tab-content">
          {/* 초대 코드 섹션 */}
          <div className="invite-code-section">
            <div className="invite-code-header">
              <h3>초대 코드</h3>
              {isOwner && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleRegenerateCode}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? '생성 중...' : '새 코드 생성'}
                </button>
              )}
            </div>
            <div className="invite-code-box">
              <span className="invite-code">{group?.invite_code || '------'}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleCopyInviteCode}
              >
                {isCopied ? '복사됨!' : '복사'}
              </button>
            </div>
            <p className="invite-code-hint">이 코드를 공유하여 친구를 그룹에 초대하세요</p>
          </div>

          <div className="section-header">
            <h3>멤버 ({members.length}명)</h3>
          </div>

          <div className="member-list">
            {members.map(member => (
              <div key={member.user_id} className="member-card">
                <div className="member-avatar">
                  {(member.user_name || member.user_email || '?')[0].toUpperCase()}
                </div>
                <div className="member-info">
                  <span className="member-name">
                    {member.user_name || member.user_email}
                    {member.role === 'owner' && <span className="badge badge-owner">관리자</span>}
                  </span>
                  <span className="member-email">{member.user_email}</span>
                </div>
                {isOwner && member.role !== 'owner' && (
                  <button
                    className="btn btn-icon btn-danger-ghost"
                    onClick={() => handleRemoveMember(member.user_id)}
                    title="멤버 내보내기"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M6 19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7H6V19ZM19 4H15.5L14.5 3H9.5L8.5 4H5V6H19V4Z" fill="currentColor"/>
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="tab-content">
          <div className="section-header">
            <h3>공통 가용 시간</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={loadAvailableSlots}
              disabled={isLoadingSlots}
            >
              {isLoadingSlots ? '로딩...' : '새로고침'}
            </button>
          </div>

          {dateRange.start && (
            <p className="date-range-info">
              {formatDate(dateRange.start)} ~ {formatDate(dateRange.end)} 범위
            </p>
          )}

          {/* 추천 시간 */}
          {recommendations.length > 0 && (
            <div className="recommendations-section">
              <h4>추천 시간</h4>
              {recommendations.slice(0, 3).map((rec, idx) => (
                <div
                  key={idx}
                  className={`recommendation-card ${rec.recommendation_type === 'best' ? 'best' : 'alternative'}`}
                  onClick={() => handleSelectSlot(rec)}
                >
                  <div className="rec-time">
                    <span className="rec-date">{formatDate(rec.date)}</span>
                    <span className="rec-hours">{rec.start_time} - {rec.end_time}</span>
                  </div>
                  <div className="rec-reason">
                    {rec.recommendation_type === 'best' && '⭐ '}
                    {rec.reason}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 전체 가용 시간 */}
          {isLoadingSlots ? (
            <div className="loading-container">
              <div className="spinner"></div>
            </div>
          ) : availableSlots.length === 0 ? (
            <div className="empty-state">
              <p>공통으로 비어있는 시간이 없습니다.</p>
              <p>각 멤버의 일정을 확인해보세요.</p>
            </div>
          ) : (
            <div className="slots-list">
              {availableSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className={`slot-card ${slot.type}`}
                  onClick={() => handleSelectSlot(slot)}
                >
                  <div className="slot-time">
                    <span className="slot-date">{formatDate(slot.date)}</span>
                    <span className="slot-hours">{slot.start_time} - {slot.end_time}</span>
                  </div>
                  <div className="slot-status">
                    {slot.type === 'available' ? (
                      <span className="status-available">모두 가능</span>
                    ) : (
                      <span className="status-negotiable">
                        {slot.conflicting_members?.length || 0}명 유동 일정
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Meeting Modal */}
      {showMeetingModal && (
        <div className="modal-overlay" onClick={() => setShowMeetingModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>미팅 생성</h3>
              <button className="btn btn-icon" onClick={() => setShowMeetingModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>미팅 제목</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 정기 모임"
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>날짜</label>
                  <input
                    type="date"
                    className="form-input"
                    value={meetingForm.date}
                    onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>시작 시간</label>
                  <input
                    type="time"
                    className="form-input"
                    value={meetingForm.start_time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, start_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>종료 시간</label>
                  <input
                    type="time"
                    className="form-input"
                    value={meetingForm.end_time}
                    onChange={(e) => setMeetingForm({ ...meetingForm, end_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>장소 (선택)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="예: 강남역 스타벅스"
                  value={meetingForm.location}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMeetingModal(false)}>
                취소
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateMeeting}
                disabled={!meetingForm.title || !meetingForm.date || !meetingForm.start_time || isCreatingMeeting}
              >
                {isCreatingMeeting ? '생성 중...' : '미팅 만들기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .group-detail-view {
          padding: 20px;
          max-width: 800px;
          margin: 0 auto;
        }

        .detail-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .detail-header h2 {
          flex: 1;
          margin: 0;
          font-size: 20px;
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
        }

        /* 초대 코드 섹션 */
        .invite-code-section {
          background: linear-gradient(135deg, #4A90A4 0%, #357ABD 100%);
          border-radius: 12px;
          padding: 20px;
          color: white;
          margin-bottom: 24px;
        }

        .invite-code-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .invite-code-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 500;
          opacity: 0.9;
        }

        .invite-code-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          padding: 16px;
        }

        .invite-code {
          font-size: 28px;
          font-weight: 700;
          font-family: monospace;
          letter-spacing: 4px;
        }

        .invite-code-hint {
          text-align: center;
          font-size: 13px;
          opacity: 0.8;
          margin-top: 12px;
          margin-bottom: 0;
        }

        .tabs {
          display: flex;
          gap: 4px;
          margin-bottom: 20px;
          background: #f5f5f5;
          padding: 4px;
          border-radius: 12px;
        }

        .tab {
          flex: 1;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #666;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab.active {
          background: white;
          color: #333;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .tab-content {
          background: white;
          border-radius: 12px;
          padding: 20px;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .section-header h3 {
          margin: 0;
          font-size: 16px;
        }

        .member-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .member-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 8px;
        }

        .member-avatar {
          width: 40px;
          height: 40px;
          background: #4A90A4;
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 16px;
        }

        .member-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .member-name {
          font-weight: 500;
          color: #333;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .member-email {
          font-size: 13px;
          color: #888;
        }

        .badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }

        .badge-owner {
          background: #E8F4F8;
          color: #4A90A4;
        }

        .invitation-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .invitation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px;
          background: #fff9e6;
          border-radius: 8px;
          font-size: 14px;
        }

        .date-range-info {
          font-size: 13px;
          color: #888;
          margin-bottom: 16px;
        }

        .recommendations-section {
          margin-bottom: 24px;
        }

        .recommendations-section h4 {
          font-size: 14px;
          color: #666;
          margin-bottom: 12px;
        }

        .recommendation-card {
          padding: 12px 16px;
          background: #f0f9ff;
          border: 1px solid #bae6fd;
          border-radius: 8px;
          margin-bottom: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .recommendation-card.best {
          background: #fef3c7;
          border-color: #fcd34d;
        }

        .recommendation-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .rec-time {
          display: flex;
          gap: 12px;
          margin-bottom: 4px;
        }

        .rec-date {
          font-weight: 600;
          color: #333;
        }

        .rec-hours {
          color: #666;
        }

        .rec-reason {
          font-size: 13px;
          color: #666;
        }

        .slots-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .slot-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .slot-card:hover {
          border-color: #4A90A4;
          box-shadow: 0 2px 8px rgba(74, 144, 164, 0.15);
        }

        .slot-card.available {
          border-left: 3px solid #10B981;
        }

        .slot-card.negotiable {
          border-left: 3px solid #F59E0B;
        }

        .slot-time {
          display: flex;
          gap: 12px;
        }

        .slot-date {
          font-weight: 500;
          color: #333;
        }

        .slot-hours {
          color: #666;
        }

        .status-available {
          color: #10B981;
          font-size: 13px;
          font-weight: 500;
        }

        .status-negotiable {
          color: #F59E0B;
          font-size: 13px;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #888;
        }

        /* Modal & Form styles (same as GroupsView) */
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
          margin-bottom: 16px;
        }

        .form-group:last-child {
          margin-bottom: 0;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #333;
          font-size: 14px;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: #4A90A4;
        }

        .form-row {
          display: flex;
          gap: 12px;
        }

        .form-row .form-group {
          flex: 1;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
        }

        .btn-icon {
          width: 36px;
          height: 36px;
          padding: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: transparent;
          border: none;
          cursor: pointer;
        }

        .btn-icon:hover {
          background: #f0f0f0;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 13px;
        }

        .btn-primary {
          background: #4A90A4;
          color: white;
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
        }

        .btn-secondary:hover {
          background: #eee;
        }

        .btn-danger-ghost {
          background: transparent;
          color: #999;
        }

        .btn-danger-ghost:hover {
          background: #fee;
          color: #EF4444;
        }
      `}</style>
    </div>
  );
};

export default GroupDetailView;
