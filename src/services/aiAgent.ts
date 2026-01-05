import OpenAI from 'openai';
import type {
  CalendarEvent,
  Goal,
  Todo,
  AgentType,
  AgentMessage,
  SuggestedEvent,
  Category,
} from '../types';
import { calculateGoalProgress } from '../types';

// Check if Goal is active
function isGoalActive(goal: Goal): boolean {
  return !['completed', 'failed'].includes(goal.status);
}

// Extract date from deadline
function getDeadlineDate(deadline?: string): string | undefined {
  if (!deadline) return undefined;
  return deadline.split('T')[0];
}

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const getWeekday = (date: Date): string => {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
};

const formatDate = (date: Date): string => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} (${getWeekday(date)})`;
};

// Summarize current events (including completion status)
const summarizeEvents = (events: CalendarEvent[], categories: Category[], days: number = 14): string => {
  if (!events.length) return 'No events registered.';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + days);

  const relevant = events.filter((e) => {
    const d = new Date(e.event_date);
    return d >= today && d <= futureDate;
  });

  if (!relevant.length) return `No events registered for the next ${days} days.`;

  return relevant.slice(0, 20).map((e) => {
    const time = e.start_time ? `${e.start_time.slice(0, 5)}~${e.end_time?.slice(0, 5) || ''}` : 'All day';
    const location = e.location ? ` @ ${e.location}` : '';
    const status = e.is_completed ? '[Completed]' : '';
    const category = categories.find(c => c.id === e.category_id);
    const categoryName = category ? `[${category.name}]` : '';
    return `- ${e.event_date} (${getWeekday(new Date(e.event_date))}) ${time}: ${categoryName}${status} ${e.title}${location}`;
  }).join('\n');
};

// Summarize goals (highlight target date and progress)
const summarizeGoals = (goals: Goal[], categories: Category[]): string => {
  const activeGoals = goals.filter(isGoalActive);
  if (!activeGoals.length) return 'No goals set.';

  const today = new Date().toISOString().split('T')[0];

  return activeGoals.map(g => {
    const progress = `Progress: ${calculateGoalProgress(g)}%`;
    const category = categories.find(c => c.id === g.category_id);
    const categoryName = category ? `[${category.name}]` : '';

    let deadlineInfo = '';
    if (g.target_date) {
      const daysLeft = Math.ceil((new Date(g.target_date).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) {
        deadlineInfo = ` (${Math.abs(daysLeft)} days overdue!)`;
      } else if (daysLeft === 0) {
        deadlineInfo = ' (Due today!)';
      } else if (daysLeft <= 7) {
        deadlineInfo = ` (${daysLeft} days left)`;
      } else {
        deadlineInfo = ` (Target: ${g.target_date})`;
      }
    }

    return `- ${categoryName} ${g.title} (${progress}${deadlineInfo})`;
  }).join('\n');
};

// Summarize Todos
const summarizeTodos = (todos: Todo[]): string => {
  const pending = todos.filter(t => !t.is_completed);
  if (!pending.length) return 'No todos.';

  return pending.slice(0, 10).map(t => {
    const deadlineDate = getDeadlineDate(t.deadline);
    const due = deadlineDate ? ` (Due: ${deadlineDate})` : '';
    const priority = t.priority === 'high' ? '[Urgent]' : t.priority === 'medium' ? '[Normal]' : '[Low]';
    return `${priority} ${t.title}${due}`;
  }).join('\n');
};

// Analyze user message to determine relevant agent types
const analyzeMessageForAgents = (message: string): AgentType[] => {
  const lowerMsg = message.toLowerCase();
  const agents: AgentType[] = [];

  // Health/Workout related
  if (/exercise|health|diet|weight|fat|jogging|running|yoga|stretching|swim|muscle|cardio|nutrition|gym|workout/i.test(lowerMsg)) {
    agents.push('health');
  }

  // Study/Learning related
  if (/study|learn|exam|test|toeic|toefl|cert|english|math|reading|book|lecture|class|assignment|homework|memorize|review/i.test(lowerMsg)) {
    agents.push('study');
  }

  // Career/Work related
  if (/meeting|work|project|job|career|interview|resume|presentation|report|business/i.test(lowerMsg)) {
    agents.push('career');
  }

  // Lifestyle/Appointments related
  if (/appointment|friend|date|trip|travel|restaurant|cafe|movie|concert|shopping|dinner|lunch|meal|meet|party|birthday/i.test(lowerMsg)) {
    agents.push('lifestyle');
  }

  // Schedule coordination related
  if (/schedule|time|when|adjust|change|conflict|empty|free|optimal|available/i.test(lowerMsg)) {
    agents.push('scheduler');
  }

  // Always include master
  if (!agents.includes('master')) {
    agents.unshift('master');
  }

  return agents;
};

// Generate list of next N days
const getNextNDays = (n: number): string[] => {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

// Find available slots
const findAvailableSlots = (events: CalendarEvent[], date: string): string[] => {
  const dayEvents = events
    .filter(e => e.event_date === date && e.start_time && e.end_time)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));

  const slots: string[] = [];
  const busyTimes = dayEvents.map(e => ({
    start: e.start_time!,
    end: e.end_time!
  }));

  // Default active hours: 07:00 ~ 22:00
  const dayStart = '07:00';
  const dayEnd = '22:00';

  if (busyTimes.length === 0) {
    slots.push(`${dayStart}~${dayEnd} (All day available)`);
    return slots;
  }

  let currentTime = dayStart;
  for (const busy of busyTimes) {
    if (currentTime < busy.start) {
      slots.push(`${currentTime}~${busy.start}`);
    }
    if (busy.end > currentTime) {
      currentTime = busy.end;
    }
  }

  if (currentTime < dayEnd) {
    slots.push(`${currentTime}~${dayEnd}`);
  }

  return slots;
};

// Generate main system prompt
const getMultiAgentSystemPrompt = (
  relevantAgents: AgentType[],
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[]
): string => {
  const today = new Date();
  const nextWeekDates = getNextNDays(7);

  // Calculate available slots for each date
  const availableSlotsByDate = nextWeekDates.map(date => {
    const slots = findAvailableSlots(events, date);
    const dayOfWeek = getWeekday(new Date(date));
    return `${date} (${dayOfWeek}): ${slots.length > 0 ? slots.join(', ') : 'No slots'}`;
  }).join('\n');

  // User defined categories
  const categoryList = categories.map(c => c.name).join(', ') || 'Default';

  return `You are an AI Assistant managing the user's schedule.

