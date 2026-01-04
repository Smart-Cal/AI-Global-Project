/**
 * Shopping Agent - MCP 패턴 기반 상품 추천 에이전트
 *
 * ========================================
 * MCP (Model Context Protocol) 패턴 구현
 * ========================================
 *
 * Input:
 *   - user_query: 사용자의 자연어 쇼핑 요청
 *   - user_profile: 사용자 정보 (선호도, 예산 등)
 *
 * Context:
 *   - product_catalog: JSON 기반 상품 카탈로그 (로컬)
 *   - external_providers: 해외 쇼핑 API (Amazon, eBay, AliExpress)
 *   - recommendation_rules: 추천 규칙
 *
 * Output:
 *   - ranked_products: 목적 적합도 기준 정렬된 상품 목록
 *   - explanation: 추천 이유 설명
 *
 * ========================================
 * 특징
 * ========================================
 * - 특정 브랜드 우선 노출 X → 사용자 목적 적합도 기준 정렬
 * - 멀티 프로바이더 지원 (Amazon, eBay, AliExpress)
 * - 프론트엔드에서 바로 사용 가능한 구조 반환
 *
 * ========================================
 * 데이터 소스 우선순위
 * ========================================
 * 1. 해외 API (Amazon, eBay, AliExpress) - 실시간 데이터
 * 2. 로컬 Product Catalog (JSON) - API 실패 시 Fallback
 *
 * ========================================
 * 기존 Agent 연결 (routerAgent.ts)
 * ========================================
 * - IntentType: 'shopping' 으로 라우팅 시 이 에이전트 호출
 * - mcpAgentLoop.ts의 handleShopping()에서 활용
 *
 * ========================================
 * 기존 Agent 연결 (specializedAgents.ts)
 * ========================================
 * - processShopping() 함수로 export
 * - 동일한 AgentResponse 인터페이스 반환
 */

import OpenAI from 'openai';
import { AgentResponse } from '../types/index.js';
import {
  ShoppingMultiProvider,
  getShoppingMultiProvider
} from '../mcp/shoppingMultiProvider.js';
import {
  ProductResult,
  SearchOptions,
  ShoppingRegion,
  AggregatedSearchResult
} from '../mcp/providers/types.js';

// ============================================================
// 타입 정의 (Type Definitions)
// ============================================================

/**
 * 사용자 프로필 - 개인화 추천에 사용
 */
export interface UserProfile {
  user_id: string;
  preferences?: {
    preferred_categories?: string[];  // 선호 카테고리
    price_sensitivity?: 'low' | 'medium' | 'high';  // 가격 민감도
    quality_preference?: 'budget' | 'balanced' | 'premium';  // 품질 선호도
    eco_friendly?: boolean;  // 친환경 선호
  };
  budget?: {
    min?: number;
    max?: number;
  };
  purchase_history?: string[];  // 과거 구매 카테고리
}

/**
 * 쇼핑 요청 컨텍스트
 */
export interface ShoppingContext {
  user_query: string;
  user_profile: UserProfile;
  product_catalog?: ProductCatalog;
  recommendation_rules?: RecommendationRules;
}

/**
 * 상품 카탈로그 내 개별 상품
 */
export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  original_price?: number;
  discount_rate?: number;
  brand: string;
  rating: number;          // 1.0 ~ 5.0
  review_count: number;
  tags: string[];          // 검색/매칭용 태그
  features: string[];      // 상품 특징
  image_url?: string;
  in_stock: boolean;
  eco_friendly?: boolean;
  best_seller?: boolean;
  created_at?: string;
}

/**
 * 상품 카탈로그 구조
 */
export interface ProductCatalog {
  version: string;
  last_updated: string;
  categories: CategoryInfo[];
  products: Product[];
}

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  id: string;
  name: string;
  subcategories?: string[];
  keywords: string[];      // 카테고리 매칭용 키워드
}

/**
 * 추천 규칙
 */
export interface RecommendationRules {
  // 가중치 설정 (합계 1.0)
  weights: {
    relevance: number;     // 쿼리 관련성
    rating: number;        // 평점
    reviews: number;       // 리뷰 수
    price_match: number;   // 예산 적합도
    preference_match: number;  // 사용자 선호도 매칭
  };
  // 필터 규칙
  filters: {
    min_rating: number;
    min_reviews: number;
    in_stock_only: boolean;
  };
  // 정렬 규칙
  sort_by: 'relevance' | 'rating' | 'price_asc' | 'price_desc' | 'popularity';
}

/**
 * 랭킹된 상품 (점수 포함)
 */
export interface RankedProduct extends Product {
  relevance_score: number;      // 0.0 ~ 1.0
  final_score: number;          // 최종 점수
  match_reasons: string[];      // 매칭된 이유
}

/**
 * ShoppingAgent 출력 구조
 */
export interface ShoppingAgentOutput {
  ranked_products: RankedProduct[];
  explanation: string;
  query_analysis: {
    intent: ShoppingIntent;
    extracted_keywords: string[];
    detected_category?: string;
    price_range?: { min?: number; max?: number };
  };
  meta: {
    total_candidates: number;
    filtered_count: number;
    processing_time_ms: number;
  };
}

