import { Router, Response } from 'express';
import OpenAI from 'openai';
import {
  getEventsByUser,
  getTodosByUser,
  getGoalsByUser,
  getUserById
} from '../services/database.js';
import {
  getCurrentWeather,
  getWeatherForecast,
  getWeatherByCoords,
  getCityFromCoords,
  getActivityRecommendation,
  WeatherData
} from '../services/weather.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Event, Todo, Goal, MorningBriefing, EveningBriefing } from '../types/index.js';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ==============================================
// Morning Briefing
// ==============================================

/**
 * GET /api/briefing/morning
 * 아침 브리핑: 오늘 일정, 날씨, 미완료 할일, AI 메시지
 * Query params: lat, lon (optional) - 좌표 기반 날씨 조회
 */
router.get('/morning', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // 좌표가 있으면 좌표 기반, 없으면 도시명 기반
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const hasCoords = !isNaN(lat) && !isNaN(lon);

    let weather: WeatherData | null = null;
    let city = user.location || 'Seoul';

    if (hasCoords) {
      const coordsResult = await getWeatherByCoords(lat, lon);
      if (coordsResult) {
        weather = coordsResult.weather;
        city = coordsResult.city;
      }
    } else {
      weather = await getCurrentWeather(city);
    }

    // 병렬로 데이터 조회
    const [events, todos] = await Promise.all([
      getEventsByUser(userId, today, today),
      getTodosByUser(userId)
    ]);

    // 오늘 일정만 필터링
    const todayEvents = events.filter(e => e.event_date === today);

    // 미완료 Todo (마감이 오늘이거나 지난 것)
    const incompleteTodos = todos.filter(t => {
      if (t.is_completed) return false;
      if (!t.deadline) return true; // 마감 없으면 포함
      const deadline = t.deadline.split('T')[0];
      return deadline <= today;
    });

    // AI 브리핑 메시지 생성
    const message = await generateMorningMessage(
      user.name || user.nickname || '사용자',
      todayEvents,
      incompleteTodos,
      weather,
      user.chronotype
    );

    const briefing: MorningBriefing = {
      weather: weather ? {
        temperature: weather.temperature,
        condition: weather.condition,
        icon: weather.icon,
        recommendation: weather.recommendation,
        city
      } : undefined,
      today_events: todayEvents,
      incomplete_todos: incompleteTodos,
      message
    };

    res.json(briefing);
  } catch (error) {
    console.error('Morning briefing error:', error);
    res.status(500).json({ error: 'Failed to generate morning briefing' });
  }
});

/**
 * GET /api/briefing/evening
 * 저녁 브리핑: 오늘 완료된 일정/할일, 달성률, 내일 첫 일정
 * Query params: lat, lon (optional) - 좌표 기반 날씨 조회
 */
router.get('/evening', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // 좌표가 있으면 좌표 기반, 없으면 도시명 기반
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const hasCoords = !isNaN(lat) && !isNaN(lon);

    let tomorrowWeather: WeatherData | null = null;
    let city = user.location || 'Seoul';

    if (hasCoords) {
      const coordsResult = await getWeatherByCoords(lat, lon);
      if (coordsResult) {
        tomorrowWeather = coordsResult.weather;
        city = coordsResult.city;
      }
    } else {
      tomorrowWeather = await getCurrentWeather(city);
    }

    // 데이터 조회
    const [todayEvents, tomorrowEvents, todos] = await Promise.all([
      getEventsByUser(userId, todayStr, todayStr),
      getEventsByUser(userId, tomorrowStr, tomorrowStr),
      getTodosByUser(userId)
    ]);

    // 오늘 완료된 일정
    const completedEvents = todayEvents.filter(e => e.is_completed);

    // 오늘 완료된 Todo
    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = t.completed_at.split('T')[0];
      return completedDate === todayStr;
    });

    // 달성률 계산
    const totalTodayTasks = todayEvents.length + todos.filter(t => {
      if (!t.deadline) return false;
      return t.deadline.split('T')[0] === todayStr;
    }).length;
    const completedTasks = completedEvents.length + completedTodos.length;
    const completionRate = totalTodayTasks > 0
      ? Math.round((completedTasks / totalTodayTasks) * 100)
      : 100;

    // 내일 첫 일정
    const tomorrowFirstEvent = tomorrowEvents
      .filter(e => e.start_time)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))[0];

    // AI 브리핑 메시지 생성
    const message = await generateEveningMessage(
      user.name || user.nickname || '사용자',
      completedEvents,
      completedTodos,
      completionRate,
      tomorrowFirstEvent
    );

    const briefing: EveningBriefing = {
      completed_events: completedEvents,
      completed_todos: completedTodos,
      completion_rate: completionRate,
      tomorrow_first_event: tomorrowFirstEvent,
      tomorrow_weather: tomorrowWeather ? {
        temperature: tomorrowWeather.temperature,
        condition: tomorrowWeather.condition,
        icon: tomorrowWeather.icon,
        recommendation: tomorrowWeather.recommendation,
        city
      } : undefined,
      message
    };

    res.json(briefing);
  } catch (error) {
    console.error('Evening briefing error:', error);
    res.status(500).json({ error: 'Failed to generate evening briefing' });
  }
});

