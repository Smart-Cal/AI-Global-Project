import OpenAI from 'openai';
import { ParsedInput, ParsedEvent, ParsedTodo } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Parser Agent
 * 역할: 자연어 입력을 구조화된 데이터로 변환
 * 입력: "내일 3시에 팀 미팅 있어"
 * 출력: { type: 'fixed', title: '팀 미팅', datetime: '2024-01-10 15:00' }
 */
export async function parseUserInput(
  userMessage: string,
  currentDate: string = new Date().toISOString()
): Promise<ParsedInput> {
  // 현재 날짜 기준으로 이번 주의 날짜들 계산
  const now = new Date(currentDate);
  const dayOfWeek = now.getDay(); // 0=일, 1=월, ...
  const weekDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    const diff = i - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 월요일 시작
    d.setDate(now.getDate() + diff + (i === 0 ? 0 : i - 1));
    const date = new Date(now);
    date.setDate(now.getDate() + i);
    weekDates.push(date.toISOString().split('T')[0]);
  }

  const systemPrompt = `You are an AI assistant who plans and recommends schedules for the user.

Current Time: ${currentDate}
Today's Date: ${now.toISOString().split('T')[0]}
This Week's Dates: ${weekDates.join(', ')}

## Core Principles - VERY IMPORTANT!

### Single Event Addition (e.g., "Dinner with friend tomorrow", "Team meeting on Friday")
**If exact time is not specified, you MUST ask!**
- Vague terms like "morning", "afternoon", "evening" are valid only if specific enough, otherwise ask.
- If any of the following is missing, needs_clarification = true:
  1. Exact Time (e.g., "3 PM", "15:00")
  2. Estimated Duration (especially for meetings/appointments)
- Also ask for location for appointments/meetings/meals.

### Multiple Events/Planning Requests (e.g., "Plan my workout schedule for this week")
- Only then, proactively create schedules.
- This applies when user explicitly asks "Recommend", "Plan", "Set up schedule".

### Questioning Rules
- Ask for all missing info at once (time, duration, location).
- If user says "I don't know", "Anything", "Whatever", use default values.
- Do not ask the same question twice.

## Question Examples
- "What time are you meeting? How long will it last, and where?"
- "What time is the meeting? How long will it take?"

## Defaults (If user doesn't know or after second prompt)
- Time: 3 PM (15:00)
- Duration: 1 hour (60 min)
- Location: null

## Automatic Time Allocation (Only for Planning/Recommendation requests!)
- Workout: 7 AM or 7 PM (1 hour)
- Study/Work: 10 AM or 2 PM (2 hours)
- Meeting: 3 PM (1 hour)

## Category Classification Rules
- "workout": gym, jogging, yoga, swimming, hiking, workout
- "work": meeting, office, project, presentation, work
- "study": study, class, exam, certification, learning
- "social": friend, date, party, dinner, lunch, appointment
- "personal": hobby, rest, reading, movie, shopping, clinic
- "default": if unclear

## Location Rules
- Use user-specified location if available.
- Auto-recommend location based on activity type for planning requests.
- null if not specified for single events.

## Response JSON Format
{
  "type": "fixed" | "personal" | "goal" | "todo" | "unknown",
  "events": [
    {
      "title": "Event Title",
      "datetime": "YYYY-MM-DDTHH:mm:ss",
      "duration": 60,
      "location": "Location (optional)",
      "type": "fixed" | "personal" | "goal",
      "description": "Description (optional)",
      "category": "Category Name"
    }
  ],
  "todos": [],
  "intent": "User intent summary",
  "needs_clarification": false,
  "clarification_question": null
}

## Examples

### Ex 1: Vague time -> Ask!
Input: "Dinner with friend tomorrow"
Output:
{
  "type": "fixed",
  "events": [],
  "todos": [],
  "intent": "Dinner with friend",
  "needs_clarification": true,
  "clarification_question": "What time are you meeting? How long will it last, and where?"
}

### Ex 2: No time -> Ask!
Input: "Team meeting Friday"
Output:
{
  "type": "fixed",
  "events": [],
  "todos": [],
  "intent": "Team meeting",
  "needs_clarification": true,
  "clarification_question": "What time is the meeting? How long will it take?"
}

### Ex 3: Exact time -> Create
Input: "Team meeting tomorrow 3 PM for 1 hour"
Output:
{
  "type": "fixed",
  "events": [
    {"title": "Team Meeting", "datetime": "${weekDates[1]}T15:00:00", "duration": 60, "type": "fixed", "category": "work", "location": null}
  ],
  "todos": [],
  "intent": "Team meeting schedule",
  "needs_clarification": false
}

### Ex 4: Plan/Recommend -> Create immediately
Input: "Plan workout for this week"
Output:
{
  "type": "personal",
  "events": [
    {"title": "Workout", "datetime": "${weekDates[0]}T19:00:00", "duration": 60, "type": "personal", "category": "workout", "location": "Gym"},
    {"title": "Workout", "datetime": "${weekDates[1]}T19:00:00", "duration": 60, "type": "personal", "category": "workout", "location": "Gym"},
    {"title": "Workout", "datetime": "${weekDates[2]}T19:00:00", "duration": 60, "type": "personal", "category": "workout", "location": "Gym"}
  ],
  "todos": [],
  "intent": "Workout plan for this week",
  "needs_clarification": false
}

### Ex 5: User says "I don't know" -> Default
Input: "I don't know, just set it up"
Output:
{
  "type": "fixed",
  "events": [
    {"title": "Dinner Appointment", "datetime": "${weekDates[1]}T15:00:00", "duration": 60, "type": "fixed", "category": "social", "location": null}
  ],
  "todos": [],
  "intent": "Default schedule creation",
  "needs_clarification": false
}

ALWAYS output valid JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed: ParsedInput = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error('Parser Agent error:', error);
    return {
      type: 'unknown',
      events: [],
      todos: [],
      intent: '파싱 실패',
      needs_clarification: true,
      clarification_question: 'Sorry, could you plan say that again?'
    };
  }
}

/**
 * 이벤트 타입 분류
 */
export function classifyEventType(text: string): 'fixed' | 'personal' | 'goal' {
  const fixedKeywords = ['meeting', 'appointment', 'doctor', 'interview', 'presentation', 'clinic', 'reservation', 'call', 'summit'];
  const goalKeywords = ['study', 'exam', 'certification', 'project', 'learning', 'prepare', 'test', 'homework'];

  const lowerText = text.toLowerCase();

  if (fixedKeywords.some(k => lowerText.includes(k))) return 'fixed';
  if (goalKeywords.some(k => lowerText.includes(k))) return 'goal';
  return 'personal';
}

/**
 * 자연어 시간 표현을 ISO datetime으로 변환
 */
export function parseTimeExpression(expression: string, baseDate: Date = new Date()): string {
  const result = new Date(baseDate);

  // Date parsing
  const lowerExpr = expression.toLowerCase();
  if (lowerExpr.includes('tomorrow')) {
    result.setDate(result.getDate() + 1);
  } else if (lowerExpr.includes('day after tomorrow')) {
    result.setDate(result.getDate() + 2);
  } else if (lowerExpr.includes('next week')) {
    result.setDate(result.getDate() + 7);
  }

  // Time parsing
  const timeMatch = expression.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const ampm = timeMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    result.setHours(hour, minute, 0, 0);
  } else if (lowerExpr.includes('morning')) {
    result.setHours(9, 0, 0, 0);
  } else if (lowerExpr.includes('noon') || lowerExpr.includes('lunch')) {
    result.setHours(12, 0, 0, 0);
  } else if (lowerExpr.includes('evening') || lowerExpr.includes('dinner') || lowerExpr.includes('night')) {
    result.setHours(18, 0, 0, 0);
  }

  return result.toISOString();
}