/**
 * 쇼핑 의도 분류
 */
export type ShoppingIntent =
  | 'product_search'       // 일반 상품 검색
  | 'gift_recommendation'  // 선물 추천
  | 'goal_related'         // 목표 연계 추천
  | 'price_comparison'     // 가격 비교
  | 'category_browse'      // 카테고리 탐색
  | 'specific_item';       // 특정 상품 검색

// ============================================================
// 기본값 정의
// ============================================================

const DEFAULT_RECOMMENDATION_RULES: RecommendationRules = {
  weights: {
    relevance: 0.35,
    rating: 0.25,
    reviews: 0.15,
    price_match: 0.15,
    preference_match: 0.10
  },
  filters: {
    min_rating: 3.5,
    min_reviews: 5,
    in_stock_only: true
  },
  sort_by: 'relevance'
};

// ============================================================
// OpenAI 클라이언트
// ============================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============================================================
// ShoppingAgent 클래스
// ============================================================

export class ShoppingAgent {
  private catalog: ProductCatalog;
  private rules: RecommendationRules;
  private multiProvider: ShoppingMultiProvider;
  private useExternalProviders: boolean;

  constructor(
    catalog?: ProductCatalog,
    rules?: RecommendationRules,
    options?: { useExternalProviders?: boolean }
  ) {
    // 카탈로그가 없으면 기본 카탈로그 로드
    this.catalog = catalog || getDefaultProductCatalog();
    this.rules = rules || DEFAULT_RECOMMENDATION_RULES;

    // 멀티 프로바이더 초기화
    this.multiProvider = getShoppingMultiProvider({
      useMockWhenUnavailable: true
    });

    // 외부 프로바이더 사용 여부 (기본: true)
    this.useExternalProviders = options?.useExternalProviders !== false;
  }

  // ====================================================
  // 메인 처리 함수 (MCP 패턴)
  // ====================================================

  /**
   * 사용자 쇼핑 요청 처리
   *
   * MCP Input → Context 활용 → Output 생성
   *
   * 데이터 소스 우선순위:
   * 1. 외부 프로바이더 (Amazon, eBay, AliExpress)
   * 2. 로컬 카탈로그 (Fallback)
   */
  async processShoppingRequest(
    context: ShoppingContext
  ): Promise<ShoppingAgentOutput> {
    const startTime = Date.now();

    // 1. 쿼리 분석 (LLM 활용)
    const queryAnalysis = await this.analyzeQuery(
      context.user_query,
      context.user_profile
    );

    // 2. 외부 프로바이더에서 검색 시도
    if (this.useExternalProviders) {
      const externalResult = await this.searchFromExternalProviders(
        context.user_query,
        queryAnalysis,
        context.user_profile
      );

      if (externalResult && externalResult.ranked_products.length > 0) {
        return externalResult;
      }
    }

    // 3. Fallback: 로컬 카탈로그에서 검색
    console.log('[ShoppingAgent] Falling back to local catalog');

    // 3-1. 상품 후보 검색 (Product Catalog에서)
    const candidates = this.searchCandidates(
      queryAnalysis.extracted_keywords,
      queryAnalysis.detected_category
    );

    // 3-2. 필터링
    const filtered = this.filterProducts(
      candidates,
      context.user_profile,
      queryAnalysis.price_range
    );

    // 3-3. 점수 계산 및 랭킹 (목적 적합도 기준)
    const ranked = await this.rankProducts(
      filtered,
      context.user_query,
      context.user_profile,
      queryAnalysis
    );

    // 5. 추천 이유 생성 (LLM)
    const explanation = await this.generateExplanation(
      ranked.slice(0, 5),
      context.user_query,
      context.user_profile
    );

    const processingTime = Date.now() - startTime;

    return {
      ranked_products: ranked,
      explanation,
      query_analysis: queryAnalysis,
      meta: {
        total_candidates: candidates.length,
        filtered_count: filtered.length,
        processing_time_ms: processingTime
      }
    };
  }

  // ====================================================
  // 외부 프로바이더 검색 (Amazon, eBay, AliExpress)
  // ====================================================

