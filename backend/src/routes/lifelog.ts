import { Router, Response } from 'express';
import OpenAI from 'openai';
import {
  getLifeLogsByUser,
  getLifeLogByDate,
  getLifeLogById,
  createLifeLog,
  updateLifeLog,
  deleteLifeLog,
  upsertLifeLog,
  getEventsByUser,
  getTodosByUser,
  getUserById
} from '../services/database.js';
import { getCurrentWeather } from '../services/weather.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { LifeLog, Event, Todo } from '../types/index.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 무드 이모지 매핑
const MOOD_EMOJIS: Record<string, string> = {
  'great': '😊',
  'good': '🙂',
  'neutral': '😐',
  'tired': '😓',
  'sad': '😢',
  'stressed': '😰',
  'excited': '🎉',
  'peaceful': '😌'
};

// ==============================================
// Life Log CRUD
// ==============================================

/**
 * GET /api/lifelog
 * 내 Life Log 목록 조회
 */
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 30;

    const logs = await getLifeLogsByUser(userId, limit);
    res.json({ logs });
  } catch (error) {
    console.error('Get life logs error:', error);
    res.status(500).json({ error: 'Failed to get life logs' });
  }
});

/**
 * GET /api/lifelog/date/:date
 * 특정 날짜의 Life Log 조회
 */
router.get('/date/:date', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { date } = req.params;

    // 날짜 형식 검증
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
      return;
    }

    const log = await getLifeLogByDate(userId, date);

    if (!log) {
      res.status(404).json({ error: 'Life log not found for this date' });
      return;
    }

    res.json({ log });
  } catch (error) {
    console.error('Get life log by date error:', error);
    res.status(500).json({ error: 'Failed to get life log' });
  }
});

/**
 * GET /api/lifelog/:id
 * 특정 Life Log 조회
 */
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const log = await getLifeLogById(id);

    if (!log) {
      res.status(404).json({ error: 'Life log not found' });
      return;
    }

    res.json({ log });
  } catch (error) {
    console.error('Get life log error:', error);
    res.status(500).json({ error: 'Failed to get life log' });
  }
});

/**
 * POST /api/lifelog/generate
 * AI로 Life Log 자동 생성
 */
router.post('/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { date } = req.body;

    // 날짜 기본값: 오늘
    const targetDate = date || new Date().toISOString().split('T')[0];

    // 이미 해당 날짜에 로그가 있는지 확인
    const existing = await getLifeLogByDate(userId, targetDate);
    if (existing) {
      res.status(400).json({
        error: 'Life log already exists for this date',
        log: existing
      });
      return;
    }

    const user = await getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // 해당 날짜의 데이터 조회
    const [events, todos, weather] = await Promise.all([
      getEventsByUser(userId, targetDate, targetDate),
      getTodosByUser(userId),
      getCurrentWeather(user.location || 'Seoul')
    ]);

    // 해당 날짜에 완료된 Todo 필터링
    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      return t.completed_at.split('T')[0] === targetDate;
    });

    // AI로 일기 생성
    const generatedLog = await generateLifeLog(
      user.name || user.nickname || '사용자',
      targetDate,
      events,
      completedTodos,
      weather?.condition
    );

    // 저장
    const log = await createLifeLog({
      user_id: userId,
      log_date: targetDate,
      summary: generatedLog.summary,
      content: generatedLog.content,
      mood: generatedLog.mood,
      tags: generatedLog.tags
    });

    res.status(201).json({ log });
  } catch (error) {
    console.error('Generate life log error:', error);
    res.status(500).json({ error: 'Failed to generate life log' });
  }
});

/**
 * POST /api/lifelog
 * 수동으로 Life Log 생성
 */
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { log_date, summary, content, mood, tags } = req.body;

    if (!log_date || !content) {
      res.status(400).json({ error: 'log_date and content are required' });
      return;
    }

    const log = await createLifeLog({
      user_id: userId,
      log_date,
      summary,
      content,
      mood: mood ? (MOOD_EMOJIS[mood] || mood) : undefined,
      tags
    });

    res.status(201).json({ log });
  } catch (error) {
    console.error('Create life log error:', error);
    res.status(500).json({ error: 'Failed to create life log' });
  }
});

