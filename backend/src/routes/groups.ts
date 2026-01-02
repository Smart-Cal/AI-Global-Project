import { Router, Response } from 'express';
import {
  getGroupsByUser,
  getGroupById,
  createGroup,
  updateGroup,
  deleteGroup,
  getGroupMembers,
  removeGroupMember,
  isGroupOwner,
  isGroupMember,
  getInvitationsByGroup,
  getInvitationsByUser,
  getInvitationById,
  createInvitation,
  respondToInvitation,
  cancelInvitation,
  findGroupAvailableSlots,
  getUserById
} from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Group, GroupMember, GroupInvitation, GroupMatchSlot } from '../types/index.js';

const router = Router();

// ==============================================
// Group CRUD
// ==============================================

/**
 * GET /api/groups
 * 내가 속한 그룹 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const groups = await getGroupsByUser(userId);
    res.json({ groups });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to get groups' });
  }
});

/**
 * GET /api/groups/:id
 * 그룹 상세 조회 (멤버 목록 포함)
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // 멤버 권한 확인
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const group = await getGroupById(id);
    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    const members = await getGroupMembers(id);
    const isOwner = await isGroupOwner(id, userId);

    res.json({
      group,
      members,
      is_owner: isOwner
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to get group' });
  }
});

/**
 * POST /api/groups
 * 새 그룹 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      res.status(400).json({ error: 'Group name is required' });
      return;
    }

    const group = await createGroup(name.trim(), userId);
    res.status(201).json({ group });
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

/**
 * PUT /api/groups/:id
 * 그룹 정보 수정 (owner만)
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { name } = req.body;

    // owner 권한 확인
    const isOwner = await isGroupOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only group owner can update group' });
      return;
    }

    const group = await updateGroup(id, { name });
    res.json({ group });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

/**
 * DELETE /api/groups/:id
 * 그룹 삭제 (owner만)
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // owner 권한 확인
    const isOwner = await isGroupOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only group owner can delete group' });
      return;
    }

    await deleteGroup(id);
    res.json({ message: 'Group deleted' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// ==============================================
// Group Members
// ==============================================

/**
 * GET /api/groups/:id/members
 * 그룹 멤버 목록 조회
 */
router.get('/:id/members', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const members = await getGroupMembers(id);
    res.json({ members });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({ error: 'Failed to get group members' });
  }
});

/**
 * DELETE /api/groups/:id/members/:userId
 * 그룹 멤버 제거 (owner만, 자신은 제거 불가)
 */
router.delete('/:id/members/:memberId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, memberId } = req.params;

    // owner 권한 확인
    const isOwner = await isGroupOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only group owner can remove members' });
      return;
    }

    // owner 자신은 제거 불가
    if (memberId === userId) {
      res.status(400).json({ error: 'Cannot remove yourself as owner' });
      return;
    }

    await removeGroupMember(id, memberId);
    res.json({ message: 'Member removed' });
  } catch (error) {
    console.error('Remove group member error:', error);
    res.status(500).json({ error: 'Failed to remove group member' });
  }
});

/**
 * POST /api/groups/:id/leave
 * 그룹 나가기 (owner는 그룹 삭제해야 함)
 */
router.post('/:id/leave', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const isOwner = await isGroupOwner(id, userId);
    if (isOwner) {
      res.status(400).json({ error: 'Owner cannot leave. Delete the group instead.' });
      return;
    }

    await removeGroupMember(id, userId);
    res.json({ message: 'Left the group' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
});

// ==============================================
// Group Invitations
// ==============================================

/**
 * GET /api/groups/invitations/pending
 * 나에게 온 대기중인 초대 목록
 */
router.get('/invitations/pending', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const invitations = await getInvitationsByUser(user.email);
    res.json({ invitations });
  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

/**
 * GET /api/groups/:id/invitations
 * 그룹의 초대 목록 (owner/member만)
 */
router.get('/:id/invitations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const invitations = await getInvitationsByGroup(id);
    res.json({ invitations });
  } catch (error) {
    console.error('Get group invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

/**
 * POST /api/groups/:id/invitations
 * 그룹에 멤버 초대 (이메일로)
 */
router.post('/:id/invitations', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      res.status(400).json({ error: 'Valid email is required' });
      return;
    }

    // 멤버 권한 확인 (멤버면 초대 가능)
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    const invitation = await createInvitation(id, userId, email.toLowerCase());
    res.status(201).json({ invitation });
  } catch (error: any) {
    console.error('Create invitation error:', error);
    if (error.message.includes('already')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to create invitation' });
    }
  }
});

/**
 * POST /api/groups/invitations/:invitationId/respond
 * 초대 수락/거절
 */
router.post('/invitations/:invitationId/respond', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { invitationId } = req.params;
    const { accept } = req.body;

    if (typeof accept !== 'boolean') {
      res.status(400).json({ error: 'accept field is required (boolean)' });
      return;
    }

    // 초대받은 사람인지 확인
    const invitation = await getInvitationById(invitationId);
    if (!invitation) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    const user = await getUserById(userId);
    if (!user || user.email.toLowerCase() !== invitation.invitee_email.toLowerCase()) {
      res.status(403).json({ error: 'This invitation is not for you' });
      return;
    }

    const updated = await respondToInvitation(invitationId, accept, userId);
    res.json({
      invitation: updated,
      message: accept ? 'Invitation accepted' : 'Invitation declined'
    });
  } catch (error: any) {
    console.error('Respond invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to respond to invitation' });
  }
});