  /**
   * 외부 쇼핑 프로바이더에서 검색
   */
  private async searchFromExternalProviders(
    query: string,
    queryAnalysis: ShoppingAgentOutput['query_analysis'],
    userProfile: UserProfile
  ): Promise<ShoppingAgentOutput | null> {
    const startTime = Date.now();

    try {
      // 검색 옵션 구성
      const searchOptions: SearchOptions = {
        query,
        minPrice: queryAnalysis.price_range?.min || userProfile.budget?.min,
        maxPrice: queryAnalysis.price_range?.max || userProfile.budget?.max,
        category: queryAnalysis.detected_category,
        limit: 20,
        sort: 'relevance',
        language: 'en'  // 해외 API는 영어 사용
      };

      // 멀티 프로바이더 검색
      const result: AggregatedSearchResult = await this.multiProvider.searchProducts(searchOptions);

      if (result.products.length === 0) {
        console.log('[ShoppingAgent] No products from external providers');
        return null;
      }

      console.log(`[ShoppingAgent] Found ${result.products.length} products from ${result.stats.successfulProviders.join(', ')}`);

      // 외부 상품을 RankedProduct로 변환
      const rankedProducts: RankedProduct[] = result.products.map((product, index) => ({
        // 기본 Product 필드
        id: product.id,
        name: product.title,
        category: product.category || 'General',
        subcategory: undefined,
        price: product.priceInUSD || product.price,  // USD 기준
        original_price: product.originalPrice,
        discount_rate: product.discountRate,
        brand: product.brand || product.seller?.name || 'Unknown',
        rating: product.rating || 4.0,
        review_count: product.reviewCount || 0,
        tags: product.badges || [],
        features: [],
        image_url: product.imageUrl,
        in_stock: product.availability !== 'out_of_stock',
        eco_friendly: false,
        best_seller: product.badges?.includes('Best Seller'),

        // RankedProduct 확장 필드
        relevance_score: 1 - (index * 0.05),  // 순서 기반 점수
        final_score: (product.rating || 4.0) / 5 * (1 - index * 0.02),
        match_reasons: this.extractMatchReasons(product, query),

        // 추가 정보 (프론트엔드용)
        provider: product.provider,
        productUrl: product.productUrl,
        affiliateUrl: product.affiliateUrl,
        currency: product.currency,
        shippingInfo: product.shippingInfo
      }));

      // 추천 이유 생성
      const explanation = await this.generateExplanation(
        rankedProducts.slice(0, 5),
        query,
        userProfile
      );

      const processingTime = Date.now() - startTime;

      return {
        ranked_products: rankedProducts,
        explanation,
        query_analysis: queryAnalysis,
        meta: {
          total_candidates: result.stats.totalProducts,
          filtered_count: rankedProducts.length,
          processing_time_ms: processingTime
        }
      };
    } catch (error: any) {
      console.error('[ShoppingAgent] External provider error:', error.message);
      return null;
    }
  }

  /**
   * 외부 상품에서 매칭 이유 추출
   */
  private extractMatchReasons(product: ProductResult, query: string): string[] {
    const reasons: string[] = [];

    if (product.rating && product.rating >= 4.5) {
      reasons.push(`High rating (${product.rating}★)`);
    }
    if (product.reviewCount && product.reviewCount >= 1000) {
      reasons.push(`${product.reviewCount.toLocaleString()} reviews`);
    }
    if (product.badges?.includes('Best Seller')) {
      reasons.push('Best Seller');
    }
    if (product.shippingInfo?.isFreeShipping) {
      reasons.push('Free Shipping');
    }
    if (product.discountRate && product.discountRate >= 20) {
      reasons.push(`${product.discountRate}% off`);
    }

    // 프로바이더 표시
    const providerNames: Record<string, string> = {
      amazon: 'Amazon',
      ebay: 'eBay',
      aliexpress: 'AliExpress',
      mock: 'Demo'
    };
    reasons.push(`From ${providerNames[product.provider] || product.provider}`);

    return reasons;
  }

  // ====================================================
  // Step 1: 쿼리 분석 (LLM)
  // ====================================================

