/**
 * Shopping Multi-Provider Orchestrator
 *
 * 여러 쇼핑 API를 통합하여 상품 검색 및 추천을 제공합니다.
 *
 * 지원 프로바이더:
 * - SerpApi (Google Shopping) - 추천! 빠른 발급
 * - Amazon Product Advertising API
 * - eBay Browse API
 * - AliExpress Affiliate API
 * - Mock Provider (개발/테스트용)
 *
 * 특징:
 * - 멀티 프로바이더 병렬 검색
 * - 결과 통합 및 정규화
 * - 가격 비교 (USD 환산)
 * - Fallback 처리 (API 실패 시 다른 프로바이더 사용)
 */

import {
  ShoppingProvider,
  ProviderName,
  ShoppingRegion,
  SearchOptions,
  ProviderSearchResult,
  ProductResult,
  ProductDetails,
  PriceComparison,
  PriceEntry,
  AggregatedSearchResult,
  ShoppingProvidersConfig,
  convertToUSD
} from './providers/types.js';

import { AmazonProvider } from './providers/amazonProvider.js';
import { EbayProvider } from './providers/ebayProvider.js';
import { AliExpressProvider } from './providers/aliexpressProvider.js';
import { SerpApiProvider } from './providers/serpApiProvider.js';
import { MockProvider } from './providers/mockProvider.js';

export class ShoppingMultiProvider {
  private providers: Map<ProviderName, ShoppingProvider> = new Map();
  private config: ShoppingProvidersConfig;

  constructor(config?: ShoppingProvidersConfig) {
    this.config = config || {};

    // 프로바이더 초기화
    this.initializeProviders();

    console.log('[ShoppingMultiProvider] Initialized with providers:',
      Array.from(this.providers.keys()).filter(name => this.providers.get(name)?.isEnabled())
    );
  }

  /**
   * 프로바이더 초기화
   */
  private initializeProviders(): void {
    // SerpApi (Google Shopping) - 가장 빠른 발급, 우선 사용
    const serpApiKey = process.env.SERPAPI_KEY;
    if (serpApiKey) {
      this.providers.set('serpapi', new SerpApiProvider({ apiKey: serpApiKey }));
    }

    // Amazon
    if (this.config.amazon?.enabled !== false) {
      this.providers.set('amazon', new AmazonProvider(this.config.amazon));
    }

    // eBay
    if (this.config.ebay?.enabled !== false) {
      this.providers.set('ebay', new EbayProvider(this.config.ebay));
    }

    // AliExpress
    if (this.config.aliexpress?.enabled !== false) {
      this.providers.set('aliexpress', new AliExpressProvider(this.config.aliexpress));
    }

    // Mock (항상 추가, fallback용)
    this.providers.set('mock', new MockProvider());
  }

  /**
   * 활성화된 프로바이더 목록
   */
  getEnabledProviders(): ProviderName[] {
    return Array.from(this.providers.entries())
      .filter(([name, provider]) => provider.isEnabled() && name !== 'mock')
      .map(([name]) => name);
  }

  /**
   * 멀티 프로바이더 상품 검색
   *
   * 여러 프로바이더에서 동시에 검색하고 결과를 통합합니다.
   */
  async searchProducts(options: SearchOptions): Promise<AggregatedSearchResult> {
    const startTime = Date.now();

    // 사용할 프로바이더 결정
    const enabledProviders = this.getEnabledProviders();

    // 활성화된 프로바이더가 없으면 Mock 사용
    const providersToUse = enabledProviders.length > 0
      ? enabledProviders
      : (this.config.useMockWhenUnavailable !== false ? ['mock' as ProviderName] : []);

    if (providersToUse.length === 0) {
      return this.createEmptyResult(options);
    }

    // 병렬 검색
    const searchPromises = providersToUse.map(name =>
      this.searchWithProvider(name, options)
    );

    const results = await Promise.all(searchPromises);

    // 결과 통합
    return this.aggregateResults(options, results, startTime);
  }

