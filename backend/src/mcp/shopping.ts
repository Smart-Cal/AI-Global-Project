/**
 * Shopping MCP Client
 *
 * 쇼핑 관련 기능을 제공합니다.
 * - 상품 검색 (SerpAPI Google Shopping + Naver Shopping)
 * - 가격 비교
 * - 상품 상세 정보
 * - 목표 연계 추천 (예: 운동 목표 → 운동용품)
 *
 * 지원 API:
 * 1. SerpAPI (Google Shopping) - 글로벌 상품 검색
 * 2. Naver Shopping API (한국) - 한국 상품 검색
 */

import axios from 'axios';

export interface ProductSearchResult {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;  // 할인 전 가격
  discountRate?: number;
  image: string;
  link: string;
  mall: string;           // 쇼핑몰 이름
  category: string;
  rating?: number;
  reviewCount?: number;
  isRocket?: boolean;     // 쿠팡 로켓배송 등
  isFreeShipping?: boolean;
}

export interface ProductDetails extends ProductSearchResult {
  description?: string;
  specifications?: Record<string, string>;
  reviews?: Array<{
    author: string;
    rating: number;
    content: string;
    date: string;
  }>;
  relatedProducts?: ProductSearchResult[];
}

export interface PriceComparison {
  productName: string;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  prices: Array<{
    mall: string;
    price: number;
    link: string;
    isRocket?: boolean;
    isFreeShipping?: boolean;
  }>;
}

export interface GoalBasedRecommendation {
  goalType: string;
  recommendedItems: Array<{
    category: string;
    reason: string;
    products: ProductSearchResult[];
  }>;
  totalBudget?: {
    essential: number;
    recommended: number;
    premium: number;
  };
}

export class ShoppingMCP {
  private naverClientId: string;
  private naverClientSecret: string;
  private serpApiKey: string;

  constructor(config?: {
    naverClientId?: string;
    naverClientSecret?: string;
    serpApiKey?: string;
  }) {
    this.naverClientId = config?.naverClientId || process.env.NAVER_CLIENT_ID || '';
    this.naverClientSecret = config?.naverClientSecret || process.env.NAVER_CLIENT_SECRET || '';
    this.serpApiKey = config?.serpApiKey || process.env.SERPAPI_API_KEY || '';

    if (!this.serpApiKey && !this.naverClientId) {
      console.warn('[ShoppingMCP] No shopping API credentials set. Shopping features will use mock data.');
    } else {
      if (this.serpApiKey) {
        console.log('[ShoppingMCP] SerpAPI (Google Shopping) enabled');
      }
      if (this.naverClientId) {
        console.log('[ShoppingMCP] Naver Shopping API enabled');
      }
    }
  }

  // ====================================================
  // 상품 검색
  // ====================================================

  /**
   * 상품 검색 (SerpAPI Google Shopping 우선, 실패 시 Naver)
   */
  async searchProducts(options: {
    query: string;
    display?: number;       // 결과 수 (기본 10, 최대 100)
    sort?: 'sim' | 'date' | 'asc' | 'dsc';  // 정렬 (정확도/날짜/가격낮은순/가격높은순)
    minPrice?: number;
    maxPrice?: number;
    source?: 'serpapi' | 'naver' | 'auto';  // 검색 소스 선택
  }): Promise<ProductSearchResult[]> {
    const source = options.source || 'auto';

    console.log('[ShoppingMCP] searchProducts called:', {
      query: options.query,
      source,
      hasSerpApiKey: !!this.serpApiKey,
      serpApiKeyLength: this.serpApiKey?.length || 0
    });

    // SerpAPI 우선 시도
    if ((source === 'serpapi' || source === 'auto') && this.serpApiKey) {
      try {
        console.log('[ShoppingMCP] Attempting SerpAPI search...');
        const results = await this.searchWithSerpAPI(options);
        console.log('[ShoppingMCP] SerpAPI returned', results.length, 'results');
        if (results.length > 0) {
          return results;
        }
      } catch (error) {
        console.error('[ShoppingMCP] SerpAPI error, falling back to mock:', error);
      }
    } else {
      console.log('[ShoppingMCP] SerpAPI skipped - no API key or source mismatch');
    }

    // Naver API 시도
    if ((source === 'naver' || source === 'auto') && this.naverClientId) {
      try {
        const response = await axios.get('https://openapi.naver.com/v1/search/shop.json', {
          headers: {
            'X-Naver-Client-Id': this.naverClientId,
            'X-Naver-Client-Secret': this.naverClientSecret
          },
          params: {
            query: options.query,
            display: options.display || 10,
            sort: options.sort || 'sim',
            filter: options.minPrice || options.maxPrice
              ? `price:${options.minPrice || 0}~${options.maxPrice || 99999999}`
              : undefined
          }
        });

        return response.data.items.map(this.mapNaverProduct);
      } catch (error) {
        console.error('[ShoppingMCP] Naver API error:', error);
      }
    }

    // 모든 API 실패 시 Mock 데이터
    return this.getMockSearchResults(options.query);
  }

