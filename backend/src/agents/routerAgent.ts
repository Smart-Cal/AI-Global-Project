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
  const systemPrompt = `당신은 사용자 의도를 파악하고 정보를 추출하는 전문 분석가입니다.

## 역할
1. 사용자 발화에서 의도(intent) 파악
2. 발화에서 모든 정보 추출 (명시적 + 암시적)
3. 정말 없는 정보만 식별

## 의도 분류 (중요! 정확히 분류하세요)
- "event": 일정/약속/미팅/회의 등 시간이 정해진 활동 추가
- "todo": 해야 할 일, 작업, 태스크 추가
- "goal": 목표 설정. 키워드: ~하고 싶어, ~할래, ~할 거야, 목표, 달성, 감량, 성공
- "briefing": 오늘 일정 확인, 뭐 있어, 알려줘
- "shopping": 상품 검색, 쇼핑 추천, 물건 찾기, 구매 관련
- "places": 장소 검색, 맛집 추천, 근처 ~, 어디 가면 좋을까
- "news": 뉴스 요약, 지난 밤 뉴스, 최신 소식, 오늘의 뉴스
- "general": 일반 대화, 질문 (위에 해당하지 않을 때만!)
- "clarification": 정보가 너무 부족해서 질문 필요

## shopping으로 분류해야 하는 경우
- "~상품 추천해줘" → shopping
- "~살까?" → shopping
- "~가격 비교" → shopping
- "~추천해줘" + 제품명 → shopping
- 예: "러닝화 추천해줘", "10만원대 운동화", "노트북 가격 비교"

## places로 분류해야 하는 경우
- "근처 맛집" → places
- "~어디가 좋아?" → places
- "~추천해줘" + 장소/레스토랑 → places
- 예: "강남역 근처 맛집", "조용한 카페 추천", "데이트 장소"

## news로 분류해야 하는 경우
- "지난 밤 뉴스" → news
- "오늘 뉴스" → news
- "최신 소식" → news
- "뉴스 정리해줘" → news
- 예: "어제 무슨 일 있었어?", "뉴스 브리핑", "테크 뉴스 알려줘"

## goal로 분류해야 하는 경우 (매우 중요!)
- "~하고 싶어" → goal (예: "5키로 감량하고 싶어")
- "~할래" → goal (예: "토익 900점 받을래")
- "~해야지" → goal (예: "살 빼야지")
- "~달성" → goal
- 숫자 + 기간 + 목표성 표현 → goal

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
  "intent": "event" | "todo" | "goal" | "briefing" | "shopping" | "places" | "news" | "general" | "clarification",
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
    "description": "설명",
    "productQuery": "상품 검색어 (쇼핑용)",
    "minPrice": 0,
    "maxPrice": 100000,
    "placeQuery": "장소 검색어 (장소용)",
    "placeType": "restaurant | cafe | etc",
    "nearLocation": "근처 위치",
    "newsQuery": "뉴스 검색어 (뉴스용)",
    "newsCategory": "business | technology | sports | etc",
    "timeRange": "overnight | today | week"
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

입력: "러닝화 추천해줘"
→ intent: "shopping"
→ extractedInfo: { productQuery: "러닝화", category: "스포츠" }

입력: "강남역 근처 맛집 추천해줘"
→ intent: "places"
→ extractedInfo: { placeQuery: "맛집", placeType: "restaurant", nearLocation: "강남역" }

입력: "지난 밤에 있었던 뉴스들을 정리해줘"
→ intent: "news"
→ extractedInfo: { timeRange: "overnight" }

입력: "테크 뉴스 알려줘"
→ intent: "news"
→ extractedInfo: { newsCategory: "technology" }

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