// ==============================================
// Weather API
// ==============================================

/**
 * GET /api/briefing/weather
 * 현재 날씨 조회
 */
router.get('/weather', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);
    const city = (req.query.city as string) || user?.location || 'Seoul';

    const weather = await getCurrentWeather(city);

    if (!weather) {
      res.status(503).json({ error: 'Weather service unavailable' });
      return;
    }

    const activities = getActivityRecommendation(weather);

    res.json({
      ...weather,
      city,
      activity_recommendations: activities
    });
  } catch (error) {
    console.error('Get weather error:', error);
    res.status(500).json({ error: 'Failed to get weather' });
  }
});

/**
 * GET /api/briefing/weather/forecast
 * 날씨 예보 조회 (5일)
 */
router.get('/weather/forecast', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);
    const city = (req.query.city as string) || user?.location || 'Seoul';
    const days = parseInt(req.query.days as string) || 5;

    const forecast = await getWeatherForecast(city, Math.min(days, 5));

    res.json({
      city,
      forecast
    });
  } catch (error) {
    console.error('Get weather forecast error:', error);
    res.status(500).json({ error: 'Failed to get weather forecast' });
  }
});

/**
 * GET /api/briefing/weather/coords
 * 좌표 기반 날씨 조회
 */
router.get('/weather/coords', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'Invalid coordinates. lat and lon are required.' });
      return;
    }

    const result = await getWeatherByCoords(lat, lon);

    if (!result) {
      res.status(503).json({ error: 'Weather service unavailable' });
      return;
    }

    const activities = getActivityRecommendation(result.weather);

    res.json({
      ...result.weather,
      city: result.city,
      activity_recommendations: activities
    });
  } catch (error) {
    console.error('Get weather by coords error:', error);
    res.status(500).json({ error: 'Failed to get weather' });
  }
});

/**
 * GET /api/briefing/geocode/reverse
 * 좌표로 도시명 조회 (역지오코딩)
 */
router.get('/geocode/reverse', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'Invalid coordinates. lat and lon are required.' });
      return;
    }

    const city = await getCityFromCoords(lat, lon);

    if (!city) {
      res.status(404).json({ error: 'City not found for given coordinates' });
      return;
    }

    res.json({ city, lat, lon });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({ error: 'Failed to reverse geocode' });
  }
});

// ==============================================
// Weekly Review
// ==============================================

/**
 * GET /api/briefing/weekly
 * 주간 리뷰: 이번 주 달성률, 완료된 목표, 다음 주 예정
 */
router.get('/weekly', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const user = await getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 이번 주 일요일
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const nextWeekStart = new Date(weekEnd);
    nextWeekStart.setDate(weekEnd.getDate() + 1);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];
    const nextWeekStartStr = nextWeekStart.toISOString().split('T')[0];
    const nextWeekEndStr = nextWeekEnd.toISOString().split('T')[0];

    // 데이터 조회
    const [thisWeekEvents, nextWeekEvents, todos, goals] = await Promise.all([
      getEventsByUser(userId, weekStartStr, weekEndStr),
      getEventsByUser(userId, nextWeekStartStr, nextWeekEndStr),
      getTodosByUser(userId),
      getGoalsByUser(userId)
    ]);

    // 이번 주 완료된 일정
    const completedEvents = thisWeekEvents.filter(e => e.is_completed);

    // 이번 주 완료된 Todo
    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = t.completed_at.split('T')[0];
      return completedDate >= weekStartStr && completedDate <= weekEndStr;
    });

    // 이번 주 완료된 Goal
    const completedGoals = goals.filter(g => g.status === 'completed');

    // 진행 중인 Goal
    const activeGoals = goals.filter(g => ['planning', 'scheduled', 'in_progress'].includes(g.status));

    // 주간 달성률
    const totalTasks = thisWeekEvents.length;
    const completionRate = totalTasks > 0
      ? Math.round((completedEvents.length / totalTasks) * 100)
      : 100;

    // AI 주간 리뷰 메시지
    const message = await generateWeeklyMessage(
      user.name || user.nickname || '사용자',
      completedEvents.length,
      completedTodos.length,
      completedGoals.length,
      activeGoals.length,
      completionRate,
      nextWeekEvents.length
    );

    res.json({
      week_range: {
        start: weekStartStr,
        end: weekEndStr
      },
      statistics: {
        total_events: thisWeekEvents.length,
        completed_events: completedEvents.length,
        completed_todos: completedTodos.length,
        completed_goals: completedGoals.length,
        active_goals: activeGoals.length,
        completion_rate: completionRate
      },
      next_week: {
        range: {
          start: nextWeekStartStr,
          end: nextWeekEndStr
        },
        event_count: nextWeekEvents.length,
        events: nextWeekEvents.slice(0, 5) // 상위 5개만
      },
      message
    });
  } catch (error) {
    console.error('Weekly review error:', error);
    res.status(500).json({ error: 'Failed to generate weekly review' });
  }
});