  /**
   * 특정 프로바이더로 검색
   */
  async searchWithProvider(
    providerName: ProviderName,
    options: SearchOptions
  ): Promise<ProviderSearchResult> {
    const provider = this.providers.get(providerName);

    if (!provider || !provider.isEnabled()) {
      return {
        provider: providerName,
        success: false,
        products: [],
        error: 'Provider not available'
      };
    }

    try {
      return await provider.searchProducts(options);
    } catch (error: any) {
      console.error(`[ShoppingMultiProvider] ${providerName} search error:`, error.message);
      return {
        provider: providerName,
        success: false,
        products: [],
        error: error.message
      };
    }
  }

  /**
   * 상품 상세 정보
   */
  async getProductDetails(
    productId: string,
    providerName?: ProviderName
  ): Promise<ProductDetails | null> {
    // 프로바이더 자동 감지
    if (!providerName) {
      const match = productId.match(/^(amazon|ebay|aliexpress|mock)-/);
      providerName = (match?.[1] as ProviderName) || 'mock';
    }

    const provider = this.providers.get(providerName);
    if (!provider || !provider.isEnabled() || !provider.getProductDetails) {
      return null;
    }

    // 프로바이더별 ID 추출
    const providerId = productId.replace(/^(amazon|ebay|aliexpress|mock)-/, '');

    try {
      return await provider.getProductDetails(providerId);
    } catch (error: any) {
      console.error(`[ShoppingMultiProvider] getProductDetails error:`, error.message);
      return null;
    }
  }

  /**
   * 가격 비교
   *
   * 여러 프로바이더에서 동일/유사 상품의 가격을 비교합니다.
   */
  async comparePrices(query: string): Promise<PriceComparison | null> {
    const results = await this.searchProducts({
      query,
      limit: 5
    });

    if (results.products.length === 0) {
      return null;
    }

    const prices: PriceEntry[] = results.products.map(product => ({
      provider: product.provider,
      price: product.price,
      currency: product.currency,
      priceInUSD: product.priceInUSD || convertToUSD(product.price, product.currency),
      productUrl: product.productUrl,
      seller: product.seller?.name,
      shippingCost: product.shippingInfo?.shippingCost,
      totalPrice: product.price + (product.shippingInfo?.shippingCost || 0)
    }));

    // USD 기준 정렬
    prices.sort((a, b) => a.priceInUSD - b.priceInUSD);

    const pricesInUSD = prices.map(p => p.priceInUSD);

    return {
      query,
      productName: results.products[0]?.title,
      prices,
      lowestPrice: prices[0],
      highestPrice: prices[prices.length - 1],
      averagePrice: pricesInUSD.reduce((a, b) => a + b, 0) / pricesInUSD.length,
      fetchedAt: new Date().toISOString()
    };
  }

  /**
   * 목표 기반 상품 추천
   *
   * 사용자의 목표에 맞는 상품을 여러 프로바이더에서 검색합니다.
   */
  async getGoalBasedRecommendations(options: {
    goalType: 'exercise' | 'study' | 'diet' | 'hobby' | 'travel' | 'other';
    goalDescription: string;
    budget?: number;
    region?: ShoppingRegion;
  }): Promise<AggregatedSearchResult> {
    const searchQueries = this.getGoalSearchQueries(options.goalType, options.goalDescription);

    // 각 쿼리로 검색
    const allProducts: ProductResult[] = [];

    for (const query of searchQueries.slice(0, 3)) {
      const results = await this.searchProducts({
        query,
        maxPrice: options.budget,
        region: options.region,
        limit: 5
      });
      allProducts.push(...results.products);
    }

    // 중복 제거 및 정렬
    const uniqueProducts = this.deduplicateProducts(allProducts);
    const sortedProducts = this.sortByRelevance(uniqueProducts, options.goalDescription);

    return {
      query: options.goalDescription,
      options: { query: options.goalDescription },
      products: sortedProducts.slice(0, 10),
      providerResults: [],
      stats: {
        totalProducts: sortedProducts.length,
        successfulProviders: this.getEnabledProviders(),
        failedProviders: [],
        avgResponseTimeMs: 0,
        priceRange: this.calculatePriceRange(sortedProducts)
      },
      fetchedAt: new Date().toISOString()
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
    region?: ShoppingRegion;
  }): Promise<AggregatedSearchResult> {
    const giftQueries = this.getGiftSearchQueries(options.recipient, options.occasion);

    const allProducts: ProductResult[] = [];

    for (const query of giftQueries.slice(0, 3)) {
      const results = await this.searchProducts({
        query,
        minPrice: options.minPrice,
        maxPrice: options.maxPrice,
        region: options.region,
        limit: 5
      });
      allProducts.push(...results.products);
    }

    const uniqueProducts = this.deduplicateProducts(allProducts);

    return {
      query: `${options.occasion} gift for ${options.recipient}`,
      options: { query: giftQueries[0] },
      products: uniqueProducts.slice(0, 10),
      providerResults: [],
      stats: {
        totalProducts: uniqueProducts.length,
        successfulProviders: this.getEnabledProviders(),
        failedProviders: [],
        avgResponseTimeMs: 0,
        priceRange: this.calculatePriceRange(uniqueProducts)
      },
      fetchedAt: new Date().toISOString()
    };
  }