## Most Important Rules
**Focus ONLY on the user's current request.** Even if previous conversations were about other topics (e.g., exercise), if the current request is about something else (e.g., meals), recommend schedules fitting ONLY the current request.

## Current Time Information
Today: ${formatDate(today)}
Current Time: ${today.getHours()}:${today.getMinutes()}

## User Status

### Existing Schedule (Next 2 weeks):
${summarizeEvents(events, categories)}

### Free Slots (Next 7 days):
${availableSlotsByDate}

### User Goals:
${summarizeGoals(goals, categories)}

### Todos:
${summarizeTodos(todos)}

### User Categories:
${categoryList}

## Goal-Based Recommendation Strategy

When the user asks for schedule recommendations, consider the following:

1. **Relevance to Goals**: Check user goals and determine if the schedule helps achieve them.
2. **Time to Goal Target**: Closer target dates require more focused schedules.
3. **Progress Analysis**: Recommend allocating more time to goals with low progress.
4. **Existing Patterns**: Refer to the user's existing schedule patterns for appropriate timing.

## Important Guidelines

1. Propose specific schedules:
   - Must specify exact date (YYYY-MM-DD) and time (HH:MM).
   - Specify location concretely (e.g., "Park near home", "Near Hongdae Station", "At home").

2. Propose realistic schedules:
   - Check free slots and place in non-conflicting times.
   - Consider travel time (leave at least 30 mins between consecutive events).

3. Category Matching:
   - Select the most appropriate category from the user's defined categories.
   - Use "Default" if no matching category exists.

4. Response Format:
   - First, provide a simple 1-2 sentence explanation.
   - Then, MUST provide the schedule as a JSON array inside [SCHEDULES] tags.

5. JSON Format:

[SCHEDULES]
[
  {
    "title": "Event Title",
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM",
    "end_time": "HH:MM",
    "location": "Specific Location",
    "category_name": "User's Category Name (e.g., Study, Workout, etc.)",
    "description": "Details of what to do",
    "reason": "Why this time and activity is recommended"
  }
]
[/SCHEDULES]

