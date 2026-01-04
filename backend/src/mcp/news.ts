/**
 * News MCP Client
 *
 * 뉴스 관련 기능을 제공합니다.
 * - 최신 뉴스 검색
 * - 카테고리별 뉴스
 * - 뉴스 요약/브리핑
 *
 * 지원 API:
 * 1. NewsAPI (newsapi.org)
 * 2. SerpAPI News (대체)
 */

import axios from 'axios';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  content?: string;
  url: string;
  imageUrl?: string;
  source: string;
  author?: string;
  publishedAt: string;
  category?: string;
}

export interface NewsBriefing {
  summary: string;
  topStories: NewsArticle[];
  categories: {
    [key: string]: NewsArticle[];
  };
  generatedAt: string;
}

export class NewsMCP {
  private newsApiKey: string;
  private serpApiKey: string;

  constructor(config?: {
    newsApiKey?: string;
    serpApiKey?: string;
  }) {
    this.newsApiKey = config?.newsApiKey || process.env.NEWS_API_KEY || '';
    this.serpApiKey = config?.serpApiKey || process.env.SERPAPI_API_KEY || '';

    if (!this.newsApiKey && !this.serpApiKey) {
      console.warn('[NewsMCP] No news API credentials set. News features will use mock data.');
    } else {
      if (this.newsApiKey) {
        console.log('[NewsMCP] NewsAPI enabled');
      }
      if (this.serpApiKey) {
        console.log('[NewsMCP] SerpAPI News enabled');
      }
    }
  }

  // ====================================================
  // 뉴스 검색
  // ====================================================

  /**
   * 최신 헤드라인 뉴스 가져오기
   */
  async getTopHeadlines(options?: {
    country?: string;
    category?: 'business' | 'entertainment' | 'general' | 'health' | 'science' | 'sports' | 'technology';
    query?: string;
    pageSize?: number;
  }): Promise<NewsArticle[]> {
    if (this.newsApiKey) {
      try {
        return await this.getNewsFromNewsAPI(options);
      } catch (error) {
        console.error('[NewsMCP] NewsAPI error, trying SerpAPI:', error);
      }
    }

    if (this.serpApiKey) {
      try {
        return await this.getNewsFromSerpAPI(options?.query || '한국 뉴스');
      } catch (error) {
        console.error('[NewsMCP] SerpAPI error:', error);
      }
    }

    return this.getMockNews();
  }

  /**
   * NewsAPI로 뉴스 검색
   */
  private async getNewsFromNewsAPI(options?: {
    country?: string;
    category?: string;
    query?: string;
    pageSize?: number;
  }): Promise<NewsArticle[]> {
    const params: Record<string, string | number> = {
      apiKey: this.newsApiKey,
      country: options?.country || 'kr',
      pageSize: options?.pageSize || 10,
    };

    if (options?.category) {
      params.category = options.category;
    }
    if (options?.query) {
      params.q = options.query;
    }

    const response = await axios.get('https://newsapi.org/v2/top-headlines', { params });

    if (!response.data.articles) {
      return [];
    }

    return response.data.articles.map((article: any, index: number) => ({
      id: `news-${index}-${Date.now()}`,
      title: article.title || 'Untitled',
      description: article.description || '',
      content: article.content,
      url: article.url,
      imageUrl: article.urlToImage,
      source: article.source?.name || 'Unknown',
      author: article.author,
      publishedAt: article.publishedAt,
      category: options?.category
    }));
  }

