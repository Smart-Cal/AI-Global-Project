import { Router, Request, Response } from 'express';
import { createUser, getUserByPhone, checkPhoneExists, updateUserLogin } from '../services/database.js';
import { generateToken, hashPassword } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/register
 * 회원가입 (전화번호 기반)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { phone, password, name, nickname } = req.body;

    if (!phone || !password || !name) {
      res.status(400).json({ error: '전화번호, 비밀번호, 이름을 입력해주세요.' });
      return;
    }

    // 전화번호 정규화 (숫자만)
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    // 전화번호 중복 확인
    const exists = await checkPhoneExists(normalizedPhone);
    if (exists) {
      res.status(400).json({ error: '이미 등록된 전화번호입니다.' });
      return;
    }

    // 비밀번호 해시
    const passwordHash = await hashPassword(password);

    // 사용자 생성
    const user = await createUser(normalizedPhone, passwordHash, name, nickname);
    const token = generateToken(user.id);

    res.status(201).json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        nickname: user.nickname,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/login
 * 로그인 (전화번호 기반)
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      res.status(400).json({ error: '전화번호와 비밀번호를 입력해주세요.' });
      return;
    }

    // 전화번호 정규화
    const normalizedPhone = phone.replace(/[^0-9]/g, '');

    // 사용자 조회
    const user = await getUserByPhone(normalizedPhone);
    if (!user) {
      res.status(401).json({ error: '전화번호 또는 비밀번호가 일치하지 않습니다.' });
      return;
    }

    // 비밀번호 검증
    const passwordHash = await hashPassword(password);
    if (user.password_hash !== passwordHash) {
      res.status(401).json({ error: '전화번호 또는 비밀번호가 일치하지 않습니다.' });
      return;
    }

    // 로그인 시간 업데이트
    await updateUserLogin(user.id);

    const token = generateToken(user.id);

    res.json({
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        nickname: user.nickname,
        created_at: user.created_at
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: '로그인에 실패했습니다.' });
  }
});

/**
 * POST /api/auth/logout
 * 로그아웃 (클라이언트에서 토큰 삭제)
 */
router.post('/logout', (_req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
