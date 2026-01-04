/**
 * News MCP Client
 *
 * NewsAPI를 통해 뉴스 관련 기능을 수행합니다.
 * - 최신 헤드라인 조회
 * - 키워드/주제별 뉴스 검색
 * - 카테고리별 뉴스 (비즈니스, 기술, 스포츠 등)
 * - 뉴스 브리핑 생성
 */

import axios from 'axios';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  author?: string;
  source: {
    id: string | null;
    name: string;
  };
  url: string;
  imageUrl?: string;
  publishedAt: string;
  category?: string;
}

export interface NewsBriefing {
  date: string;
  period: 'morning' | 'evening' | 'overnight' | 'custom';
  summary: string;
  topStories: NewsArticle[];
  categoryBreakdown?: {
    category: string;
    articles: NewsArticle[];
  }[];
  totalArticles: number;
}

export interface NewsSearchOptions {
  query?: string;
  category?: 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
  country?: string;
  language?: string;
  from?: string;  // ISO date
  to?: string;    // ISO date
  sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
  pageSize?: number;
}

// NewsAPI 응답 타입
interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: Array<{
    source: { id: string | null; name: string };
    author: string | null;
    title: string;
    description: string | null;
    url: string;
    urlToImage: string | null;
    publishedAt: string;
    content: string | null;
  }>;
  code?: string;
  message?: string;
}

export class NewsMCP {
  private apiKey: string;
  private baseUrl = 'https://newsapi.org/v2';
  private defaultCountry = 'kr';
  private defaultLanguage = 'ko';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.NEWSAPI_KEY || '';