6. NEVER do the following:
   - Do NOT use markdown symbols (*, #, **, ##, etc.).
   - Do NOT mix previous conversation topics into the current request.
   - Do NOT ask the user for the time back (you should propose it).`;
};

// JSON parsing helper
const parseSchedulesFromResponse = (text: string): SuggestedEvent[] => {
  try {
    // Extract JSON between [SCHEDULES] tags
    const match = text.match(/\[SCHEDULES\]([\s\S]*?)\[\/SCHEDULES\]/);
    if (match) {
      const jsonStr = match[1].trim();
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          title: item.title || '',
          date: item.date || '',
          start_time: item.start_time,
          end_time: item.end_time,
          location: item.location,
          category_name: item.category_name || item.category || 'Default',
          description: item.description,
          reason: item.reason || '',
        })).filter(e => e.title && e.date);
      }
    }

    // Alternative: Find general JSON array
    const jsonMatch = text.match(/\[\s*\{[\s\S]*?\}\s*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          title: item.title || '',
          date: item.date || '',
          start_time: item.start_time,
          end_time: item.end_time,
          location: item.location,
          category_name: item.category_name || item.category || 'Default',
          description: item.description,
          reason: item.reason || '',
        })).filter(e => e.title && e.date);
      }
    }
  } catch (e) {
    console.error('Failed to parse schedules:', e);
  }
  return [];
};

// Text cleanup (remove markdown symbols)
const cleanResponseText = (text: string): string => {
  return text
    .replace(/\[SCHEDULES\][\s\S]*?\[\/SCHEDULES\]/g, '') // Remove JSON block
    .replace(/\[\s*\{[\s\S]*?\}\s*\]/g, '') // Remove JSON array
    .replace(/#{1,6}\s*/g, '') // Remove headers
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // Remove bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // Remove code blocks
    .replace(/^[-*+]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove number lists
    .replace(/\n{3,}/g, '\n\n') // Clean excessive newlines
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
    .trim();
};

// Main chat function (Multi-Agent)
export const chatWithAgent = async (
  userInput: string,
  _agentType: AgentType, // Ignored as routing is now automatic
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[],
  history: AgentMessage[] = []
): Promise<AgentMessage> => {
  // 1. Analyze message to determine relevant agents
  const relevantAgents = analyzeMessageForAgents(userInput);
  const primaryAgent = relevantAgents[0];

  // 2. Generate system prompt
  const systemPrompt = getMultiAgentSystemPrompt(relevantAgents, events, goals, todos, categories);

  // 3. Construct conversation context (include previous recommended schedules)
  const conversationHistory = history.slice(-6).map((m) => {
    let content = m.content;
    // Include previously recommended schedules in context
    if (m.metadata?.suggested_events && m.metadata.suggested_events.length > 0) {
      const prevSchedules = m.metadata.suggested_events.map(e =>
        `- ${e.date} ${e.start_time || ''}: ${e.title}`
      ).join('\n');
      content += `\n\n[Previously Recommended Schedules]\n${prevSchedules}`;
    }
    return {
      role: m.role as 'user' | 'assistant',
      content
    };
  });

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userInput },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2500,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    // 4. Extract schedules
    const suggestedEvents = parseSchedulesFromResponse(rawContent);

    // 5. Clean text
    let cleanedText = cleanResponseText(rawContent);

    // If schedules exist, make text more concise
    if (suggestedEvents.length > 0 && cleanedText.length > 200) {
      // Keep only first 2 sentences
      const sentences = cleanedText.split(/[.!?]\s+/);
      cleanedText = sentences.slice(0, 2).join('. ').trim();
      if (cleanedText && !cleanedText.endsWith('.') && !cleanedText.endsWith('!') && !cleanedText.endsWith('?')) {
        cleanedText += '.';
      }
    }

    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: cleanedText || 'Schedules prepared.',
      agent_type: primaryAgent,
      timestamp: new Date(),
      metadata: {
        suggested_events: suggestedEvents.length > 0 ? suggestedEvents : undefined,
      },
    };
  } catch (error) {
    console.error('Agent Error:', error);
    return {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'AI service is temporarily unavailable. Please try again later.',
      agent_type: primaryAgent,
      timestamp: new Date(),
    };
  }
};

// Auto Generate Recommendations (Goal-based)
export const generateAutoRecommendations = async (
  events: CalendarEvent[],
  goals: Goal[],
  todos: Todo[],
  categories: Category[]
): Promise<AgentMessage | null> => {
  const activeGoals = goals.filter(isGoalActive);
  if (activeGoals.length === 0) return null;

  const goalSummary = activeGoals.map(g => {
    const category = categories.find(c => c.id === g.category_id);
    const categoryName = category ? category.name : '';
    return `"${g.title}"${categoryName ? ` (${categoryName})` : ''}`;
  }).join(', ');

  const prompt = `My goals are ${goalSummary}. Please recommend 2-3 concrete schedules to achieve these goals this week.`;

  return chatWithAgent(prompt, 'master', events, goals, todos, categories, []);
};

// Detect Scheduler Conflicts
export const detectScheduleConflicts = (events: CalendarEvent[]): string[] => {
  const conflicts: string[] = [];

  const sortedEvents = [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return a.event_date.localeCompare(b.event_date);
    }
    return (a.start_time || '00:00').localeCompare(b.start_time || '00:00');
  });

  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const current = sortedEvents[i];
    const next = sortedEvents[i + 1];

    if (current.event_date === next.event_date) {
      if (current.end_time && next.start_time) {
        if (current.end_time > next.start_time) {
          conflicts.push(
            `"${current.title}" (${current.start_time}~${current.end_time}) and "${next.title}" (${next.start_time}) overlap.`
          );
        }
      }
    }
  }

  return conflicts;
};
