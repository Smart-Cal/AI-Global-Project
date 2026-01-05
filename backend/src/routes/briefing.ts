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
  checkPrecipitationForecast,
  checkPrecipitationByCoords,
  getWeatherForDate,
  WeatherData
} from '../services/weather.js';
import { AuthRequest, authenticate } from '../middleware/auth.js';
import { Event, Todo, Goal, MorningBriefing, EveningBriefing } from '../types/index.js';

const router = Router();
// OpenAI removed to avoid sentence generation as requested
// const openai = new OpenAI({ ... });

// ==============================================
// Morning Briefing
// ==============================================

/**
 * GET /api/briefing/morning
 * Morning Briefing: Today's schedule, weather, incomplete todos
 * Query params: lat, lon (optional) - Coordinates based weather
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

    // Use coords if provided, otherwise User location
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const hasCoords = !isNaN(lat) && !isNaN(lon);

    let weather: WeatherData | null = null;
    let city = user.location || 'Seoul';

    let precipitation: { willRain: boolean; willSnow: boolean; time?: string } | null = null;
    if (hasCoords) {
      const coordsResult = await getWeatherByCoords(lat, lon);
      if (coordsResult) {
        weather = coordsResult.weather;
        city = coordsResult.city;
      }
      precipitation = await checkPrecipitationByCoords(lat, lon, today);
    } else {
      weather = await getCurrentWeather(city);
      precipitation = await checkPrecipitationForecast(city, today);
    }

    // Default to no rain/snow if forecast check failed
    if (!precipitation) {
      console.log('[Morning Briefing] Precipitation check failed, using default');
      precipitation = { willRain: false, willSnow: false };
    } else {
      console.log('[Morning Briefing] Precipitation data:', precipitation);
    }

    // Fetch data in parallel
    const [events, todos] = await Promise.all([
      getEventsByUser(userId, today, today),
      getTodosByUser(userId)
    ]);

    // Filter today's events
    const todayEvents = events.filter(e => e.event_date === today);

    // Incomplete Todos (Deadline is today or past, or no deadline)
    const incompleteTodos = todos.filter(t => {
      if (t.is_completed) return false;
      if (!t.deadline) return true; // Include if no deadline
      const deadline = t.deadline.split('T')[0];
      return deadline <= today;
    });

    // Generate Briefing Message (Static, Data-driven)
    // NOTE: 'message' field is now used less by the frontend, but we keep it for compatibility.
    // The Frontend will primarily use the new 'precipitation' field in the response if available.
    const message = generateMorningMessage(
      user.name || user.nickname || 'User',
      todayEvents,
      incompleteTodos,
      weather,
      user.chronotype || 'neutral'
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
      message,
      precipitation: precipitation || undefined
    };

    res.json(briefing);
  } catch (error) {
    console.error('Morning briefing error:', error);
    res.status(500).json({ error: 'Failed to generate morning briefing' });
  }
});

/**
 * GET /api/briefing/evening
 * Evening Briefing: Completed tasks, rate, tomorrow's first event
 * Query params: lat, lon (optional)
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

    // Use coords if provided, otherwise User location
    const lat = parseFloat(req.query.lat as string);
    const lon = parseFloat(req.query.lon as string);
    const hasCoords = !isNaN(lat) && !isNaN(lon);

    let tomorrowWeather: WeatherData | null = null;
    let city = user.location || 'Seoul';

    let tomorrowPrecipitation: { willRain: boolean; willSnow: boolean; time?: string } | null = null;

    if (hasCoords) {
      // For tomorrow weather, we should use forecast, not current weather
      // But for simplicity, let's use current weather as placeholder
      const coordsResult = await getWeatherByCoords(lat, lon);
      if (coordsResult) {
        city = coordsResult.city;
      }
      // Get tomorrow's actual forecast
      tomorrowWeather = await getWeatherForDate(city, tomorrowStr);
      tomorrowPrecipitation = await checkPrecipitationByCoords(lat, lon, tomorrowStr);
    } else {
      // Get tomorrow's actual forecast instead of current weather
      tomorrowWeather = await getWeatherForDate(city, tomorrowStr);
      tomorrowPrecipitation = await checkPrecipitationForecast(city, tomorrowStr);
    }

    // Default to no rain/snow if forecast check failed
    if (!tomorrowPrecipitation) {
      tomorrowPrecipitation = { willRain: false, willSnow: false };
    }

    // Fetch Data
    const [todayEvents, tomorrowEvents, todos] = await Promise.all([
      getEventsByUser(userId, todayStr, todayStr),
      getEventsByUser(userId, tomorrowStr, tomorrowStr),
      getTodosByUser(userId)
    ]);

    // Completed Events
    const completedEvents = todayEvents.filter(e => e.is_completed);

    // Completed Todos
    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = t.completed_at.split('T')[0];
      return completedDate === todayStr;
    });

    // Calculate Completion Rate
    const totalTodayTasks = todayEvents.length + todos.filter(t => {
      if (!t.deadline) return false;
      return t.deadline.split('T')[0] === todayStr;
    }).length;
    const completedTasks = completedEvents.length + completedTodos.length;
    const completionRate = totalTodayTasks > 0
      ? Math.round((completedTasks / totalTodayTasks) * 100)
      : 100;

    // Tomorrow's First Event
    const tomorrowFirstEvent = tomorrowEvents
      .filter(e => e.start_time)
      .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))[0];

    // Generate Briefing Message (Static, Data-driven)
    const message = generateEveningMessage(
      user.name || user.nickname || 'User',
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
      message,
      precipitation: tomorrowPrecipitation || undefined
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
 * Get Current Weather
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
 * Get Weather Forecast (5 days)
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
 * Get Weather by Coordinates
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
 * Reverse Geocoding (Coords -> City)
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
 * Weekly Review: Completion rate, goals, next week preview
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
    weekStart.setDate(today.getDate() - today.getDay()); // Sunday of this week
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

    // Fetch Data
    const [thisWeekEvents, nextWeekEvents, todos, goals] = await Promise.all([
      getEventsByUser(userId, weekStartStr, weekEndStr),
      getEventsByUser(userId, nextWeekStartStr, nextWeekEndStr),
      getTodosByUser(userId),
      getGoalsByUser(userId)
    ]);

    // Completed Events
    const completedEvents = thisWeekEvents.filter(e => e.is_completed);

    // Completed Todos
    const completedTodos = todos.filter(t => {
      if (!t.is_completed || !t.completed_at) return false;
      const completedDate = t.completed_at.split('T')[0];
      return completedDate >= weekStartStr && completedDate <= weekEndStr;
    });

    // Completed Goals
    const completedGoals = goals.filter(g => g.status === 'completed');

    // Active Goals
    const activeGoals = goals.filter(g => ['planning', 'scheduled', 'in_progress'].includes(g.status));

    // Completion Rate
    const totalTasks = thisWeekEvents.length;
    const completionRate = totalTasks > 0
      ? Math.round((completedEvents.length / totalTasks) * 100)
      : 100;

    // Generate Weekly Message (Static, Data-driven)
    const message = generateWeeklyMessage(
      user.name || user.nickname || 'User',
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

// ==============================================
// Data-Driven Message Generators (No AI Sentences)
// ==============================================

function generateMorningMessage(
  userName: string,
  events: Event[],
  todos: Todo[],
  weather: WeatherData | null,
  chronotype: string
): string {
  let weatherInfo = 'No weather data.';
  if (weather) {
    weatherInfo = `${weather.temperature ? `${weather.temperature}°C` : ''} ${weather.condition || ''}. ${weather.recommendation || ''}`;
  }

  return `Today: ${events.length} Events, ${todos.length} Tasks.\nWeather: ${weatherInfo}`;
}

function generateEveningMessage(
  userName: string,
  completedEvents: Event[],
  completedTodos: Todo[],
  completionRate: number,
  tomorrowFirstEvent?: Event
): string {
  const tomorrowPreview = tomorrowFirstEvent
    ? `Tomorrow starts at ${tomorrowFirstEvent.start_time} with "${tomorrowFirstEvent.title}".`
    : 'No events scheduled for tomorrow morning.';

  return `Completed: ${completedEvents.length} Events, ${completedTodos.length} Tasks.\nDaily Completion Rate: ${completionRate}%\n${tomorrowPreview}`;
}

function generateWeeklyMessage(
  userName: string,
  completedEvents: number,
  completedTodos: number,
  completedGoals: number,
  activeGoals: number,
  completionRate: number,
  nextWeekEventCount: number
): string {
  return `Weekly Summary: ${completedEvents} Events / ${completedTodos} Tasks done. (Rate: ${completionRate}%)\nGoals: ${completedGoals} Completed, ${activeGoals} Active.\nNext Week: ${nextWeekEventCount} events scheduled.`;
}

export default router;
