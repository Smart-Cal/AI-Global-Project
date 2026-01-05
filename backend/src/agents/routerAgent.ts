import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export type IntentType = 'event' | 'todo' | 'goal' | 'briefing' | 'general' | 'clarification' | 'shopping' | 'places' | 'news';

export interface RouterResult {
  intent: IntentType;
  confidence: number;
  extractedInfo: {
    // 공통
    title?: string;
    description?: string;
    category?: string;
    priority?: 'high' | 'medium' | 'low';

    // 일정용
    datetime?: string;
    duration?: number;
    location?: string;

    // 목표용
    targetDate?: string;

    // 할일용
    deadline?: string;
    estimatedTime?: number;

    // 쇼핑용
    productQuery?: string;
    minPrice?: number;
    maxPrice?: number;

    // 장소용
    placeQuery?: string;
    placeType?: string;
    nearLocation?: string;

    // 뉴스용
    newsQuery?: string;
    newsCategory?: string;
    timeRange?: string;  // 'overnight', 'today', 'week'
  };
  missingInfo?: string[];
  clarificationQuestion?: string;
  originalMessage: string;
}

/**
 * Router Agent - 사용자 의도를 파악하고 정보를 추출하는 전문 에이전트
 */
export async function routeIntent(
  userMessage: string,
  context: {
    today: string;
    endOfMonth: string;
    endOfWeek: string;
    categories: string[];
  }
): Promise<RouterResult> {
  const systemPrompt = `You are an expert analyst who identifies user intent and extracts information.

## Role
1. Identify intent from user input.
2. Extract all information (explicit + implicit).
3. Identify missing information.

## Intent Classification (IMPORTANT!)
- "event": Add schedule/appointment/meeting (Time-specific)
- "todo": Add task/todo
- "goal": Set goal (Keywords: want to, will, goal, achieve, lose weight, success)
- "briefing": Check today's schedule, what's up, tell me my schedule
- "shopping": Search products, shopping recommendations, buy, price check
- "places": Search places, recommend restaurant, nearby, where to go
- "news": News summary, last night's news, latest news
- "general": General conversation (Only if none of above)
- "clarification": Need more info to classify

## Rules for "shopping"
- "Recommend product" -> shopping
- "Should I buy...?" -> shopping
- "Price comparison" -> shopping
- "Recommend" + product name -> shopping
- Ex: "Recommend running shoes", "Sneakers under $100", "Compare laptop prices"

## Rules for "places"
- "Nearby restaurant" -> places
- "Where is good?" -> places
- "Recommend" + place/restaurant -> places
- Ex: "Restaurant near Gangnam", "Quiet cafe", "Date spot"

## Rules for "news"
- "Last night's news" -> news
- "Today's news" -> news
- "Latest updates" -> news
- "Summarize news" -> news
- Ex: "What happened yesterday?", "News briefing", "Tech news"

## Rules for "goal" (VERY IMPORTANT!)
- "want to" -> goal (e.g. "want to lose 5kg")
- "will" -> goal (e.g. "will get 900 on TOEIC")
- "have to" -> goal (e.g. "have to lose weight")
- "achieve" -> goal
- Number + Period + Goal expression -> goal

## Current Info
- Today: ${context.today}
- End of Month: ${context.endOfMonth}
- End of Week: ${context.endOfWeek}

## Date Parsing Rules (VERY IMPORTANT!)
- "this month" -> ${context.endOfMonth}
- "this week" -> ${context.endOfWeek}
- "tomorrow" -> Today + 1 day
- "day after tomorrow" -> Today + 2 days
- "next Monday" -> Calculate exact date
- "in 3 months" -> Today + 3 months
- "this year" -> Dec 31

## Category Inference
- Weight loss, workout, diet, gym -> "workout"
- Study, exam, certification -> "study"
- Meeting, work, office -> "work"
- Appointment, date -> "social"
- Others -> "personal"

## Response Format (JSON)
{
  "intent": "event" | "todo" | "goal" | "briefing" | "shopping" | "places" | "news" | "general" | "clarification",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "title": "Extracted Title",
    "datetime": "YYYY-MM-DDTHH:mm:ss (for event)",
    "targetDate": "YYYY-MM-DD (for goal)",
    "deadline": "YYYY-MM-DD (for todo)",
    "duration": 60,
    "location": "Location",
    "category": "Category",
    "priority": "high" | "medium" | "low",
    "description": "Description",
    "productQuery": "Search query (for shopping)",
    "minPrice": 0,
    "maxPrice": 100000,
    "placeQuery": "Place query (for places)",
    "placeType": "restaurant | cafe | etc",
    "nearLocation": "Nearby location",
    "newsQuery": "News query (for news)",
    "newsCategory": "business | technology | sports | etc",
    "timeRange": "overnight | today | week"
  },
  "missingInfo": ["List of missing info"],
  "clarificationQuestion": "Question only if needed"
}

## Examples

Input: "I want to lose 5kg this month"
→ intent: "goal"
→ extractedInfo: { title: "Lose 5kg", targetDate: "${context.endOfMonth}", category: "workout", priority: "high" }
→ missingInfo: []

Input: "Team meeting tomorrow at 3 PM"
→ intent: "event"
→ extractedInfo: { title: "Team Meeting", datetime: "tomorrowT15:00:00", category: "work" }
→ missingInfo: []

Input: "Recommend running shoes"
→ intent: "shopping"
→ extractedInfo: { productQuery: "running shoes", category: "sports" }

Input: "Recommend restaurant near Gangnam station"
→ intent: "places"
→ extractedInfo: { placeQuery: "restaurant", placeType: "restaurant", nearLocation: "Gangnam station" }

Input: "Summarize last night's news"
→ intent: "news"
→ extractedInfo: { timeRange: "overnight" }

Input: "Tell me tech news"
→ intent: "news"
→ extractedInfo: { newsCategory: "technology" }

Input: "I want to exercise"
→ intent: "clarification"
→ clarificationQuestion: "What kind of exercise? Do you have a goal?"

Input: "What's my schedule today?"
→ intent: "briefing"

ALWAYS output valid JSON only.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.1, // 낮은 temperature로 일관성 확보
    });

    const content = response.choices[0]?.message?.content || '{}';

    // JSON 추출
    let jsonContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    } else {
      const jsonStart = content.indexOf('{');
      const jsonEnd = content.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        jsonContent = content.substring(jsonStart, jsonEnd + 1);
      }
    }

    const parsed = JSON.parse(jsonContent);

    return {
      intent: parsed.intent || 'general',
      confidence: parsed.confidence || 0.5,
      extractedInfo: parsed.extractedInfo || {},
      missingInfo: parsed.missingInfo || [],
      clarificationQuestion: parsed.clarificationQuestion,
      originalMessage: userMessage
    };
  } catch (error) {
    console.error('Router Agent error:', error);
    return {
      intent: 'general',
      confidence: 0,
      extractedInfo: {},
      originalMessage: userMessage
    };
  }
}