  private async analyzeQuery(
    query: string,
    userProfile: UserProfile
  ): Promise<ShoppingAgentOutput['query_analysis']> {
    const systemPrompt = `당신은 쇼핑 쿼리 분석 전문가입니다.
사용자의 쇼핑 요청을 분석하여 다음 정보를 추출하세요.

## 의도 분류 (intent)
- product_search: 일반 상품 검색 ("러닝화 추천해줘")
- gift_recommendation: 선물 추천 ("생일 선물 뭐가 좋을까")
- goal_related: 목표 연계 ("다이어트 시작하려는데 필요한 거")
- price_comparison: 가격 비교 ("에어팟 어디가 싸?")
- category_browse: 카테고리 탐색 ("운동용품 뭐 있어?")
- specific_item: 특정 상품 ("삼성 갤럭시탭 S9")

## 응답 형식 (JSON)
{
  "intent": "의도",
  "extracted_keywords": ["키워드1", "키워드2"],
  "detected_category": "카테고리명 (없으면 null)",
  "price_range": {
    "min": 숫자 또는 null,
    "max": 숫자 또는 null
  }
}

## 예시
입력: "3만원대 블루투스 이어폰 추천해줘"
→ intent: "product_search"
→ extracted_keywords: ["블루투스", "이어폰", "무선"]
→ detected_category: "전자기기"
→ price_range: { min: 30000, max: 39999 }

JSON만 출력하세요.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query }
        ],
        temperature: 0.1
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
        intent: parsed.intent || 'product_search',
        extracted_keywords: parsed.extracted_keywords || [query],
        detected_category: parsed.detected_category || undefined,
        price_range: parsed.price_range || undefined
      };
    } catch (error) {
      console.error('[ShoppingAgent] analyzeQuery error:', error);
      // 폴백: 단순 키워드 추출
      return {
        intent: 'product_search',
        extracted_keywords: query.split(/\s+/).filter(w => w.length > 1),
        detected_category: undefined,
        price_range: undefined
      };
    }
  }

  // ====================================================
  // Step 2: 상품 후보 검색
  // ====================================================

  private searchCandidates(
    keywords: string[],
    category?: string
  ): Product[] {
    let candidates = [...this.catalog.products];

    // 카테고리 필터
    if (category) {
      const categoryLower = category.toLowerCase();
      candidates = candidates.filter(p =>
        p.category.toLowerCase().includes(categoryLower) ||
        p.subcategory?.toLowerCase().includes(categoryLower)
      );
    }

    // 키워드 매칭
    if (keywords.length > 0) {
      candidates = candidates.filter(product => {
        const searchText = [
          product.name,
          product.category,
          product.subcategory,
          product.brand,
          ...product.tags,
          ...product.features
        ].join(' ').toLowerCase();

        // 키워드 중 하나라도 매칭되면 포함
        return keywords.some(keyword =>
          searchText.includes(keyword.toLowerCase())
        );
      });
    }

    return candidates;
  }

  // ====================================================
  // Step 3: 필터링
  // ====================================================

  private filterProducts(
    products: Product[],
    userProfile: UserProfile,
    priceRange?: { min?: number; max?: number }
  ): Product[] {
    let filtered = products;

    // 재고 필터
    if (this.rules.filters.in_stock_only) {
      filtered = filtered.filter(p => p.in_stock);
    }

    // 최소 평점 필터
    filtered = filtered.filter(p =>
      p.rating >= this.rules.filters.min_rating
    );

    // 최소 리뷰 수 필터
    filtered = filtered.filter(p =>
      p.review_count >= this.rules.filters.min_reviews
    );

    // 가격 범위 필터 (쿼리에서 추출)
    if (priceRange) {
      if (priceRange.min !== undefined) {
        filtered = filtered.filter(p => p.price >= priceRange.min!);
      }
      if (priceRange.max !== undefined) {
        filtered = filtered.filter(p => p.price <= priceRange.max!);
      }
    }

    // 사용자 예산 필터
    if (userProfile.budget) {
      if (userProfile.budget.min !== undefined) {
        filtered = filtered.filter(p => p.price >= userProfile.budget!.min!);
      }
      if (userProfile.budget.max !== undefined) {
        filtered = filtered.filter(p => p.price <= userProfile.budget!.max!);
      }
    }

    // 친환경 선호 필터
    if (userProfile.preferences?.eco_friendly) {
      // 친환경 상품 우선 (필터가 아닌 boost로 처리)
      filtered.sort((a, b) => {
        if (a.eco_friendly && !b.eco_friendly) return -1;
        if (!a.eco_friendly && b.eco_friendly) return 1;
        return 0;
      });
    }

    return filtered;
  }

  // ====================================================
  // Step 4: 점수 계산 및 랭킹 (목적 적합도 기준)
  // ====================================================

  private async rankProducts(
    products: Product[],
    query: string,
    userProfile: UserProfile,
    queryAnalysis: ShoppingAgentOutput['query_analysis']
  ): Promise<RankedProduct[]> {
    const keywords = queryAnalysis.extracted_keywords;
    const priceRange = queryAnalysis.price_range;

    const rankedProducts: RankedProduct[] = products.map(product => {
      // 1. 관련성 점수 (키워드 매칭 비율)
      const relevanceScore = this.calculateRelevanceScore(product, keywords);

      // 2. 평점 점수 (정규화: 0~1)
      const ratingScore = product.rating / 5.0;

      // 3. 리뷰 점수 (로그 스케일 정규화)
      const reviewScore = Math.min(1, Math.log10(product.review_count + 1) / 4);

      // 4. 가격 적합도 점수
      const priceScore = this.calculatePriceScore(product, priceRange, userProfile);

      // 5. 사용자 선호도 매칭 점수
      const preferenceScore = this.calculatePreferenceScore(product, userProfile);

      // 가중치 적용 최종 점수
      const finalScore =
        this.rules.weights.relevance * relevanceScore +
        this.rules.weights.rating * ratingScore +
        this.rules.weights.reviews * reviewScore +
        this.rules.weights.price_match * priceScore +
        this.rules.weights.preference_match * preferenceScore;

      // 매칭 이유 수집
      const matchReasons: string[] = [];
      if (relevanceScore > 0.5) matchReasons.push('검색어와 높은 관련성');
      if (ratingScore > 0.8) matchReasons.push(`높은 평점 (${product.rating}점)`);
      if (reviewScore > 0.5) matchReasons.push(`많은 리뷰 (${product.review_count}개)`);
      if (priceScore > 0.7) matchReasons.push('예산 범위 내');
      if (product.best_seller) matchReasons.push('베스트셀러');
      if (product.eco_friendly && userProfile.preferences?.eco_friendly) {
        matchReasons.push('친환경 상품');
      }

      return {
        ...product,
        relevance_score: relevanceScore,
        final_score: finalScore,
        match_reasons: matchReasons
      };
    });

    // 최종 점수 기준 내림차순 정렬 (목적 적합도 기준)
    rankedProducts.sort((a, b) => b.final_score - a.final_score);

    // 관련성이 너무 낮은 상품 필터링 (relevance_score가 0.2 미만이면 제외)
    const filteredProducts = rankedProducts.filter(p => p.relevance_score >= 0.2);

    // 필터링 후에도 결과가 없으면 원본 반환 (최소 3개)
    if (filteredProducts.length < 3) {
      return rankedProducts.slice(0, 9);
    }

    return filteredProducts;
  }

  // 관련성 점수 계산 (개선된 버전 - 핵심 키워드 가중치 적용)
  private calculateRelevanceScore(product: Product, keywords: string[]): number {
    if (keywords.length === 0) return 0.5;

    // 상품명에서 핵심 단어 추출 (더 높은 가중치)
    const productName = product.name.toLowerCase();
    const searchText = [
      product.name,
      product.category,
      product.subcategory,
      product.brand,
      ...product.tags,
      ...product.features
    ].join(' ').toLowerCase();

    let totalScore = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();

      // 핵심 상품 유형 키워드 (신발, 가방, 시계 등)
      const isProductTypeKeyword = this.isProductTypeKeyword(lowerKeyword);
      const weight = isProductTypeKeyword ? 3 : 1;  // 상품 유형 키워드는 3배 가중치

      totalWeight += weight;

      // 상품명에 키워드가 포함되면 높은 점수
      if (productName.includes(lowerKeyword)) {
        totalScore += weight * 1.0;
      }
      // 전체 텍스트에 포함되면 중간 점수
      else if (searchText.includes(lowerKeyword)) {
        totalScore += weight * 0.5;
      }
      // 부분 매칭 (예: "러닝" -> "러닝화")
      else if (this.hasPartialMatch(searchText, lowerKeyword)) {
        totalScore += weight * 0.3;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // 상품 유형 키워드 체크
  private isProductTypeKeyword(keyword: string): boolean {
    const productTypes = [
      '신발', '운동화', '러닝화', '스니커즈', '구두', '슬리퍼', '샌들',
      '가방', '백팩', '크로스백', '숄더백', '지갑',
      '옷', '셔츠', '바지', '자켓', '코트', '드레스', '스커트',
      '시계', '선글라스', '안경', '모자', '벨트', '스카프',
      '화장품', '스킨케어', '메이크업', '선크림', '로션',
      '전자기기', '이어폰', '헤드폰', '스피커', '키보드', '마우스',
      '책', '노트북', '필기구', '문구',
      '건강', '영양제', '비타민', '프로틴',
      '식품', '음료', '과자', '커피',
      'shoes', 'bag', 'watch', 'clothes', 'electronics'
    ];
    return productTypes.some(type => keyword.includes(type) || type.includes(keyword));
  }

  // 부분 매칭 체크
  private hasPartialMatch(text: string, keyword: string): boolean {
    // 키워드가 2글자 이상이면 부분 매칭 시도
    if (keyword.length >= 2) {
      // 키워드의 70% 이상이 텍스트에 포함되면 매칭으로 간주
      const minLength = Math.ceil(keyword.length * 0.7);
      for (let i = 0; i <= keyword.length - minLength; i++) {
        const partial = keyword.slice(i, i + minLength);
        if (text.includes(partial)) return true;
      }
    }
    return false;
  }

  // 가격 적합도 점수 계산
  private calculatePriceScore(
    product: Product,
    priceRange?: { min?: number; max?: number },
    userProfile?: UserProfile
  ): number {
    const budget = userProfile?.budget || priceRange;
    if (!budget) return 0.5;  // 예산 정보 없으면 중립

    const { min, max } = budget;

    // 범위 내면 1.0, 범위 밖이면 거리에 따라 감소
    if (min !== undefined && max !== undefined) {
      if (product.price >= min && product.price <= max) {
        // 범위 중앙에 가까울수록 높은 점수
        const mid = (min + max) / 2;
        const range = (max - min) / 2;
        const distance = Math.abs(product.price - mid);
        return 1 - (distance / range) * 0.3;  // 최대 0.3 감소
      }
    }

    if (max !== undefined && product.price <= max) return 0.8;
    if (min !== undefined && product.price >= min) return 0.6;

    return 0.3;  // 범위 밖
  }

  // 사용자 선호도 매칭 점수
  private calculatePreferenceScore(
    product: Product,
    userProfile: UserProfile
  ): number {
    let score = 0.5;  // 기본값
    const prefs = userProfile.preferences;

    if (!prefs) return score;

    // 선호 카테고리 매칭
    if (prefs.preferred_categories?.length) {
      const categoryMatch = prefs.preferred_categories.some(cat =>
        product.category.toLowerCase().includes(cat.toLowerCase()) ||
        product.subcategory?.toLowerCase().includes(cat.toLowerCase())
      );
      if (categoryMatch) score += 0.2;
    }

    // 품질 선호도 매칭
    if (prefs.quality_preference) {
      switch (prefs.quality_preference) {
        case 'budget':
          if (product.price < 50000) score += 0.15;
          break;
        case 'premium':
          if (product.rating >= 4.5 || product.best_seller) score += 0.15;
          break;
        case 'balanced':
          if (product.rating >= 4.0 && product.price < 100000) score += 0.15;
          break;
      }
    }

    // 친환경 선호
    if (prefs.eco_friendly && product.eco_friendly) {
      score += 0.15;
    }

    return Math.min(1, score);
  }

  // ====================================================
  // Step 5: 추천 이유 생성 (LLM)
  // ====================================================

  private async generateExplanation(
    topProducts: RankedProduct[],
    query: string,
    userProfile: UserProfile
  ): Promise<string> {
    if (topProducts.length === 0) {
      return '죄송합니다. 조건에 맞는 상품을 찾지 못했어요. 다른 검색어로 시도해보세요.';
    }

    const productSummary = topProducts.slice(0, 3).map((p, i) => {
      const reasons = p.match_reasons.join(', ');
      return `${i + 1}. ${p.name} (${p.price.toLocaleString()}원) - ${reasons}`;
    }).join('\n');

    const systemPrompt = `당신은 친절한 쇼핑 어시스턴트입니다.
사용자의 쇼핑 요청과 추천 상품 목록을 바탕으로 자연스러운 추천 설명을 작성하세요.

## 규칙
- 2-3문장으로 간결하게
- 특정 브랜드를 과도하게 홍보하지 않음
- 사용자의 요청과 상품이 왜 적합한지 설명
- 친근하고 도움이 되는 톤

## 사용자 요청
"${query}"

## 추천 상품
${productSummary}

추천 설명을 작성하세요.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: '추천 설명을 작성해주세요.' }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      return response.choices[0]?.message?.content ||
        `"${query}"에 맞는 상품 ${topProducts.length}개를 찾았어요!`;
    } catch (error) {
      console.error('[ShoppingAgent] generateExplanation error:', error);
      return `"${query}"에 맞는 상품 ${topProducts.length}개를 찾았어요!`;
    }
  }
}

