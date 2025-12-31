import { Router, Request, Response } from 'express';
import { upsertGoogleUser, updateUserLogin, supabase } from '../services/database.js';
import { generateToken } from '../middleware/auth.js';

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

export default router;
