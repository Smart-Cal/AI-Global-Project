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
  getUserById,
  createEvent,
  getGroupByInviteCode,
  joinGroupByInviteCode,
  regenerateInviteCode,
  getEventsByUser
} from '../services/database.js';
import OpenAI from 'openai';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Group, GroupMember, GroupInvitation, GroupMatchSlot } from '../types/index.js';
import { getMCPOrchestrator } from '../mcp/index.js';

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
// Invite Code (Discord-style)
// ==============================================

/**
 * POST /api/groups/join
 * Join group with invite code
 */
router.post('/join', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { invite_code } = req.body;

    if (!invite_code || invite_code.trim().length === 0) {
      res.status(400).json({ error: 'Please enter an invite code.' });
      return;
    }

    const group = await joinGroupByInviteCode(invite_code.trim().toUpperCase(), userId);
    res.json({
      message: `Successfully joined '${group.name}'!`,
      group
    });
  } catch (error: any) {
    console.error('Join group error:', error);
    res.status(400).json({ error: error.message || 'Failed to join group' });
  }
});

/**
 * POST /api/groups/:id/regenerate-code
 * Regenerate invite code (owner only)
 */
router.post('/:id/regenerate-code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const isOwner = await isGroupOwner(id, userId);
    if (!isOwner) {
      res.status(403).json({ error: 'Only group owner can regenerate invite code' });
      return;
    }

    const newCode = await regenerateInviteCode(id);
    res.json({
      message: 'New invite code generated.',
      invite_code: newCode
    });
  } catch (error) {
    console.error('Regenerate code error:', error);
    res.status(500).json({ error: 'Failed to regenerate invite code' });
  }
});

/**
 * GET /api/groups/code/:code
 * Preview group info by invite code (before joining)
 */
router.get('/code/:code', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.params;

    const group = await getGroupByInviteCode(code.toUpperCase());
    if (!group) {
      res.status(404).json({ error: 'Invalid invite code.' });
      return;
    }

    const members = await getGroupMembers(group.id);

    res.json({
      group: {
        id: group.id,
        name: group.name,
        member_count: members.length
      }
    });
  } catch (error) {
    console.error('Get group by code error:', error);
    res.status(500).json({ error: 'Failed to get group info' });
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
          reason: 'All members available'
        })),
        ...negotiableSlots.slice(0, 3).map(s => ({
          ...s,
          recommendation_type: 'alternative',
          reason: `${s.conflicting_members?.length || 0} member(s) have flexible schedules`
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

// ==============================================
// MCP 기반 고급 그룹 기능 ("행동하는 AI")
// ==============================================

/**
 * POST /api/groups/:id/plan-meeting
 * MCP 기반 그룹 미팅 계획 (일정 + 장소 추천)
 *
 * "행동하는 AI" - 일정 찾기 + 장소 추천을 한 번에 처리
 */
router.post('/:id/plan-meeting', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      title = 'Group Meeting',
      duration = 60,
      location_area,      // 예: "홍대", "강남"
      place_type = 'restaurant',  // restaurant, cafe, etc.
      budget,             // 예: 20000 (1인당)
      preferences         // 추가 요청사항
    } = req.body;

    // 멤버 권한 확인
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    // 그룹 정보 및 멤버 조회
    const group = await getGroupById(id);
    const members = await getGroupMembers(id);

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // MCP Orchestrator 사용
    const mcp = getMCPOrchestrator(userId);

    // 1. 가능한 시간 찾기 (내부 DB 기반)
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const slots = await findGroupAvailableSlots(id, startDate, endDate, duration);

    const availableSlots = slots.filter(s => s.type === 'available').slice(0, 5);
    const negotiableSlots = slots.filter(s => s.type === 'negotiable').slice(0, 3);

    // 2. 장소 추천 (MCP Maps API)
    let placeRecommendations = null;
    if (location_area) {
      const placeResult = await mcp.executeTool({
        name: 'maps_recommend_restaurants',
        arguments: {
          location: location_area,
          type: place_type,
          radius: 1000,
          minRating: 4.0,
          maxResults: 5
        }
      });

      if (placeResult.success) {
        placeRecommendations = placeResult.data;
      }
    }

    // 3. 추천 결과 구성
    const recommendations = {
      group: {
        id: group.id,
        name: group.name,
        member_count: members.length
      },
      available_times: {
        best: availableSlots.map(s => ({
          date: s.date,
          time: `${s.start_time} - ${s.end_time}`,
          type: 'all_available',
          reason: 'All members available'
        })),
        alternatives: negotiableSlots.map(s => ({
          date: s.date,
          time: `${s.start_time} - ${s.end_time}`,
          type: 'negotiable',
          conflicting_members: s.conflicting_members,
          reason: `${s.conflicting_members?.length || 0} member(s) have flexible schedules`
        }))
      },
      place_recommendations: placeRecommendations,
      suggested_plan: availableSlots.length > 0 && placeRecommendations?.restaurants?.[0]
        ? {
            date: availableSlots[0].date,
            time: availableSlots[0].start_time,
            place: placeRecommendations.restaurants[0],
            message: `How about meeting at ${placeRecommendations.restaurants[0].name} on ${availableSlots[0].date} at ${availableSlots[0].start_time}?`
          }
        : null
    };

    res.json(recommendations);
  } catch (error) {
    console.error('Plan meeting error:', error);
    res.status(500).json({ error: 'Failed to plan meeting' });
  }
});

/**
 * POST /api/groups/:id/create-meeting
 * 그룹 미팅 확정 및 일정 생성
 *
 * "행동하는 AI" - 실제로 모든 멤버의 캘린더에 일정 추가
 */