  // ====================================================
  // Private Helper Methods
  // ====================================================

  private aggregateResults(
    options: SearchOptions,
    results: ProviderSearchResult[],
    startTime: number
  ): AggregatedSearchResult {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    // 모든 상품 통합
    let allProducts: ProductResult[] = [];
    for (const result of successfulResults) {
      allProducts.push(...result.products);
    }

    // 중복 제거
    allProducts = this.deduplicateProducts(allProducts);

    // 정렬
    if (options.sort) {
      allProducts = this.sortProducts(allProducts, options.sort);
    }

    // 통계 계산
    const responseTimeMs = Date.now() - startTime;
    const avgResponseTime = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + (r.responseTimeMs || 0), 0) / successfulResults.length
      : 0;

    return {
      query: options.query,
      options,
      products: allProducts,
      providerResults: results,
      stats: {
        totalProducts: allProducts.length,
        successfulProviders: successfulResults.map(r => r.provider),
        failedProviders: failedResults.map(r => r.provider),
        avgResponseTimeMs: Math.round(avgResponseTime),
        priceRange: this.calculatePriceRange(allProducts)
      },
      fetchedAt: new Date().toISOString()
    };
  }

  private deduplicateProducts(products: ProductResult[]): ProductResult[] {
    const seen = new Map<string, ProductResult>();

    for (const product of products) {
      // 제목 유사도로 중복 판단 (간단한 구현)
      const key = product.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30);

      if (!seen.has(key)) {
        seen.set(key, product);
      } else {
        // 더 좋은 상품으로 교체 (평점 높거나 가격 낮은 것)
        const existing = seen.get(key)!;
        if ((product.rating || 0) > (existing.rating || 0) ||
          (product.priceInUSD || product.price) < (existing.priceInUSD || existing.price)) {
          seen.set(key, product);
        }
      }
    }

    return Array.from(seen.values());
  }

  private sortProducts(products: ProductResult[], sort: string): ProductResult[] {
    const sorted = [...products];

    switch (sort) {
      case 'price_asc':
        return sorted.sort((a, b) =>
          (a.priceInUSD || a.price) - (b.priceInUSD || b.price)
        );
      case 'price_desc':
        return sorted.sort((a, b) =>
          (b.priceInUSD || b.price) - (a.priceInUSD || a.price)
        );
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'reviews':
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      default:
        // relevance: 평점 * log(리뷰수) 기준
        return sorted.sort((a, b) => {
          const scoreA = (a.rating || 0) * Math.log10((a.reviewCount || 1) + 1);
          const scoreB = (b.rating || 0) * Math.log10((b.reviewCount || 1) + 1);
          return scoreB - scoreA;
        });
    }
  }

  private sortByRelevance(products: ProductResult[], description: string): ProductResult[] {
    const keywords = description.toLowerCase().split(/\s+/);

    return products.sort((a, b) => {
      const titleA = a.title.toLowerCase();
      const titleB = b.title.toLowerCase();

      const matchA = keywords.filter(kw => titleA.includes(kw)).length;
      const matchB = keywords.filter(kw => titleB.includes(kw)).length;

      if (matchA !== matchB) return matchB - matchA;

      // 동점일 경우 평점으로
      return (b.rating || 0) - (a.rating || 0);
    });
  }

  private calculatePriceRange(products: ProductResult[]): {
    min: number;
    max: number;
    avg: number;
    currency: 'USD';
  } {
    if (products.length === 0) {
      return { min: 0, max: 0, avg: 0, currency: 'USD' };
    }

    const prices = products.map(p => p.priceInUSD || p.price);

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length * 100) / 100,
      currency: 'USD'
    };
  }

  private createEmptyResult(options: SearchOptions): AggregatedSearchResult {
    return {
      query: options.query,
      options,
      products: [],
      providerResults: [],
      stats: {
        totalProducts: 0,
        successfulProviders: [],
        failedProviders: [],
        avgResponseTimeMs: 0,
        priceRange: { min: 0, max: 0, avg: 0, currency: 'USD' }
      },
      fetchedAt: new Date().toISOString()
    };
  }

  private getGoalSearchQueries(goalType: string, description: string): string[] {
    const queries: Record<string, string[]> = {
      exercise: [
        'fitness equipment',
        'yoga mat exercise',
        'resistance bands workout',
        'running shoes',
        'protein shaker'
      ],
      study: [
        'study planner notebook',
        'LED desk lamp',
        'noise cancelling headphones',
        'laptop stand ergonomic',
        'timer focus'
      ],
      diet: [
        'food scale digital',
        'meal prep containers',
        'water bottle tracker',
        'blender smoothie',
        'portion control plates'
      ],
      hobby: [
        description + ' beginner kit',
        description + ' starter set',
        description + ' equipment'
      ],
      travel: [
        'travel luggage carry on',
        'packing cubes organizer',
        'portable charger',
        'travel pillow',
        'toiletry bag'
      ],
      other: [
        description
      ]
    };

    return queries[goalType] || queries.other;
  }

  private getGiftSearchQueries(recipient: string, occasion: string): string[] {
    const queries: Record<string, Record<string, string[]>> = {
      birthday: {
        male: ['mens wallet leather', 'bluetooth headphones', 'watch minimalist', 'gadgets for men'],
        female: ['jewelry set', 'skincare gift set', 'perfume women', 'handbag designer'],
        child: ['lego set', 'educational toys', 'kids tablet', 'board games family'],
        parent: ['massage device', 'health monitor', 'smart home device', 'gift basket'],
        friend: ['portable speaker', 'gift card holder', 'snack box premium', 'photo frame']
      },
      anniversary: {
        male: ['couple watch', 'engraved gift', 'experience gift'],
        female: ['jewelry necklace', 'roses preserved', 'spa gift set'],
        friend: ['wine gift set', 'premium chocolate box'],
        parent: ['photo album custom', 'family portrait frame']
      },
      holiday: {
        male: ['winter accessories', 'tech gadgets'],
        female: ['cozy blanket', 'beauty gift set'],
        child: ['toys 2024', 'kids games'],
        parent: ['home decor', 'kitchen gadgets'],
        friend: ['holiday gift basket', 'candle set']
      },
      graduation: {
        male: ['professional bag', 'pen set premium'],
        female: ['jewelry graduation', 'planner professional'],
        friend: ['inspirational book', 'desk accessories']
      },
      other: {
        male: ['gift for him'],
        female: ['gift for her'],
        child: ['gift for kids'],
        parent: ['gift for parents'],
        friend: ['gift ideas']
      }
    };

    const occasionGifts = queries[occasion] || queries.other;
    return occasionGifts[recipient] || occasionGifts.friend || ['gift'];
  }
}

// 싱글톤 인스턴스
let instance: ShoppingMultiProvider | null = null;

export function getShoppingMultiProvider(config?: ShoppingProvidersConfig): ShoppingMultiProvider {
  if (!instance) {
    instance = new ShoppingMultiProvider(config);
  }
  return instance;
}

export function resetShoppingMultiProvider(): void {
  instance = null;
}
