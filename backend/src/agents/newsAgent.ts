/**
 * News Briefing Agent
 *
 * 뉴스 브리핑 기능을 담당하는 에이전트입니다.
 * - 어젯밤/오늘 새벽 뉴스 정리
 * - 주제별 뉴스 검색
 * - 카테고리별 뉴스 조회
 * - 뉴스 브리핑 생성
 */

import OpenAI from 'openai';
import { NewsMCP, getNewsMCP, NewsArticle, NewsBriefing } from '../mcp/news.js';
import { AgentResponse } from '../types/index.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

interface NewsAgentContext {
  userId: string;
  today: string;
}

interface NewsRequest {
  type: 'overnight' | 'today' | 'category' | 'search' | 'general';
  category?: 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
  query?: string;
  originalMessage: string;
}

/**
 * 뉴스 관련 의도 분석
 */
async function analyzeNewsIntent(message: string): Promise<NewsRequest> {
  const systemPrompt = `사용자의 뉴스 관련 요청을 분석합니다.

## 요청 유형
- "overnight": 어젯밤, 새벽, 밤 사이 뉴스 요청
- "today": 오늘 뉴스, 최신 뉴스, 헤드라인 요청
- "category": 특정 카테고리 뉴스 (경제, 스포츠, 기술, 연예 등)
- "search": 특정 키워드/주제 뉴스 검색
- "general": 일반적인 뉴스 브리핑 요청

## 카테고리 매핑
- 경제, 비즈니스, 주식, 금융 → "business"
- 연예, 가십, 셀럽, 드라마 → "entertainment"
- 일반, 종합, 사회 → "general"
- 건강, 의료, 헬스케어 → "health"
- 과학, 우주, 연구 → "science"
- 스포츠, 축구, 야구, 농구 → "sports"
- 기술, IT, AI, 테크 → "technology"

## 응답 형식 (JSON)
{
  "type": "overnight|today|category|search|general",
  "category": "business|entertainment|general|health|science|sports|technology" (선택),
  "query": "검색 키워드" (선택)
}

예시:
- "어젯밤 무슨 일 있었어?" → {"type": "overnight"}
- "오늘 뉴스 알려줘" → {"type": "today"}
- "경제 뉴스 보여줘" → {"type": "category", "category": "business"}
- "AI 관련 뉴스" → {"type": "search", "query": "AI"}
- "뉴스 브리핑해줘" → {"type": "general"}

JSON만 출력하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content || '{}';

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
      type: parsed.type || 'general',
      category: parsed.category,
      query: parsed.query,
      originalMessage: message
    };
  } catch (error) {
    console.error('[NewsAgent] Intent analysis error:', error);
    return {
      type: 'general',
      originalMessage: message
    };
  }
}

/**
 * 뉴스 브리핑 생성 (AI 요약)
 */
async function generateNewsSummary(
  articles: NewsArticle[],
  context: { type: string; query?: string }
): Promise<string> {
  if (articles.length === 0) {
    return '현재 관련 뉴스가 없습니다.';
  }

  const newsData = articles.slice(0, 5).map((a, i) =>
    `${i + 1}. [${a.source.name}] ${a.title}\n   ${a.description || ''}`
  ).join('\n\n');

  const systemPrompt = `당신은 뉴스 브리핑을 작성하는 전문 앵커입니다.

## 역할
주어진 뉴스 기사들을 바탕으로 간결하고 이해하기 쉬운 브리핑을 작성합니다.

## 작성 규칙
1. 한국어로 작성
2. 친근하면서도 전문적인 톤
3. 핵심 내용 위주로 요약
4. 각 뉴스의 핵심을 1-2문장으로 정리
5. 마지막에 간단한 코멘트 추가

## 형식
먼저 인사와 함께 오늘/어젯밤 뉴스 소개
→ 주요 뉴스 3-5개 요약
→ 마무리 인사

절대 마크다운 헤더(#)나 과도한 이모지 사용 금지.
자연스러운 문장으로 작성하세요.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `다음 뉴스들을 브리핑해주세요 (${context.type} 뉴스${context.query ? `, 키워드: ${context.query}` : ''}):\n\n${newsData}` }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    return response.choices[0]?.message?.content || '뉴스 요약을 생성할 수 없습니다.';
  } catch (error) {
    console.error('[NewsAgent] Summary generation error:', error);
    // 폴백: 간단한 요약
    return `주요 뉴스 ${articles.length}건을 확인했습니다.\n\n` +
      articles.slice(0, 3).map((a, i) => `**${i + 1}. ${a.title}**\n${a.description || ''}`).join('\n\n');
  }
}

