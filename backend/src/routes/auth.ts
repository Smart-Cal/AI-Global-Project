import { Router, Request, Response } from 'express';
import { upsertGoogleUser, updateUserLogin, supabase, upsertExternalService, getExternalServiceConfig, deleteExternalService } from '../services/database.js';
import { generateToken, authenticate } from '../middleware/auth.js';
import { GoogleCalendarMCP } from '../mcp/googleCalendar.js';

const router = Router();

/**
 * GET /api/auth/supabase-config
 * 프론트엔드에서 Supabase 설정 정보 가져오기
 */
router.get('/supabase-config', (_req: Request, res: Response) => {
  // 요청 시점에 환경변수 읽기 (database.ts에서 dotenv 로드 후)
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

  res.json({
    supabaseUrl,
    supabaseAnonKey
  });
});

/**
 * POST /api/auth/google
 * 구글 OAuth 콜백 처리 - Supabase 세션을 받아 우리 JWT 발급
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      res.status(400).json({ error: 'access_token이 필요합니다.' });
      return;
    }

    // Supabase에서 사용자 정보 가져오기
    const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(access_token);

    if (userError || !supabaseUser) {
      console.error('Supabase user error:', userError);
      res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      return;
    }

    // users 테이블에 사용자 정보 저장/업데이트
    const user = await upsertGoogleUser({
      id: supabaseUser.id,
      email: supabaseUser.email || '',
      name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      avatar_url: supabaseUser.user_metadata?.avatar_url
    });

    // 우리 서비스용 JWT 발급
    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        nickname: user.nickname,
        avatar_url: user.avatar_url,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: '구글 로그인에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/logout
 * 로그아웃
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자 정보 조회
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: '인증이 필요합니다.' });
      return;
    }

    // 토큰에서 사용자 정보는 미들웨어에서 처리
    res.json({ message: 'Use authenticate middleware' });
  } catch (error) {
    res.status(500).json({ error: '사용자 정보 조회에 실패했습니다.' });
  }
});

// ====================================================
// Google Calendar OAuth
// ====================================================

const calendarMCP = new GoogleCalendarMCP();

/**
 * GET /api/auth/google/calendar/url
 * Google Calendar OAuth URL 생성
 */
router.get('/google/calendar/url', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const authUrl = calendarMCP.getAuthUrl();

    // state에 userId 포함 (콜백에서 사용)
    const urlWithState = `${authUrl}&state=${userId}`;

    res.json({ url: urlWithState });
  } catch (error) {
    console.error('Google Calendar auth URL error:', error);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/auth/google/calendar/callback
 * Google Calendar OAuth 콜백 처리
 */
router.get('/google/calendar/callback', async (req: Request, res: Response) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    // 인증 코드로 토큰 교환
    const tokens = await calendarMCP.getTokenFromCode(code);

    // 토큰을 external_services 테이블에 저장
    await upsertExternalService({
      user_id: userId,
      service_type: 'google_calendar',
      service_name: 'Google Calendar',
      config: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date,
        token_type: tokens.token_type,
        scope: tokens.scope
      },
      is_enabled: true
    });

    console.log('[Auth] Google Calendar connected for user:', userId);

    // 프론트엔드로 리다이렉트 (성공)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?calendar_connected=true`);
  } catch (error) {
    console.error('Google Calendar callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/settings?calendar_error=true`);
  }
});

/**
 * GET /api/auth/google/calendar/status
 * Google Calendar 연결 상태 확인
 */
router.get('/google/calendar/status', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const service = await getExternalServiceConfig(userId, 'google_calendar');

    res.json({
      connected: !!service && service.is_enabled,
      lastSynced: service?.last_synced_at || null
    });
  } catch (error) {
    console.error('Google Calendar status error:', error);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

/**
 * DELETE /api/auth/google/calendar/disconnect
 * Google Calendar 연결 해제
 */
router.delete('/google/calendar/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    await deleteExternalService(userId, 'google_calendar');

    console.log('[Auth] Google Calendar disconnected for user:', userId);
    res.json({ message: 'Google Calendar disconnected' });
  } catch (error) {
    console.error('Google Calendar disconnect error:', error);
    res.status(500).json({ error: 'Failed to disconnect calendar' });
  }
});

export default router;