/**
 * PUT /api/lifelog/:id
 * Life Log 수정
 */
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { summary, content, mood, tags } = req.body;

    const existing = await getLifeLogById(id);
    if (!existing) {
      res.status(404).json({ error: 'Life log not found' });
      return;
    }

    if (existing.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to update this log' });
      return;
    }

    const log = await updateLifeLog(id, {
      summary,
      content,
      mood: mood ? (MOOD_EMOJIS[mood] || mood) : undefined,
      tags
    });

    res.json({ log });
  } catch (error) {
    console.error('Update life log error:', error);
    res.status(500).json({ error: 'Failed to update life log' });
  }
});

/**
 * DELETE /api/lifelog/:id
 * Life Log 삭제
 */
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await getLifeLogById(id);
    if (!existing) {
      res.status(404).json({ error: 'Life log not found' });
      return;
    }

    if (existing.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized to delete this log' });
      return;
    }

    await deleteLifeLog(id);
    res.json({ message: 'Life log deleted' });
  } catch (error) {
    console.error('Delete life log error:', error);
    res.status(500).json({ error: 'Failed to delete life log' });
  }
});

// ==============================================
// AI-Enhanced Features
// ==============================================

/**
 * POST /api/lifelog/:id/regenerate
 * 기존 로그를 AI로 다시 생성
 */
router.post('/:id/regenerate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const existing = await getLifeLogById(id);
    if (!existing) {
      res.status(404).json({ error: 'Life log not found' });
      return;
    }

    if (existing.user_id !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const user = await getUserById(userId);
    const targetDate = existing.log_date;

    const [events, todos, weather] = await Promise.all([
      getEventsByUser(userId, targetDate, targetDate),
      getTodosByUser(userId),
      getCurrentWeather(user?.location || 'Seoul')
    ]);

    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      return t.completed_at.split('T')[0] === targetDate;
    });

    const generatedLog = await generateLifeLog(
      user?.name || user?.nickname || '사용자',
      targetDate,
      events,
      completedTodos,
      weather?.condition
    );

    const log = await updateLifeLog(id, {
      summary: generatedLog.summary,
      content: generatedLog.content,
      mood: generatedLog.mood,
      tags: generatedLog.tags
    });

    res.json({ log });
  } catch (error) {
    console.error('Regenerate life log error:', error);
    res.status(500).json({ error: 'Failed to regenerate life log' });
  }
});

/**
 * GET /api/lifelog/insights/weekly
 * 주간 인사이트 (AI 분석)
 */
router.get('/insights/weekly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // 최근 7일간의 로그 조회
    const logs = await getLifeLogsByUser(userId, 7);

    if (logs.length === 0) {
      res.json({
        message: '아직 분석할 데이터가 부족해요. 일기를 더 작성해주세요!',
        insights: null
      });
      return;
    }

    const insights = await generateWeeklyInsights(logs);
    res.json(insights);
  } catch (error) {
    console.error('Get weekly insights error:', error);
    res.status(500).json({ error: 'Failed to generate insights' });
  }
});

/**
 * GET /api/lifelog/stats
 * Life Log 통계
 */