// ==============================================
// AI Message Generators
// ==============================================

async function generateMorningMessage(
  userName: string,
  events: Event[],
  todos: Todo[],
  weather: WeatherData | null,
  chronotype: string
): Promise<string> {
  const hour = new Date().getHours();
  let greeting = '좋은 아침이에요';
  if (hour < 6) greeting = '일찍 일어나셨네요';
  else if (hour >= 12) greeting = '좋은 오후예요';

  const prompt = `당신은 친근한 AI 비서입니다. 아래 정보를 바탕으로 따뜻하고 격려하는 아침 브리핑 메시지를 2-3문장으로 작성하세요.

사용자 이름: ${userName}
사용자 크로노타입: ${chronotype}
오늘 일정 수: ${events.length}개
미완료 할일 수: ${todos.length}개
날씨: ${weather ? `${weather.temperature}°C, ${weather.condition}` : '정보 없음'}
${weather?.recommendation ? `옷차림 추천: ${weather.recommendation}` : ''}

시간대에 맞는 인사와 함께 오늘 하루를 응원하는 메시지를 작성하세요.
예시: "${greeting}, ${userName}님! 오늘은 3개의 일정이 있네요. 화이팅!"`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || `${greeting}, ${userName}님! 오늘도 좋은 하루 되세요.`;
  } catch (error) {
    console.error('Morning message generation error:', error);
    return `${greeting}, ${userName}님! 오늘 일정 ${events.length}개, 할일 ${todos.length}개가 있어요. 화이팅!`;
  }
}

async function generateEveningMessage(
  userName: string,
  completedEvents: Event[],
  completedTodos: Todo[],
  completionRate: number,
  tomorrowFirstEvent?: Event
): Promise<string> {
  const prompt = `당신은 친근한 AI 비서입니다. 아래 정보를 바탕으로 하루를 마무리하는 저녁 브리핑 메시지를 2-3문장으로 작성하세요.

사용자 이름: ${userName}
오늘 완료한 일정: ${completedEvents.length}개
오늘 완료한 할일: ${completedTodos.length}개
달성률: ${completionRate}%
내일 첫 일정: ${tomorrowFirstEvent ? `${tomorrowFirstEvent.start_time} ${tomorrowFirstEvent.title}` : '없음'}

오늘 하루를 격려하고, 내일을 준비할 수 있도록 따뜻한 메시지를 작성하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || `오늘도 수고하셨어요, ${userName}님! 푹 쉬세요.`;
  } catch (error) {
    console.error('Evening message generation error:', error);
    return `오늘 ${completionRate}% 달성하셨네요! 수고하셨어요, ${userName}님.`;
  }
}

async function generateWeeklyMessage(
  userName: string,
  completedEvents: number,
  completedTodos: number,
  completedGoals: number,
  activeGoals: number,
  completionRate: number,
  nextWeekEventCount: number
): Promise<string> {
  const prompt = `당신은 친근한 AI 비서입니다. 아래 정보를 바탕으로 주간 리뷰 메시지를 2-3문장으로 작성하세요.

사용자 이름: ${userName}
이번 주 완료 일정: ${completedEvents}개
이번 주 완료 할일: ${completedTodos}개
완료한 목표: ${completedGoals}개
진행 중인 목표: ${activeGoals}개
주간 달성률: ${completionRate}%
다음 주 예정된 일정: ${nextWeekEventCount}개

한 주를 정리하고 다음 주를 준비할 수 있도록 격려하는 메시지를 작성하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0]?.message?.content || `이번 주도 수고하셨어요, ${userName}님!`;
  } catch (error) {
    console.error('Weekly message generation error:', error);
    return `이번 주 달성률 ${completionRate}%! 다음 주도 화이팅, ${userName}님!`;
  }
}

export default router;
