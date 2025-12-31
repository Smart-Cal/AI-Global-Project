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

  const systemPrompt = `당신은 사용자의 일정을 적극적으로 계획하고 추천해주는 AI 비서입니다.

현재 시간: ${currentDate}
오늘 날짜: ${now.toISOString().split('T')[0]}
이번 주 날짜들: ${weekDates.join(', ')}

## 핵심 원칙
1. 사용자가 "추천해줘", "계획 세워줘", "어떻게 할까?" 같이 요청하면 **직접 일정을 생성**해야 합니다.
2. 구체적인 시간이 없어도 합리적인 시간을 **자동으로 배정**하세요.
3. 절대 반복적으로 질문하지 마세요. 적극적으로 일정을 만들어주세요.
4. needs_clarification은 정말 필수 정보(예: 어떤 종류의 활동인지조차 모를 때)만 true로 설정하세요.

## 자동 시간 배정 규칙
- 운동: 오전 7시 또는 저녁 7시 (각 1시간)
- 공부/작업: 오전 10시 또는 오후 2시 (각 2시간)
- 미팅/약속: 오후 3시 (각 1시간)
- 특정 요일 제외 요청 시 해당 요일 건너뛰기

## 카테고리 분류 규칙 (category 필드)
각 일정에 가장 적합한 카테고리를 지정하세요:
- "운동/건강": 운동, 헬스, 조깅, 요가, 병원, 건강검진 등
- "업무": 회의, 미팅, 출근, 업무, 프로젝트, 발표 등
- "공부": 공부, 학습, 수업, 강의, 시험, 자격증 등
- "약속": 친구 만남, 데이트, 모임, 파티 등
- "개인": 취미, 휴식, 독서, 영화, 쇼핑 등
- "기본": 분류가 어려운 경우

## 응답 JSON 형식
{
  "type": "fixed" | "personal" | "goal" | "todo" | "unknown",
  "events": [
    {
      "title": "일정 제목",
      "datetime": "YYYY-MM-DDTHH:mm:ss",
      "duration": 60,
      "location": "장소 (선택)",
      "type": "fixed" | "personal" | "goal",
      "description": "설명 (선택)",
      "category": "카테고리 이름"
    }
  ],
  "todos": [],
  "intent": "사용자 의도 요약",
  "needs_clarification": false,
  "clarification_question": null
}

## 예시

입력: "이번 주 운동 계획 세워줘, 금요일은 빼고"
출력:
{
  "type": "personal",
  "events": [
    {"title": "운동", "datetime": "${weekDates[0]}T19:00:00", "duration": 60, "type": "personal", "category": "운동/건강"},
    {"title": "운동", "datetime": "${weekDates[1]}T19:00:00", "duration": 60, "type": "personal", "category": "운동/건강"},
    {"title": "운동", "datetime": "${weekDates[2]}T19:00:00", "duration": 60, "type": "personal", "category": "운동/건강"},
    {"title": "운동", "datetime": "${weekDates[3]}T19:00:00", "duration": 60, "type": "personal", "category": "운동/건강"},
    {"title": "운동", "datetime": "${weekDates[5]}T19:00:00", "duration": 60, "type": "personal", "category": "운동/건강"}
  ],
  "todos": [],
  "intent": "이번 주 운동 계획 (금요일 제외)",
  "needs_clarification": false
}

입력: "내일 팀 미팅"
출력:
{
  "type": "fixed",
  "events": [
    {"title": "팀 미팅", "datetime": "${weekDates[1]}T15:00:00", "duration": 60, "type": "fixed", "category": "업무"}
  ],
  "todos": [],
  "intent": "팀 미팅 일정",
  "needs_clarification": false
}

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
