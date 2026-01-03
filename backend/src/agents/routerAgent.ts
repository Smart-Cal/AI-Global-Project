import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export type IntentType = 'event' | 'todo' | 'goal' | 'briefing' | 'general' | 'clarification';

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
  const systemPrompt = `당신은 사용자 의도를 파악하고 정보를 추출하는 전문 분석가입니다.

## 역할
1. 사용자 발화에서 의도(intent) 파악
2. 발화에서 모든 정보 추출 (명시적 + 암시적)
3. 정말 없는 정보만 식별

## 의도 분류
- "event": 일정/약속/미팅/회의 등 시간이 정해진 활동
- "todo": 해야 할 일, 작업, 태스크
- "goal": 목표, 달성하고 싶은 것, ~하고 싶어
- "briefing": 오늘 일정, 뭐 있어, 알려줘
- "general": 일반 대화, 질문
- "clarification": 정보가 너무 부족해서 질문 필요

## 현재 정보
- 오늘: ${context.today}
- 이번 달 마지막 날: ${context.endOfMonth}
- 이번 주 일요일: ${context.endOfWeek}

## 날짜 해석 규칙 (매우 중요!)
- "이번달 안에", "이번 달까지" → ${context.endOfMonth}
- "이번주 안에", "이번 주까지" → ${context.endOfWeek}
- "내일" → 오늘 + 1일
- "모레" → 오늘 + 2일
- "다음주 월요일" → 정확한 날짜 계산
- "3개월 안에" → 오늘 + 3개월
- "올해 안에" → 12월 31일

## 카테고리 추론
- 감량, 운동, 다이어트, 헬스 → "운동"
- 공부, 토익, 시험, 자격증 → "공부"
- 회의, 미팅, 업무 → "업무"
- 약속, 만남, 데이트 → "약속"
- 그 외 → "개인"

## 응답 형식 (JSON)
{
  "intent": "event" | "todo" | "goal" | "briefing" | "general" | "clarification",
  "confidence": 0.0-1.0,
  "extractedInfo": {
    "title": "추출된 제목",
    "datetime": "YYYY-MM-DDTHH:mm:ss (일정용)",
    "targetDate": "YYYY-MM-DD (목표용)",
    "deadline": "YYYY-MM-DD (할일용)",
    "duration": 60,
    "location": "장소",
    "category": "카테고리",
    "priority": "high" | "medium" | "low",
    "description": "설명"
  },
  "missingInfo": ["없는 정보 목록"],
  "clarificationQuestion": "질문이 필요한 경우에만"
}

## 예시

입력: "이번달 안에 5키로 감량하고 싶어"
→ intent: "goal"
→ extractedInfo: { title: "5kg 감량", targetDate: "${context.endOfMonth}", category: "운동", priority: "high" }
→ missingInfo: []

입력: "내일 3시에 팀 미팅"
→ intent: "event"
→ extractedInfo: { title: "팀 미팅", datetime: "내일T15:00:00", category: "업무" }
→ missingInfo: []

입력: "운동하고 싶어"
→ intent: "clarification"
→ clarificationQuestion: "어떤 운동을 하고 싶으신가요? 목표가 있으신가요?"

입력: "오늘 일정 알려줘"
→ intent: "briefing"

반드시 JSON만 출력하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
