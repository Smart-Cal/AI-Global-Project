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
  const systemPrompt = `당신은 자연어를 구조화된 일정/할일 데이터로 변환하는 Parser Agent입니다.

현재 시간: ${currentDate}

사용자의 메시지를 분석하여 다음 JSON 형식으로 변환하세요:

{
  "type": "fixed" | "personal" | "goal" | "todo" | "unknown",
  "events": [
    {
      "title": "일정 제목",
      "datetime": "YYYY-MM-DDTHH:mm:ss 형식 (ISO)",
      "duration": 60 (분 단위, 기본값 60),
      "location": "장소 (있는 경우)",
      "type": "fixed" | "personal" | "goal",
      "description": "설명 (있는 경우)"
    }
  ],
  "todos": [
    {
      "title": "할 일 제목",
      "related_event_title": "연결된 이벤트 제목 (있는 경우)",
      "timing": "before" | "during" | "after" (이벤트와의 관계),
      "deadline": "YYYY-MM-DDTHH:mm:ss 형식",
      "duration": 30 (예상 소요 시간, 분 단위),
      "priority": "high" | "medium" | "low"
    }
  ],
  "intent": "사용자 의도 요약",
  "needs_clarification": false,
  "clarification_question": null
}

일정 유형 분류:
- fixed: 고정 일정 (회의, 약속, 병원 등 시간이 정해진 것)
- personal: 개인 일정 (운동, 취미 등)
- goal: 목표 관련 일정 (공부, 프로젝트 등)
- todo: 할 일만 있는 경우
- unknown: 분류 불가

시간 표현 변환 규칙:
- "내일" = 현재 날짜 + 1일
- "다음주" = 현재 날짜 + 7일
- "오후 3시" = 15:00
- "저녁" = 18:00~19:00
- "아침" = 08:00~09:00

관련 Todo 추출:
- "발표자료 준비해야 해" → 발표자료 준비 Todo
- "미팅 전에 자료 검토" → timing: "before"

정보가 부족하면 needs_clarification을 true로 설정하고 clarification_question에 질문을 작성하세요.

반드시 유효한 JSON만 출력하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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
      clarification_question: '죄송합니다. 다시 한번 말씀해 주시겠어요?'
    };
  }
}

/**
 * 이벤트 타입 분류
 */
export function classifyEventType(text: string): 'fixed' | 'personal' | 'goal' {
  const fixedKeywords = ['회의', '미팅', '약속', '병원', '진료', '면접', '발표'];
  const goalKeywords = ['공부', '시험', '자격증', '프로젝트', '학습', '준비'];

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

  // 날짜 파싱
  if (expression.includes('내일')) {
    result.setDate(result.getDate() + 1);
  } else if (expression.includes('모레')) {
    result.setDate(result.getDate() + 2);
  } else if (expression.includes('다음주')) {
    result.setDate(result.getDate() + 7);
  }

  // 시간 파싱
  const timeMatch = expression.match(/(\d{1,2})\s*시/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    if (expression.includes('오후') && hour < 12) {
      hour += 12;
    }
    result.setHours(hour, 0, 0, 0);
  } else if (expression.includes('아침')) {
    result.setHours(9, 0, 0, 0);
  } else if (expression.includes('점심')) {
    result.setHours(12, 0, 0, 0);
  } else if (expression.includes('저녁')) {
    result.setHours(18, 0, 0, 0);
  }

  return result.toISOString();
}