// ============================================================
// 기존 Agent 시스템과 연결 (specializedAgents.ts 패턴)
// ============================================================

/**
 * processShopping - 쇼핑 요청 처리 함수
 *
 * 기존 specializedAgents.ts의 processEvent, processGoal 등과
 * 동일한 인터페이스를 따릅니다.
 *
 * @연결점: routerAgent.ts에서 intent가 'shopping'일 때 호출
 * @연결점: mcpAgentLoop.ts의 handleShopping()에서 활용
 */
export async function processShopping(
  routerResult: {
    extractedInfo: {
      searchQuery?: string;
      title?: string;
      category?: string;
      budget?: number;
      minPrice?: number;
      maxPrice?: number;
      recipient?: string;
      occasion?: string;
    };
    originalMessage: string;
  },
  agentContext: {
    userId: string;
    today: string;
  }
): Promise<AgentResponse> {
  const agent = new ShoppingAgent();

  const userProfile: UserProfile = {
    user_id: agentContext.userId,
    budget: {
      min: routerResult.extractedInfo.minPrice,
      max: routerResult.extractedInfo.maxPrice || routerResult.extractedInfo.budget
    }
  };

  const context: ShoppingContext = {
    user_query: routerResult.extractedInfo.searchQuery ||
      routerResult.extractedInfo.title ||
      routerResult.originalMessage,
    user_profile: userProfile
  };

  try {
    const result = await agent.processShoppingRequest(context);

    if (result.ranked_products.length === 0) {
      return {
        message: '죄송해요, 조건에 맞는 상품을 찾지 못했어요. 다른 검색어로 시도해볼까요?',
        needs_user_input: true
      };
    }

    // 간략한 텍스트 메시지 (상품 목록은 카드로만 표시)
    const message = result.explanation;

    // AgentResponse 형식으로 반환 (상세 정보는 mcp_data로)
    return {
      message,
      mcp_data: {
        products: result.ranked_products.slice(0, 10).map(p => ({
          id: p.id,
          title: p.name,
          price: p.price,
          originalPrice: p.original_price,
          currency: (p as any).currency || 'KRW',
          rating: p.rating,
          reviewCount: p.review_count,
          imageUrl: p.image_url || (p as any).imageUrl,
          productUrl: (p as any).productUrl || (p as any).affiliateUrl,
          seller: p.brand || (p as any).provider,
          matchReasons: p.match_reasons
        }))
      },
      suggestions: result.ranked_products.slice(0, 3).map(p => p.name)
    };
  } catch (error) {
    console.error('[ShoppingAgent] processShopping error:', error);
    return {
      message: '상품 검색 중 문제가 발생했어요. 다시 시도해주세요.',
      needs_user_input: true
    };
  }
}