/**
 * DELETE /api/groups/:id/invitations/:invitationId
 * 초대 취소 (초대한 사람 또는 owner만)
 */
router.delete('/:id/invitations/:invitationId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id, invitationId } = req.params;

    const invitation = await getInvitationById(invitationId);
    if (!invitation || invitation.group_id !== id) {
      res.status(404).json({ error: 'Invitation not found' });
      return;
    }

    // 초대한 사람이거나 owner만 취소 가능
    const isOwner = await isGroupOwner(id, userId);
    if (invitation.inviter_id !== userId && !isOwner) {
      res.status(403).json({ error: 'Not authorized to cancel this invitation' });
      return;
    }

    await cancelInvitation(invitationId);
    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// ==============================================
// Group Schedule Matching
// ==============================================

/**
 * GET /api/groups/:id/available-slots
 * 그룹 공통 가용 시간대 조회
 */
router.get('/:id/available-slots', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      start_date,
      end_date,
      min_duration = '60',
      work_start = '9',
      work_end = '21'
    } = req.query;

    // 멤버 권한 확인
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    // 날짜 범위 기본값 (오늘부터 7일)
    const today = new Date();
    const defaultStart = today.toISOString().split('T')[0];
    const defaultEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const slots = await findGroupAvailableSlots(
      id,
      (start_date as string) || defaultStart,
      (end_date as string) || defaultEnd,
      parseInt(min_duration as string),
      parseInt(work_start as string),
      parseInt(work_end as string)
    );

    // 멤버 정보 추가
    const members = await getGroupMembers(id);

    res.json({
      slots,
      member_count: members.length,
      date_range: {
        start: (start_date as string) || defaultStart,
        end: (end_date as string) || defaultEnd
      }
    });
  } catch (error) {
    console.error('Get available slots error:', error);
    res.status(500).json({ error: 'Failed to get available slots' });
  }
});

/**
 * POST /api/groups/:id/find-meeting-time
 * AI 기반 최적 미팅 시간 추천 (향후 확장)
 */
router.post('/:id/find-meeting-time', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      duration = 60,
      preferred_dates,
      preferred_times
    } = req.body;

    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    // 기본 날짜 범위 (오늘부터 7일)
    const today = new Date();
    const startDate = preferred_dates?.[0] || today.toISOString().split('T')[0];
    const endDate = preferred_dates?.[preferred_dates.length - 1] ||
      new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const slots = await findGroupAvailableSlots(id, startDate, endDate, duration);

    // 가용 슬롯 중 첫 번째 추천
    const availableSlots = slots.filter(s => s.type === 'available');
    const negotiableSlots = slots.filter(s => s.type === 'negotiable');

    res.json({
      recommendations: [
        ...availableSlots.slice(0, 3).map(s => ({
          ...s,
          recommendation_type: 'best',
          reason: '모든 멤버가 가능한 시간'
        })),
        ...negotiableSlots.slice(0, 3).map(s => ({
          ...s,
          recommendation_type: 'alternative',
          reason: `일부 멤버(${s.conflicting_members?.length || 0}명)가 유동 일정 있음`
        }))
      ],
      total_available: availableSlots.length,
      total_negotiable: negotiableSlots.length
    });
  } catch (error) {
    console.error('Find meeting time error:', error);
    res.status(500).json({ error: 'Failed to find meeting time' });
  }
});

export default router;