    if (!this.apiKey) {
      console.warn('[NewsMCP] API key not set. News features will return mock data.');
    }
  }

  /**
   * 최신 헤드라인 조회
   */
  async getTopHeadlines(options: {
    category?: NewsSearchOptions['category'];
    country?: string;
    pageSize?: number;
  } = {}): Promise<NewsArticle[]> {
    try {
      if (!this.apiKey) {
        return this.getMockHeadlines(options.category);
      }

      const params: any = {
        apiKey: this.apiKey,
        country: options.country || this.defaultCountry,
        pageSize: options.pageSize || 10
      };

      if (options.category) {
        params.category = options.category;
      }

      const response = await axios.get<NewsAPIResponse>(`${this.baseUrl}/top-headlines`, { params });

      if (response.data.status !== 'ok') {
        console.error('[NewsMCP] API error:', response.data.message);
        return this.getMockHeadlines(options.category);
      }

      return response.data.articles.map(this.mapToNewsArticle);
    } catch (error) {
      console.error('[NewsMCP] getTopHeadlines error:', error);
      return this.getMockHeadlines(options.category);
    }
  }

  /**
   * 키워드로 뉴스 검색
   */
  async searchNews(options: NewsSearchOptions): Promise<NewsArticle[]> {
    try {
      if (!this.apiKey) {
        return this.getMockSearchResults(options.query);
      }

      const params: any = {
        apiKey: this.apiKey,
        q: options.query,
        language: options.language || this.defaultLanguage,
        sortBy: options.sortBy || 'publishedAt',
        pageSize: options.pageSize || 10
      };

      if (options.from) params.from = options.from;
      if (options.to) params.to = options.to;

      const response = await axios.get<NewsAPIResponse>(`${this.baseUrl}/everything`, { params });

      if (response.data.status !== 'ok') {
        console.error('[NewsMCP] API error:', response.data.message);
        return this.getMockSearchResults(options.query);
      }

      return response.data.articles.map(this.mapToNewsArticle);
    } catch (error) {
      console.error('[NewsMCP] searchNews error:', error);
      return this.getMockSearchResults(options.query);
    }
  }

  /**
   * 어젯밤/오늘 새벽 뉴스 브리핑 생성
   */
  async getOvernightBriefing(): Promise<NewsBriefing> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(22, 0, 0, 0);  // 어제 오후 10시부터

    const thisAM = new Date(now);
    thisAM.setHours(8, 0, 0, 0);  // 오늘 오전 8시까지

    return this.generateBriefing({
      from: yesterday.toISOString(),
      to: thisAM.toISOString(),
      period: 'overnight'
    });
  }

  /**
   * 오늘의 뉴스 브리핑
   */
  async getTodayBriefing(): Promise<NewsBriefing> {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    return this.generateBriefing({
      from: todayStart.toISOString(),
      to: now.toISOString(),
      period: now.getHours() < 12 ? 'morning' : 'evening'
    });
  }

  /**
   * 특정 기간 뉴스 브리핑
   */
  async generateBriefing(options: {
    from: string;
    to: string;
    period: NewsBriefing['period'];
    categories?: NewsSearchOptions['category'][];
  }): Promise<NewsBriefing> {
    const categories: NewsSearchOptions['category'][] = options.categories ||
      ['general', 'business', 'technology', 'sports', 'entertainment'];

    const allArticles: NewsArticle[] = [];
    const categoryBreakdown: NewsBriefing['categoryBreakdown'] = [];

    // 각 카테고리별로 뉴스 조회
    for (const category of categories) {
      const articles = await this.getTopHeadlines({
        category,
        pageSize: 5
      });

      if (articles.length > 0) {
        const articlesWithCategory = articles.map(a => ({ ...a, category: category || 'general' }));
        allArticles.push(...articlesWithCategory);
        categoryBreakdown.push({
          category: this.getCategoryKoreanName(category || 'general'),
          articles: articlesWithCategory
        });
      }
    }

    // 시간순 정렬
    allArticles.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // 주요 뉴스 선정 (상위 5개)
    const topStories = allArticles.slice(0, 5);

    // 브리핑 요약 생성
    const summary = this.generateSummaryText(topStories, options.period);

    return {
      date: new Date().toISOString().split('T')[0],
      period: options.period,
      summary,
      topStories,
      categoryBreakdown,
      totalArticles: allArticles.length
    };
  }

  /**
   * 카테고리 한글 이름
   */
  private getCategoryKoreanName(category: string): string {
    const names: Record<string, string> = {
      'general': '종합',
      'business': '경제',
      'technology': '기술',
      'science': '과학',
      'health': '건강',
      'sports': '스포츠',
      'entertainment': '연예'
    };
    return names[category] || category;
  }

  /**
   * 브리핑 요약 텍스트 생성
   */
  private generateSummaryText(topStories: NewsArticle[], period: string): string {
    if (topStories.length === 0) {
      return '특별한 뉴스가 없습니다.';
    }

    const periodText = period === 'overnight' ? '어젯밤부터 오늘 아침까지' :
                       period === 'morning' ? '오늘 오전' :
                       period === 'evening' ? '오늘' : '해당 기간';

    const headlines = topStories.slice(0, 3).map(a => `"${a.title}"`).join(', ');

    return `${periodText} 주요 뉴스입니다. ${headlines} 등의 소식이 있었습니다.`;
  }

  /**
   * API 응답을 NewsArticle로 변환
   */
  private mapToNewsArticle = (article: NewsAPIResponse['articles'][0]): NewsArticle => {
    return {
      id: this.generateArticleId(article),
      title: article.title || '제목 없음',
      description: article.description || '',
      content: article.content || undefined,
      author: article.author || undefined,
      source: article.source,
      url: article.url,
      imageUrl: article.urlToImage || undefined,
      publishedAt: article.publishedAt
    };
  };

  /**
   * 기사 ID 생성
   */
  private generateArticleId(article: any): string {
    const str = (article.url || '') + (article.publishedAt || '');
    const hash = str.split('')
      .reduce((acc: number, char: string) => ((acc << 5) - acc) + char.charCodeAt(0), 0);
    return `news_${Math.abs(hash).toString(36)}`;
  }

  // ====================================================
  // Mock 데이터 (API 키가 없을 때)
  // ====================================================

  private getMockHeadlines(category?: string): NewsArticle[] {
    const now = new Date();
    const baseNews: NewsArticle[] = [
      {
        id: 'mock_1',
        title: '글로벌 AI 기업들, 새로운 언어 모델 경쟁 가속화',
        description: '주요 기술 기업들이 차세대 AI 모델 개발에 박차를 가하고 있습니다.',
        source: { id: null, name: '테크뉴스' },
        url: 'https://example.com/news/1',
        imageUrl: 'https://picsum.photos/seed/news1/400/200',
        publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(),
        category: 'technology'
      },
      {
        id: 'mock_2',
        title: '원/달러 환율, 1,300원대 안착...시장 안정 기대',
        description: '외환시장에서 원화 가치가 안정세를 보이고 있습니다.',
        source: { id: null, name: '경제일보' },
        url: 'https://example.com/news/2',
        imageUrl: 'https://picsum.photos/seed/news2/400/200',
        publishedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(),
        category: 'business'
      },
      {
        id: 'mock_3',
        title: '프로야구 개막전, 역대 최다 관중 기록 경신',
        description: '2024 KBO 리그가 뜨거운 열기 속에 개막했습니다.',
        source: { id: null, name: '스포츠투데이' },
        url: 'https://example.com/news/3',
        imageUrl: 'https://picsum.photos/seed/news3/400/200',
        publishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString(),
        category: 'sports'
      },
      {
        id: 'mock_4',
        title: '서울시, 대중교통 요금 인상 검토 중',
        description: '물가 상승에 따른 대중교통 요금 조정이 논의되고 있습니다.',
        source: { id: null, name: '한국뉴스' },
        url: 'https://example.com/news/4',
        imageUrl: 'https://picsum.photos/seed/news4/400/200',
        publishedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString(),
        category: 'general'
      },
      {
        id: 'mock_5',
        title: '신작 드라마 화제, 첫 방송 시청률 15% 돌파',
        description: '기대작 드라마가 첫 방송부터 높은 시청률을 기록했습니다.',
        source: { id: null, name: '엔터뉴스' },
        url: 'https://example.com/news/5',
        imageUrl: 'https://picsum.photos/seed/news5/400/200',
        publishedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString(),
        category: 'entertainment'
      }
    ];

    if (category) {
      return baseNews.filter(n => n.category === category);
    }
    return baseNews;
  }

  private getMockSearchResults(query?: string): NewsArticle[] {
    const headlines = this.getMockHeadlines();
    if (!query) return headlines;

    // 간단한 검색 시뮬레이션
    return headlines.filter(n =>
      n.title.toLowerCase().includes(query.toLowerCase()) ||
      n.description.toLowerCase().includes(query.toLowerCase())
    );
  }
}

// 싱글톤 인스턴스
let instance: NewsMCP | null = null;

export function getNewsMCP(): NewsMCP {
  if (!instance) {
    instance = new NewsMCP();
  }
  return instance;
}