// ============================================================
// 기본 Product Catalog (JSON 기반)
// ============================================================

/**
 * 기본 상품 카탈로그
 *
 * 요구사항: Product Catalog는 초기에는 JSON 기반으로 구현
 * 추후 외부 API나 DB로 대체 가능
 */
export function getDefaultProductCatalog(): ProductCatalog {
  return {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    categories: [
      {
        id: 'electronics',
        name: '전자기기',
        subcategories: ['이어폰', '스마트워치', '태블릿', '충전기'],
        keywords: ['전자', '기기', '디지털', '테크', '스마트']
      },
      {
        id: 'fitness',
        name: '운동/피트니스',
        subcategories: ['운동기구', '운동복', '운동화', '보조제'],
        keywords: ['운동', '피트니스', '헬스', '다이어트', '트레이닝']
      },
      {
        id: 'beauty',
        name: '뷰티/화장품',
        subcategories: ['스킨케어', '메이크업', '향수', '헤어케어'],
        keywords: ['화장품', '뷰티', '스킨', '메이크업', '향수']
      },
      {
        id: 'home',
        name: '홈/리빙',
        subcategories: ['주방용품', '침구', '인테리어', '청소용품'],
        keywords: ['홈', '리빙', '가정', '주방', '인테리어']
      },
      {
        id: 'fashion',
        name: '패션',
        subcategories: ['의류', '신발', '가방', '액세서리'],
        keywords: ['패션', '옷', '의류', '신발', '가방']
      },
      {
        id: 'study',
        name: '학습/문구',
        subcategories: ['책', '노트', '필기구', '데스크용품'],
        keywords: ['공부', '학습', '문구', '책', '스터디']
      }
    ],
    products: [
      // 전자기기 - 이어폰
      {
        id: 'prod-001',
        name: '프리미엄 무선 블루투스 이어폰 Pro',
        category: '전자기기',
        subcategory: '이어폰',
        price: 89000,
        original_price: 129000,
        discount_rate: 31,
        brand: 'SoundMax',
        rating: 4.7,
        review_count: 2834,
        tags: ['블루투스', '무선', '이어폰', 'ANC', '노이즈캔슬링'],
        features: ['액티브 노이즈 캔슬링', '30시간 배터리', 'IPX5 방수'],
        in_stock: true,
        best_seller: true
      },
      {
        id: 'prod-002',
        name: '가성비 블루투스 이어폰',
        category: '전자기기',
        subcategory: '이어폰',
        price: 29900,
        brand: 'BudgetSound',
        rating: 4.3,
        review_count: 5621,
        tags: ['블루투스', '무선', '이어폰', '가성비'],
        features: ['20시간 배터리', '빠른 페어링', '경량 설계'],
        in_stock: true,
        best_seller: true
      },
      {
        id: 'prod-003',
        name: '오픈형 골전도 이어폰',
        category: '전자기기',
        subcategory: '이어폰',
        price: 79000,
        brand: 'BoneAudio',
        rating: 4.5,
        review_count: 892,
        tags: ['골전도', '오픈형', '이어폰', '운동용', '스포츠'],
        features: ['귀를 막지 않는 설계', '땀 방지', '8시간 배터리'],
        in_stock: true
      },

      // 운동/피트니스
      {
        id: 'prod-010',
        name: '홈트레이닝 요가매트 10mm',
        category: '운동/피트니스',
        subcategory: '운동기구',
        price: 19900,
        original_price: 29900,
        discount_rate: 33,
        brand: 'FitHome',
        rating: 4.6,
        review_count: 3421,
        tags: ['요가', '매트', '홈트', '운동', '스트레칭'],
        features: ['미끄럼 방지', '두꺼운 쿠션감', '휴대용 가방 포함'],
        in_stock: true,
        eco_friendly: true
      },
      {
        id: 'prod-011',
        name: '조절식 덤벨 세트 24kg',
        category: '운동/피트니스',
        subcategory: '운동기구',
        price: 149000,
        brand: 'PowerLift',
        rating: 4.8,
        review_count: 1256,
        tags: ['덤벨', '아령', '웨이트', '근력운동', '홈짐'],
        features: ['2kg~24kg 조절', '공간 절약', '그립감 우수'],
        in_stock: true,
        best_seller: true
      },
      {
        id: 'prod-012',
        name: '프로틴 쉐이커 보틀 600ml',
        category: '운동/피트니스',
        subcategory: '보조제',
        price: 9900,
        brand: 'ShakeMaster',
        rating: 4.4,
        review_count: 7823,
        tags: ['쉐이커', '보틀', '프로틴', '운동', '물통'],
        features: ['믹싱 볼 포함', 'BPA Free', '누수 방지'],
        in_stock: true
      },
      {
        id: 'prod-013',
        name: '쿠션 러닝화 에어맥스',
        category: '운동/피트니스',
        subcategory: '운동화',
        price: 89000,
        original_price: 119000,
        discount_rate: 25,
        brand: 'RunFast',
        rating: 4.5,
        review_count: 2341,
        tags: ['러닝화', '운동화', '달리기', '쿠션', '런닝'],
        features: ['에어 쿠션', '통기성 메쉬', '가벼운 무게'],
        in_stock: true
      },

      // 뷰티/화장품
      {
        id: 'prod-020',
        name: '수분 에센스 세럼 50ml',
        category: '뷰티/화장품',
        subcategory: '스킨케어',
        price: 35000,
        brand: 'GlowSkin',
        rating: 4.6,
        review_count: 4521,
        tags: ['에센스', '세럼', '수분', '스킨케어', '보습'],
        features: ['히알루론산', '무향료', '민감성 피부 사용 가능'],
        in_stock: true
      },
      {
        id: 'prod-021',
        name: '비건 립스틱 세트 5종',
        category: '뷰티/화장품',
        subcategory: '메이크업',
        price: 29000,
        brand: 'VeganBeauty',
        rating: 4.4,
        review_count: 1823,
        tags: ['립스틱', '메이크업', '비건', '화장품', '선물세트'],
        features: ['동물실험 NO', '자연유래 성분', '롱래스팅'],
        in_stock: true,
        eco_friendly: true
      },

      // 홈/리빙
      {
        id: 'prod-030',
        name: '스마트 무선 가습기',
        category: '홈/리빙',
        subcategory: '가전',
        price: 49900,
        brand: 'SmartHome',
        rating: 4.5,
        review_count: 2134,
        tags: ['가습기', '무선', '스마트', '가전', '공기청정'],
        features: ['앱 연동', '자동 습도 조절', '저소음'],
        in_stock: true
      },
      {
        id: 'prod-031',
        name: '프리미엄 텀블러 500ml',
        category: '홈/리빙',
        subcategory: '주방용품',
        price: 32000,
        brand: 'ThermoMax',
        rating: 4.7,
        review_count: 5234,
        tags: ['텀블러', '보온', '보냉', '물병', '에코'],
        features: ['24시간 보온', '진공 단열', 'BPA Free'],
        in_stock: true,
        eco_friendly: true,
        best_seller: true
      },

      // 학습/문구
      {
        id: 'prod-040',
        name: '스터디 플래너 6개월용',
        category: '학습/문구',
        subcategory: '노트',
        price: 18000,
        brand: 'StudyMate',
        rating: 4.8,
        review_count: 3421,
        tags: ['플래너', '스터디', '다이어리', '계획', '공부'],
        features: ['월간/주간 플래닝', '습관 트래커', '오답노트'],
        in_stock: true
      },
      {
        id: 'prod-041',
        name: 'LED 책상 스탠드 밝기조절',
        category: '학습/문구',
        subcategory: '데스크용품',
        price: 29900,
        original_price: 39900,
        discount_rate: 25,
        brand: 'LightPro',
        rating: 4.6,
        review_count: 2876,
        tags: ['스탠드', 'LED', '조명', '책상', '공부'],
        features: ['5단계 밝기', '색온도 조절', 'USB 충전 포트'],
        in_stock: true
      },

      // 패션
      {
        id: 'prod-050',
        name: '캐주얼 크로스백 미니',
        category: '패션',
        subcategory: '가방',
        price: 39000,
        brand: 'UrbanStyle',
        rating: 4.5,
        review_count: 1923,
        tags: ['크로스백', '가방', '미니백', '캐주얼', '데일리'],
        features: ['방수 원단', '다용도 수납', '경량'],
        in_stock: true
      },
      {
        id: 'prod-051',
        name: '기능성 발열 내의 세트',
        category: '패션',
        subcategory: '의류',
        price: 29900,
        brand: 'WarmTech',
        rating: 4.4,
        review_count: 4231,
        tags: ['발열', '내의', '보온', '겨울', '이너웨어'],
        features: ['체온 유지', '얇고 가벼움', '스트레치'],
        in_stock: true
      },

      // 선물용 상품
      {
        id: 'prod-060',
        name: '프리미엄 디퓨저 선물세트',
        category: '홈/리빙',
        subcategory: '인테리어',
        price: 45000,
        brand: 'AromaBliss',
        rating: 4.7,
        review_count: 1234,
        tags: ['디퓨저', '선물', '향기', '인테리어', '기프트'],
        features: ['3가지 향 포함', '고급 포장', '6개월 지속'],
        in_stock: true
      },
      {
        id: 'prod-061',
        name: '스마트워치 피트니스 에디션',
        category: '전자기기',
        subcategory: '스마트워치',
        price: 159000,
        original_price: 199000,
        discount_rate: 20,
        brand: 'FitWatch',
        rating: 4.6,
        review_count: 3421,
        tags: ['스마트워치', '피트니스', '운동', '선물', '헬스'],
        features: ['심박수 모니터링', 'GPS 내장', '7일 배터리'],
        in_stock: true,
        best_seller: true
      }
    ]
  };
}

// ============================================================
// Export (index.ts 연결용)
// ============================================================

export { ShoppingAgent as default };