  /**
   * SerpAPI Google Shopping 검색
   */
  private async searchWithSerpAPI(options: {
    query: string;
    display?: number;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<ProductSearchResult[]> {
    const params: Record<string, string | number> = {
      api_key: this.serpApiKey,
      engine: 'google_shopping',
      q: options.query,
      num: options.display || 10,
      hl: 'en',  // English
      gl: 'us', // United States (international products)
    };

    if (options.minPrice) {
      params.tbs = `mr:1,price:1,ppr_min:${options.minPrice}`;
    }
    if (options.maxPrice) {
      params.tbs = params.tbs
        ? `${params.tbs},ppr_max:${options.maxPrice}`
        : `mr:1,price:1,ppr_max:${options.maxPrice}`;
    }

    console.log('[ShoppingMCP] SerpAPI request params:', { ...params, api_key: '***HIDDEN***' });

    const response = await axios.get('https://serpapi.com/search', { params });

    console.log('[ShoppingMCP] SerpAPI response status:', response.status);
    console.log('[ShoppingMCP] SerpAPI has shopping_results:', !!response.data.shopping_results);
    console.log('[ShoppingMCP] SerpAPI shopping_results count:', response.data.shopping_results?.length || 0);

    if (!response.data.shopping_results) {
      console.log('[ShoppingMCP] No shopping results from SerpAPI. Response keys:', Object.keys(response.data));
      return [];
    }

    return response.data.shopping_results.map(this.mapSerpAPIProduct);
  }

  /**
   * SerpAPI 결과 매핑
   */
  private mapSerpAPIProduct = (item: any): ProductSearchResult => {
    // 가격 파싱 (예: "₩29,900" → 29900)
    let price = 0;
    let originalPrice: number | undefined;

    if (item.price) {
      const priceStr = item.price.replace(/[^0-9]/g, '');
      price = parseInt(priceStr, 10) || 0;
    } else if (item.extracted_price) {
      price = item.extracted_price;
    }

    if (item.old_price) {
      const oldPriceStr = item.old_price.replace(/[^0-9]/g, '');
      originalPrice = parseInt(oldPriceStr, 10) || undefined;
    }

    return {
      id: item.product_id || `serp-${Math.random().toString(36).substr(2, 9)}`,
      title: item.title || 'Unknown Product',
      price: price,
      originalPrice: originalPrice,
      discountRate: originalPrice && price ? Math.round((1 - price / originalPrice) * 100) : undefined,
      image: item.thumbnail || 'https://via.placeholder.com/200',
      link: item.link || item.product_link || '#',
      mall: item.source || item.seller || 'Unknown',
      category: item.category || 'Shopping',
      rating: item.rating || undefined,
      reviewCount: item.reviews || undefined,
      isRocket: false,
      isFreeShipping: item.delivery?.toLowerCase().includes('free') || false
    };
  };

  /**
   * 조건 기반 검색 (필터링 강화)
   */
  async searchWithFilters(options: {
    query: string;
    minPrice?: number;
    maxPrice?: number;
    minRating?: number;
    freeShippingOnly?: boolean;
    limit?: number;
  }): Promise<ProductSearchResult[]> {
    const results = await this.searchProducts({
      query: options.query,
      display: 100,  // 최대로 받아서 필터링
      minPrice: options.minPrice,
      maxPrice: options.maxPrice
    });

    let filtered = results;

    if (options.minRating) {
      filtered = filtered.filter(p => (p.rating || 0) >= options.minRating!);
    }

    if (options.freeShippingOnly) {
      filtered = filtered.filter(p => p.isFreeShipping);
    }

    // 평점과 리뷰 수로 정렬
    filtered.sort((a, b) => {
      const scoreA = (a.rating || 0) * Math.log10((a.reviewCount || 1) + 1);
      const scoreB = (b.rating || 0) * Math.log10((b.reviewCount || 1) + 1);
      return scoreB - scoreA;
    });

    return filtered.slice(0, options.limit || 10);
  }

  /**
   * 가격 비교
   */
  async comparePrices(productName: string): Promise<PriceComparison | null> {
    const results = await this.searchProducts({
      query: productName,
      display: 20
    });

    if (results.length === 0) {
      return null;
    }

    const prices = results.map(p => ({
      mall: p.mall,
      price: p.price,
      link: p.link,
      isRocket: p.isRocket,
      isFreeShipping: p.isFreeShipping
    }));

    const priceValues = prices.map(p => p.price);

    return {
      productName,
      lowestPrice: Math.min(...priceValues),
      highestPrice: Math.max(...priceValues),
      averagePrice: Math.round(priceValues.reduce((a, b) => a + b, 0) / priceValues.length),
      prices: prices.sort((a, b) => a.price - b.price)
    };
  }

  // ====================================================
  // 목표 연계 추천
  // ====================================================

  /**
   * 목표 기반 상품 추천
   */
  async getGoalBasedRecommendations(options: {
    goalType: 'exercise' | 'study' | 'diet' | 'hobby' | 'travel' | 'other';
    goalDescription: string;
    budget?: number;
  }): Promise<GoalBasedRecommendation> {
    const recommendations = this.getRecommendationCategories(options.goalType, options.goalDescription);

    const recommendedItems: GoalBasedRecommendation['recommendedItems'] = [];

    for (const rec of recommendations) {
      const products = await this.searchProducts({
        query: rec.searchQuery,
        display: 5,
        sort: 'sim'
      });

      recommendedItems.push({
        category: rec.category,
        reason: rec.reason,
        products
      });
    }

    // 예산 계산
    const allProducts = recommendedItems.flatMap(item => item.products);
    const essentialProducts = allProducts.slice(0, 3);
    const recommendedProducts = allProducts.slice(0, 5);
    const premiumProducts = allProducts.slice(0, 10);

    return {
      goalType: options.goalType,
      recommendedItems,
      totalBudget: {
        essential: essentialProducts.reduce((sum, p) => sum + p.price, 0),
        recommended: recommendedProducts.reduce((sum, p) => sum + p.price, 0),
        premium: premiumProducts.reduce((sum, p) => sum + p.price, 0)
      }
    };
  }

  /**
   * 선물 추천
   */
  async recommendGifts(options: {
    recipient: 'male' | 'female' | 'child' | 'parent' | 'friend';
    occasion: 'birthday' | 'anniversary' | 'holiday' | 'graduation' | 'other';
    minPrice?: number;
    maxPrice?: number;
  }): Promise<ProductSearchResult[]> {
    const giftKeywords = this.getGiftKeywords(options.recipient, options.occasion);

    const allResults: ProductSearchResult[] = [];

    for (const keyword of giftKeywords.slice(0, 3)) {
      const results = await this.searchProducts({
        query: keyword,
        display: 5,
        minPrice: options.minPrice,
        maxPrice: options.maxPrice,
        sort: 'sim'
      });
      allResults.push(...results);
    }

    // 중복 제거 및 정렬
    const unique = allResults.filter((product, index, self) =>
      index === self.findIndex(p => p.title === product.title)
    );

    return unique.slice(0, 10);
  }

  // ====================================================
  // 유틸리티
  // ====================================================

  private mapNaverProduct = (item: any): ProductSearchResult => {
    // HTML 태그 제거
    const cleanTitle = item.title.replace(/<[^>]*>/g, '');

    return {
      id: item.productId || String(Math.random()),
      title: cleanTitle,
      price: parseInt(item.lprice, 10),
      originalPrice: item.hprice ? parseInt(item.hprice, 10) : undefined,
      discountRate: item.hprice
        ? Math.round((1 - parseInt(item.lprice, 10) / parseInt(item.hprice, 10)) * 100)
        : undefined,
      image: item.image,
      link: item.link,
      mall: item.mallName,
      category: item.category1 + (item.category2 ? ` > ${item.category2}` : ''),
      rating: undefined,  // 네이버 쇼핑 API는 평점 미제공
      reviewCount: undefined,
      isRocket: item.mallName?.includes('쿠팡'),
      isFreeShipping: item.mallName?.includes('쿠팡') || item.mallName?.includes('SSG')
    };
  };

  private getRecommendationCategories(
    goalType: string,
    description: string
  ): Array<{ category: string; searchQuery: string; reason: string }> {
    const recommendations: Record<string, Array<{ category: string; searchQuery: string; reason: string }>> = {
      exercise: [
        { category: '운동 매트', searchQuery: '요가매트 두꺼운', reason: '기본 스트레칭과 홈트레이닝에 필수' },
        { category: '덤벨', searchQuery: '아령 세트 조절식', reason: '근력 운동의 기본 장비' },
        { category: '운동복', searchQuery: '트레이닝복 세트', reason: '편안한 운동을 위한 기능성 의류' },
        { category: '폼롤러', searchQuery: '폼롤러 마사지', reason: '운동 후 근육 회복에 도움' }
      ],
      study: [
        { category: '책상 정리', searchQuery: '책상 정리함 서랍', reason: '집중력을 높이는 깔끔한 환경' },
        { category: '조명', searchQuery: 'LED 스탠드 밝기조절', reason: '눈 피로 감소를 위한 조명' },
        { category: '노트', searchQuery: '스터디 플래너 노트', reason: '체계적인 학습 계획 수립' },
        { category: '타이머', searchQuery: '뽀모도로 타이머', reason: '집중 시간 관리' }
      ],
      diet: [
        { category: '체중계', searchQuery: '스마트 체중계 체지방', reason: '정확한 변화 측정' },
        { category: '식단 도구', searchQuery: '다이어트 도시락 용기', reason: '식단 관리를 위한 도구' },
        { category: '운동 기구', searchQuery: '홈트 줄넘기', reason: '간편한 유산소 운동' },
        { category: '보조제', searchQuery: '단백질 보충제', reason: '영양 보충' }
      ],
      hobby: [
        { category: '입문 키트', searchQuery: `${description} 입문 세트`, reason: '새 취미 시작을 위한 기본 장비' }
      ],
      travel: [
        { category: '캐리어', searchQuery: '여행 캐리어 기내용', reason: '편리한 짐 운반' },
        { category: '파우치', searchQuery: '여행용 파우치 세트', reason: '정리정돈' },
        { category: '보조배터리', searchQuery: '대용량 보조배터리', reason: '여행 중 충전' }
      ],
      other: [
        { category: '관련 용품', searchQuery: description, reason: '목표 달성에 도움이 되는 용품' }
      ]
    };

    return recommendations[goalType] || recommendations.other;
  }

  private getGiftKeywords(recipient: string, occasion: string): string[] {
    const keywords: Record<string, Record<string, string[]>> = {
      birthday: {
        male: ['남자 지갑', '블루투스 이어폰', '남성 향수', '스마트워치'],
        female: ['여자 지갑', '화장품 세트', '향수 선물', '악세서리 세트'],
        child: ['레고', '장난감 선물', '어린이 도서 세트'],
        parent: ['안마기', '건강식품 세트', '전동 마사지기'],
        friend: ['텀블러 고급', '블루투스 스피커', '기프트카드']
      },
      anniversary: {
        male: ['커플 시계', '고급 벨트', '명품 카드지갑'],
        female: ['꽃다발 보존화', '쥬얼리 목걸이', '명품 화장품'],
        friend: ['와인 선물세트', '고급 쿠키 선물']
      }
    };

    const occasionKeywords = keywords[occasion] || keywords.birthday;
    return occasionKeywords[recipient] || occasionKeywords.friend;
  }

  /**
   * Mock data (when no API key)
   */
  private getMockSearchResults(query: string): ProductSearchResult[] {
    const mockProducts: ProductSearchResult[] = [
      {
        id: 'mock-1',
        title: `${query} Best Seller`,
        price: 2990,
        originalPrice: 3990,
        discountRate: 25,
        image: 'https://via.placeholder.com/200',
        link: 'https://example.com/product/1',
        mall: 'Amazon',
        category: 'General',
        rating: 4.7,
        reviewCount: 1234,
        isRocket: false,
        isFreeShipping: true
      },
      {
        id: 'mock-2',
        title: `${query} Popular Item`,
        price: 1990,
        image: 'https://via.placeholder.com/200',
        link: 'https://example.com/product/2',
        mall: 'eBay',
        category: 'General',
        rating: 4.5,
        reviewCount: 892,
        isFreeShipping: true
      },
      {
        id: 'mock-3',
        title: `${query} Premium`,
        price: 4990,
        originalPrice: 5990,
        discountRate: 17,
        image: 'https://via.placeholder.com/200',
        link: 'https://example.com/product/3',
        mall: 'Walmart',
        category: 'Premium',
        rating: 4.8,
        reviewCount: 567
      }
    ];

    return mockProducts;
  }

  /**
   * 상품 상세 정보 (Mock)
   */
  async getProductDetails(productId: string): Promise<ProductDetails | null> {
    // 실제 구현 시 쇼핑몰 API 또는 스크래핑 사용
    const searchResults = await this.searchProducts({ query: productId, display: 1 });

    if (searchResults.length === 0) {
      return null;
    }

    const product = searchResults[0];

    return {
      ...product,
      description: '상세 설명은 쇼핑몰 페이지에서 확인해주세요.',
      specifications: {
        '제조사': '브랜드명',
        '원산지': '한국',
        '모델명': product.id
      },
      reviews: [
        {
          author: '구매자1',
          rating: 5,
          content: '정말 좋은 상품이에요!',
          date: '2024-01-01'
        },
        {
          author: '구매자2',
          rating: 4,
          content: '배송도 빠르고 품질도 좋습니다.',
          date: '2024-01-02'
        }
      ]
    };
  }
}

// 싱글톤 인스턴스
let instance: ShoppingMCP | null = null;

export function getShoppingMCP(): ShoppingMCP {
  if (!instance) {
    instance = new ShoppingMCP();
  }
  return instance;
}