  /**
   * SerpAPI로 뉴스 검색 (대체)
   */
  private async getNewsFromSerpAPI(query: string): Promise<NewsArticle[]> {
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        api_key: this.serpApiKey,
        engine: 'google_news',
        q: query,
        hl: 'ko',
        gl: 'kr',
      }
    });

    if (!response.data.news_results) {
      return [];
    }

    return response.data.news_results.map((article: any, index: number) => ({
      id: `serp-news-${index}-${Date.now()}`,
      title: article.title || 'Untitled',
      description: article.snippet || '',
      url: article.link,
      imageUrl: article.thumbnail,
      source: article.source?.name || article.source || 'Unknown',
      publishedAt: article.date || new Date().toISOString(),
    }));
  }

  /**
   * 키워드로 뉴스 검색
   */
  async searchNews(options: {
    query: string;
    from?: string;  // YYYY-MM-DD
    to?: string;
    sortBy?: 'relevancy' | 'popularity' | 'publishedAt';
    pageSize?: number;
  }): Promise<NewsArticle[]> {
    if (this.newsApiKey) {
      try {
        const params: Record<string, string | number> = {
          apiKey: this.newsApiKey,
          q: options.query,
          language: 'ko',
          pageSize: options.pageSize || 10,
          sortBy: options.sortBy || 'publishedAt',
        };

        if (options.from) params.from = options.from;
        if (options.to) params.to = options.to;

        const response = await axios.get('https://newsapi.org/v2/everything', { params });

        if (!response.data.articles) {
          return [];
        }

        return response.data.articles.map((article: any, index: number) => ({
          id: `search-${index}-${Date.now()}`,
          title: article.title || 'Untitled',
          description: article.description || '',
          content: article.content,
          url: article.url,
          imageUrl: article.urlToImage,
          source: article.source?.name || 'Unknown',
          author: article.author,
          publishedAt: article.publishedAt,
        }));
      } catch (error) {
        console.error('[NewsMCP] Search error:', error);
      }
    }

    // Fallback to SerpAPI
    if (this.serpApiKey) {
      return this.getNewsFromSerpAPI(options.query);
    }

    return this.getMockNews();
  }

  /**
   * 뉴스 브리핑 생성
   */
  async generateBriefing(options?: {
    categories?: string[];
    maxArticles?: number;
  }): Promise<NewsBriefing> {
    const categories = options?.categories || ['general', 'business', 'technology', 'sports'];
    const maxPerCategory = Math.floor((options?.maxArticles || 10) / categories.length);

    const categoryNews: { [key: string]: NewsArticle[] } = {};
    const allNews: NewsArticle[] = [];

    for (const category of categories) {
      const news = await this.getTopHeadlines({
        category: category as any,
        pageSize: maxPerCategory
      });
      categoryNews[category] = news;
      allNews.push(...news);
    }

    // 상위 뉴스 선택 (각 카테고리에서 1개씩)
    const topStories = categories
      .map(cat => categoryNews[cat]?.[0])
      .filter((article): article is NewsArticle => !!article);

    // 간단한 요약 생성
    const summaryParts = topStories.slice(0, 3).map(article => `• ${article.title}`);
    const summary = `오늘의 주요 뉴스:\n${summaryParts.join('\n')}`;

    return {
      summary,
      topStories,
      categories: categoryNews,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * 지난 밤/어제 뉴스 요약
   */
  async getOvernightNews(): Promise<NewsArticle[]> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(21, 0, 0, 0); // 어제 오후 9시부터

    const from = yesterday.toISOString().split('T')[0];
    const to = now.toISOString().split('T')[0];

    return this.searchNews({
      query: '뉴스 속보 OR 주요',
      from,
      to,
      sortBy: 'publishedAt',
      pageSize: 10
    });
  }

  // ====================================================
  // Mock 데이터
  // ====================================================

  private getMockNews(): NewsArticle[] {
    const now = new Date();
    return [
      {
        id: 'mock-1',
        title: '오늘의 주요 뉴스 헤드라인',
        description: '오늘 있었던 주요 사건들을 정리했습니다.',
        url: 'https://example.com/news/1',
        imageUrl: 'https://via.placeholder.com/400x200',
        source: '예시뉴스',
        publishedAt: now.toISOString(),
        category: 'general'
      },
      {
        id: 'mock-2',
        title: '테크 업계 최신 동향',
        description: 'AI와 기술 분야의 최신 소식입니다.',
        url: 'https://example.com/news/2',
        imageUrl: 'https://via.placeholder.com/400x200',
        source: '테크뉴스',
        publishedAt: now.toISOString(),
        category: 'technology'
      },
      {
        id: 'mock-3',
        title: '경제 시장 동향 분석',
        description: '오늘의 경제 시장 상황을 분석합니다.',
        url: 'https://example.com/news/3',
        imageUrl: 'https://via.placeholder.com/400x200',
        source: '경제일보',
        publishedAt: now.toISOString(),
        category: 'business'
      }
    ];
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