router.get('/stats/summary', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const logs = await getLifeLogsByUser(userId, 90); // 최근 90일

    // 무드 통계
    const moodCounts: Record<string, number> = {};
    logs.forEach(log => {
      if (log.mood) {
        moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      }
    });

    // 태그 통계
    const tagCounts: Record<string, number> = {};
    logs.forEach(log => {
      if (log.tags) {
        log.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });

    // 작성 빈도 (주간)
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const weeklyCount = logs.filter(l => new Date(l.log_date) >= weekAgo).length;
    const monthlyCount = logs.filter(l => new Date(l.log_date) >= monthAgo).length;

    // 연속 작성일 계산
    let streak = 0;
    const sortedLogs = logs.sort((a, b) => b.log_date.localeCompare(a.log_date));
    let expectedDate = new Date();

    for (const log of sortedLogs) {
      const logDate = new Date(log.log_date);
      const expectedDateStr = expectedDate.toISOString().split('T')[0];
      const logDateStr = log.log_date;

      if (logDateStr === expectedDateStr) {
        streak++;
        expectedDate.setDate(expectedDate.getDate() - 1);
      } else if (logDateStr < expectedDateStr) {
        break;
      }
    }

    res.json({
      total_logs: logs.length,
      weekly_count: weeklyCount,
      monthly_count: monthlyCount,
      current_streak: streak,
      mood_distribution: moodCounts,
      top_tags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tag, count]) => ({ tag, count }))
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// ==============================================
// AI Generation Functions
// ==============================================

interface GeneratedLog {
  summary: string;
  content: string;
  mood: string;
  tags: string[];
}

async function generateLifeLog(
  userName: string,
  date: string,
  events: Event[],
  completedTodos: Todo[],
  weather?: string
): Promise<GeneratedLog> {
  const eventSummary = events.length > 0
    ? events.map(e => `- ${e.start_time || ''} ${e.title}${e.is_completed ? ' (완료)' : ''}`).join('\n')
    : '오늘 특별한 일정 없음';

  const todoSummary = completedTodos.length > 0
    ? completedTodos.map(t => `- ${t.title}`).join('\n')
    : '완료한 할일 없음';

  const prompt = `당신은 ${userName}의 개인 비서입니다. 아래 하루 데이터를 바탕으로 따뜻하고 개인적인 일기를 작성해주세요.

날짜: ${date}
${weather ? `날씨: ${weather}` : ''}

오늘 일정:
${eventSummary}

완료한 할일:
${todoSummary}

다음 JSON 형식으로 응답하세요:
{
  "summary": "한 줄 요약 (15자 이내)",
  "content": "3-5문장의 일기 본문. 1인칭 시점으로 작성. 감정과 생각을 포함",
  "mood": "great/good/neutral/tired/sad/stressed/excited/peaceful 중 하나",
  "tags": ["태그1", "태그2"] // 1-3개의 관련 태그
}

일기는 친근하고 자연스러운 말투로 작성하세요. 한국어로 작성합니다.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
      summary: result.summary || '하루 기록',
      content: result.content || '오늘도 수고했다.',
      mood: MOOD_EMOJIS[result.mood] || '😐',
      tags: result.tags || []
    };
  } catch (error) {
    console.error('Generate life log error:', error);
    return {
      summary: '하루 기록',
      content: events.length > 0
        ? `오늘은 ${events.length}개의 일정이 있었다. ${completedTodos.length}개의 할일을 완료했다.`
        : '오늘은 비교적 여유로운 하루였다.',
      mood: '😐',
      tags: []
    };
  }
}

interface WeeklyInsights {
  message: string;
  patterns: {
    most_productive_day?: string;
    common_mood?: string;
    recurring_themes?: string[];
  };
  recommendations: string[];
}

async function generateWeeklyInsights(logs: LifeLog[]): Promise<WeeklyInsights> {
  const logSummaries = logs.map(l => ({
    date: l.log_date,
    summary: l.summary,
    mood: l.mood,
    tags: l.tags
  }));

  const prompt = `아래 일주일간의 일기 데이터를 분석하고 인사이트를 제공해주세요.

일기 데이터:
${JSON.stringify(logSummaries, null, 2)}

다음 JSON 형식으로 응답하세요:
{
  "message": "주간 분석 메시지 (2-3문장)",
  "patterns": {
    "most_productive_day": "가장 생산적이었던 요일",
    "common_mood": "주로 나타난 감정",
    "recurring_themes": ["반복되는 주제 1", "주제 2"]
  },
  "recommendations": ["추천 1", "추천 2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 500
    });

    return JSON.parse(response.choices[0]?.message?.content || '{}');
  } catch (error) {
    console.error('Generate insights error:', error);
    return {
      message: '이번 주도 수고하셨어요!',
      patterns: {},
      recommendations: ['꾸준히 일기를 작성해보세요']
    };
  }
}

export default router;