router.post('/:id/create-meeting', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const {
      title,
      date,           // YYYY-MM-DD
      start_time,     // HH:MM
      end_time,       // HH:MM
      location,
      description
    } = req.body;

    // 유효성 검사
    if (!title || !date || !start_time) {
      res.status(400).json({ error: 'title, date, start_time are required' });
      return;
    }

    // 멤버 권한 확인
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    // 그룹 정보 및 멤버 조회
    const group = await getGroupById(id);
    const members = await getGroupMembers(id);

    if (!group) {
      res.status(404).json({ error: 'Group not found' });
      return;
    }

    // 모든 멤버에게 일정 생성
    const createdEvents = [];
    const failedMembers = [];

    // 종료 시간 계산 (기본 1시간)
    const calculatedEndTime = end_time || (() => {
      const [h, m] = start_time.split(':').map(Number);
      const endHour = (h + 1) % 24;
      return `${endHour.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    })();

    for (const member of members) {
      try {
        const event = await createEvent({
          user_id: member.user_id,
          title: `[${group.name}] ${title}`,
          description: description || `${group.name} group meeting`,
          event_date: date,
          start_time: start_time,
          end_time: calculatedEndTime,
          location: location,
          is_all_day: false,
          is_fixed: true,  // 그룹 일정은 고정
          priority: 4      // 높은 우선순위
        });
        createdEvents.push({
          member_id: member.user_id,
          event_id: event.id
        });
      } catch (err) {
        failedMembers.push(member.user_id);
        console.error(`Failed to create event for member ${member.user_id}:`, err);
      }
    }

    res.json({
      success: true,
      message: `Event added to ${createdEvents.length} member(s)' calendars.`,
      meeting: {
        title: `[${group.name}] ${title}`,
        date,
        time: `${start_time} - ${calculatedEndTime}`,
        location
      },
      created_for: createdEvents.length,
      failed_for: failedMembers.length,
      failed_members: failedMembers.length > 0 ? failedMembers : undefined
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

/**
 * POST /api/groups/:id/find-midpoint
 * 멤버들의 중간 지점 찾기 (MCP Maps)
 */
router.post('/:id/find-midpoint', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { member_locations } = req.body;  // [{ user_id, location: { lat, lng } }]

    // 멤버 권한 확인
    const isMember = await isGroupMember(id, userId);
    if (!isMember) {
      res.status(403).json({ error: 'Not a member of this group' });
      return;
    }

    if (!member_locations || member_locations.length < 2) {
      res.status(400).json({ error: 'At least 2 member locations required' });
      return;
    }

    // MCP Orchestrator 사용
    const mcp = getMCPOrchestrator(userId);

    const result = await mcp.executeTool({
      name: 'maps_find_midpoint',
      arguments: {
        locations: member_locations.map((m: any) => m.location),
        searchNearby: true,
        placeType: 'restaurant'
      }
    });

    if (!result.success) {
      res.status(500).json({ error: result.error || 'Failed to find midpoint' });
      return;
    }

    res.json({
      midpoint: result.data.midpoint,
      nearby_places: result.data.nearbyPlaces,
      member_distances: result.data.distances
    });
  } catch (error) {
    console.error('Find midpoint error:', error);
    res.status(500).json({ error: 'Failed to find midpoint' });
  }
});

// ==============================================
// Group AI Assistant Chat
// ==============================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * POST /api/groups/:id/chat
 * Chat with group AI assistant - Schedule coordination
 */
router.post('/:id/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

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

    // Get each member's schedule for next 7 days
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const memberSchedules: { name: string; events: any[] }[] = [];
    for (const member of members) {
      const events = await getEventsByUser(member.user_id, startDate, endDate);
      memberSchedules.push({
        name: member.user?.name || member.user?.email || 'Member',
        events: events.map(e => ({
          title: e.title,
          date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          is_fixed: e.is_fixed
        }))
      });
    }

    // Find common available times
    const availableSlots = await findGroupAvailableSlots(id, startDate, endDate, 60);

    // AI prompt
    const systemPrompt = `You are a schedule coordination AI assistant for the "${group.name}" group.

## Role
- Analyze group members' schedules and recommend meeting times.
- Communicate in a friendly and natural way.
- Suggest specific dates and times.

## Current Group Info
- Group Name: ${group.name}
- Members: ${members.length}
- Member Names: ${members.map(m => m.user?.name || m.user?.email).join(', ')}

## Member Schedules (Next 7 Days)
${memberSchedules.map(m => `
### ${m.name}
${m.events.length === 0 ? 'No scheduled events' : m.events.map(e =>
  `- ${e.date} ${e.start_time || ''}-${e.end_time || ''}: ${e.title}${e.is_fixed ? ' (fixed)' : ''}`
).join('\n')}`).join('\n')}

## Available Times (All Members Free)
${availableSlots.filter(s => s.type === 'available').slice(0, 5).map(s =>
  `- ${s.date} ${s.start_time}-${s.end_time}`
).join('\n') || 'No times when all members are available.'}

## Negotiable Times (Some Have Flexible Events)
${availableSlots.filter(s => s.type === 'negotiable').slice(0, 3).map(s =>
  `- ${s.date} ${s.start_time}-${s.end_time} (${s.conflicting_members?.length || 0} member(s) have flexible events)`
).join('\n') || 'None'}

## Response Guidelines
1. Recommend times based on the user's question.
2. Prefer times when all members are available.
3. Mention specific dates (e.g., Wednesday, January 15th) and times.
4. When suggesting multiple options, rank them 1, 2, 3.
5. Keep responses concise and clear.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.';

    res.json({
      message: aiResponse,
      available_slots: availableSlots.filter(s => s.type === 'available').slice(0, 5),
      member_count: members.length
    });
  } catch (error) {
    console.error('Group chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

export default router;