/**
 * 뉴스 요청 처리 메인 함수
 */
export async function processNews(
  routerResult: any,
  context: NewsAgentContext
): Promise<AgentResponse> {
  const newsMCP = getNewsMCP();
  const originalMessage = routerResult.originalMessage || routerResult.extractedInfo?.originalMessage || '';

  // 뉴스 의도 분석
  const newsRequest = await analyzeNewsIntent(originalMessage);
  console.log('[NewsAgent] News request:', newsRequest);

  let articles: NewsArticle[] = [];
  let briefingType = '';

  try {
    switch (newsRequest.type) {
      case 'overnight':
        // 어젯밤 뉴스
        const overnightBriefing = await newsMCP.getOvernightBriefing();
        articles = overnightBriefing.topStories;
        briefingType = '어젯밤부터 오늘 아침까지';
        break;

      case 'today':
        // 오늘 뉴스
        const todayBriefing = await newsMCP.getTodayBriefing();
        articles = todayBriefing.topStories;
        briefingType = '오늘';
        break;

      case 'category':
        // 카테고리별 뉴스
        articles = await newsMCP.getTopHeadlines({
          category: newsRequest.category,
          pageSize: 10
        });
        briefingType = getCategoryKoreanName(newsRequest.category || 'general');
        break;

      case 'search':
        // 키워드 검색
        articles = await newsMCP.searchNews({
          query: newsRequest.query,
          pageSize: 10,
          sortBy: 'publishedAt'
        });
        briefingType = `"${newsRequest.query}" 관련`;
        break;

      default:
        // 일반 브리핑
        const generalBriefing = await newsMCP.getTodayBriefing();
        articles = generalBriefing.topStories;
        briefingType = '최신';
    }

    if (articles.length === 0) {
      return {
        message: `${briefingType} 뉴스를 찾지 못했어요. 다른 주제나 카테고리를 시도해볼까요?`,
        needs_user_input: true,
        suggestions: ['오늘 뉴스', '경제 뉴스', '스포츠 뉴스', '기술 뉴스']
      };
    }

    // AI 요약 생성
    const summary = await generateNewsSummary(articles, {
      type: briefingType,
      query: newsRequest.query
    });

    // 뉴스 카드용 데이터 (최대 9개)
    const newsCards = articles.slice(0, 9).map(article => ({
      id: article.id,
      title: article.title,
      description: article.description,
      source: article.source.name,
      author: article.author,
      url: article.url,
      imageUrl: article.imageUrl,
      publishedAt: article.publishedAt,
      category: article.category
    }));

    return {
      message: summary,
      mcp_data: {
        news: newsCards
      },
      suggestions: getSuggestedCategories(newsRequest.category)
    };

  } catch (error) {
    console.error('[NewsAgent] Process error:', error);
    return {
      message: '뉴스를 가져오는 중 문제가 발생했어요. 잠시 후 다시 시도해주세요.',
      needs_user_input: true
    };
  }
}

/**
 * 카테고리 한글 이름
 */
function getCategoryKoreanName(category: string): string {
  const names: Record<string, string> = {
    'general': '종합',
    'business': '경제',
    'technology': '기술/IT',
    'science': '과학',
    'health': '건강',
    'sports': '스포츠',
    'entertainment': '연예'
  };
  return names[category] || category;
}

/**
 * 추천 카테고리 (현재 카테고리 제외)
 */
function getSuggestedCategories(currentCategory?: string): string[] {
  const all = ['경제 뉴스', '기술 뉴스', '스포츠 뉴스', '연예 뉴스', '과학 뉴스'];
  const categoryMap: Record<string, string> = {
    'business': '경제 뉴스',
    'technology': '기술 뉴스',
    'sports': '스포츠 뉴스',
    'entertainment': '연예 뉴스',
    'science': '과학 뉴스'
  };

  const current = currentCategory ? categoryMap[currentCategory] : null;
  return all.filter(c => c !== current).slice(0, 3);
}

/**
 * 뉴스 관련 요청인지 확인
 */
export function isNewsRelated(message: string): boolean {
  const newsKeywords = [
    '뉴스', '소식', '헤드라인', '브리핑',
    '어젯밤', '밤 사이', '새벽', '오늘 뭔 일',
    '무슨 일', '어떤 일', '일어났', '있었어',
    '경제', '스포츠', '연예', '기술', '과학', 'IT',
    '최신', '속보', '기사'
  ];

  const lowerMessage = message.toLowerCase();
  return newsKeywords.some(keyword => lowerMessage.includes(keyword));
}

export default { processNews, isNewsRelated };
