/**
 * SerpApi Google Shopping Provider
 *
 * SerpApi를 통해 Google Shopping 검색 결과를 제공합니다.
 *
 * 필요한 설정:
 * - SERPAPI_KEY: SerpApi API Key
 *
 * 장점:
 * - 즉시 발급 가능 (가입 후 바로 사용)
 * - 무료 티어: 월 100회 검색
 * - Google Shopping 실제 데이터
 *
 * 참고: https://serpapi.com/google-shopping-api
 */

import axios from 'axios';
import {
  ShoppingProvider,
  ProviderName,
  ShoppingRegion,
  SearchOptions,
  ProviderSearchResult,
  ProductResult,
  ProductDetails,
  Currency,
  convertToUSD
} from './types.js';

// SerpApi 설정 인터페이스
export interface SerpApiConfig {
  apiKey?: string;
  enabled?: boolean;
  defaultCountry?: string;  // gl 파라미터 (us, kr, jp 등)
  defaultLanguage?: string; // hl 파라미터 (en, ko, ja 등)
}

// 지역별 국가/언어 매핑
const REGION_TO_GL: Record<ShoppingRegion, { gl: string; hl: string; currency: Currency }> = {
  global: { gl: 'us', hl: 'en', currency: 'USD' },
  us: { gl: 'us', hl: 'en', currency: 'USD' },
  eu: { gl: 'de', hl: 'en', currency: 'EUR' },
  asia: { gl: 'jp', hl: 'en', currency: 'JPY' },
  kr: { gl: 'kr', hl: 'ko', currency: 'KRW' },
  jp: { gl: 'jp', hl: 'ja', currency: 'JPY' },
  cn: { gl: 'us', hl: 'en', currency: 'USD' }  // 중국은 Google 접근 제한으로 US 사용
};

// SerpApi 응답 타입
interface SerpApiShoppingResult {
  position: number;
  title: string;
  link?: string;
  product_link?: string;
  product_id?: string;
  serpapi_product_api?: string;
  source: string;
  price?: string;
  extracted_price?: number;
  old_price?: string;
  extracted_old_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  delivery?: string;
  tag?: string;
  extensions?: string[];
}

interface SerpApiResponse {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_shopping_url: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    gl: string;
    hl: string;
  };
  shopping_results?: SerpApiShoppingResult[];
  inline_shopping_results?: SerpApiShoppingResult[];
  error?: string;
}

export class SerpApiProvider implements ShoppingProvider {
  name: ProviderName = 'serpapi';
  displayName = 'Google Shopping';
  supportedRegions: ShoppingRegion[] = ['global', 'us', 'eu', 'asia', 'kr', 'jp'];

  private apiKey: string;
  private enabled: boolean;
  private defaultCountry: string;
  private defaultLanguage: string;

  constructor(config?: SerpApiConfig) {
    this.apiKey = config?.apiKey || process.env.SERPAPI_KEY || '';
    this.enabled = config?.enabled !== false && !!this.apiKey;
    this.defaultCountry = config?.defaultCountry || 'us';
    this.defaultLanguage = config?.defaultLanguage || 'en';

    if (!this.enabled) {
      console.warn('[SerpApiProvider] API key not configured. Provider disabled.');
    } else {
      console.log('[SerpApiProvider] Initialized with Google Shopping API');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 상품 검색
   */
  async searchProducts(options: SearchOptions): Promise<ProviderSearchResult> {
    const startTime = Date.now();

    if (!this.enabled) {
      return {
        provider: this.name,
        success: false,
        products: [],
        error: 'SerpApi key not configured'
      };
    }

    try {
      const regionConfig = options.region
        ? REGION_TO_GL[options.region]
        : REGION_TO_GL.global;

      // SerpApi 요청 파라미터
      const params: Record<string, string | number> = {
        engine: 'google_shopping',
        q: options.query,
        api_key: this.apiKey,
        gl: regionConfig.gl,
        hl: regionConfig.hl,
        num: Math.min(options.limit || 20, 100)  // 최대 100개
      };

      // 가격 필터
      if (options.minPrice !== undefined) {
        params.tbs = `mr:1,price:1,ppr_min:${options.minPrice}`;
      }
      if (options.maxPrice !== undefined) {
        const existingTbs = params.tbs as string || '';
        params.tbs = existingTbs
          ? `${existingTbs},ppr_max:${options.maxPrice}`
          : `mr:1,price:1,ppr_max:${options.maxPrice}`;
      }

      // 정렬
      if (options.sort === 'price_asc') {
        params.sort_by = 1;
      } else if (options.sort === 'price_desc') {
        params.sort_by = 2;
      }

      const response = await axios.get<SerpApiResponse>(
        'https://serpapi.com/search',
        {
          params,
          timeout: 15000
        }
      );

      if (response.data.error) {
        throw new Error(response.data.error);
      }

      // 결과 통합 (shopping_results + inline_shopping_results)
      const allResults = [
        ...(response.data.shopping_results || []),
        ...(response.data.inline_shopping_results || [])
      ];

      const products = this.mapSearchResults(allResults, regionConfig.currency);

      return {
        provider: this.name,
        success: true,
        products,
        totalResults: products.length,
        responseTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[SerpApiProvider] Search error:', error.message);

      return {
        provider: this.name,
        success: false,
        products: [],
        error: error.message,
        responseTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * 상품 상세 정보 (SerpApi Product API 사용)
   */
  async getProductDetails(productId: string): Promise<ProductDetails | null> {
    if (!this.enabled) return null;

    try {
      const response = await axios.get<any>(
        'https://serpapi.com/search',
        {
          params: {
            engine: 'google_product',
            product_id: productId,
            api_key: this.apiKey,
            gl: this.defaultCountry,
            hl: this.defaultLanguage
          },
          timeout: 15000
        }
      );

      if (!response.data.product_results) {
        return null;
      }

      const product = response.data.product_results;

      return {
        id: `serpapi-${productId}`,
        providerId: productId,
        provider: this.name,
        title: product.title || '',
        description: product.description,
        price: product.extracted_price || 0,
        currency: 'USD',
        priceInUSD: product.extracted_price || 0,
        imageUrl: product.media?.[0]?.link,
        thumbnailUrl: product.thumbnail,
        productUrl: product.link || '',
        rating: product.rating,
        reviewCount: product.reviews,
        fullDescription: product.description,
        features: product.extensions || [],
        specifications: product.specifications || {},
        fetchedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('[SerpApiProvider] GetDetails error:', error.message);
      return null;
    }
  }

  // ====================================================
  // Private Methods
  // ====================================================

  private mapSearchResults(
    results: SerpApiShoppingResult[],
    currency: Currency
  ): ProductResult[] {
    return results.map((item, index) => {
      const price = item.extracted_price || this.extractPrice(item.price);
      const originalPrice = item.extracted_old_price || this.extractPrice(item.old_price);

      // 할인율 계산
      let discountRate: number | undefined;
      if (originalPrice && price && originalPrice > price) {
        discountRate = Math.round((1 - price / originalPrice) * 100);
      }

      return {
        id: `serpapi-${item.product_id || index}`,
        providerId: item.product_id || String(index),
        provider: this.name,

        title: item.title || '',
        description: item.extensions?.join(', '),
        brand: this.extractBrand(item.title, item.source),
        category: undefined,

        price,
        originalPrice,
        discountRate,
        currency,
        priceInUSD: convertToUSD(price, currency),

        imageUrl: item.thumbnail,
        thumbnailUrl: item.thumbnail,

        productUrl: item.product_link || item.link || '',
        affiliateUrl: item.product_link || item.link,

        rating: item.rating,
        reviewCount: item.reviews,

        shippingInfo: {
          isFreeShipping: item.delivery?.toLowerCase().includes('free'),
          shipsFrom: item.source
        },

        seller: {
          name: item.source || 'Unknown',
          isOfficial: false
        },

        badges: this.extractBadges(item),
        availability: 'in_stock',

        fetchedAt: new Date().toISOString()
      };
    });
  }

  private extractPrice(priceStr?: string): number {
    if (!priceStr) return 0;

    // "$92.00", "₩45,000", "€50.00" 등에서 숫자 추출
    const cleaned = priceStr.replace(/[^0-9.,]/g, '').replace(',', '');
    return parseFloat(cleaned) || 0;
  }

  private extractBrand(title?: string, source?: string): string | undefined {
    if (!title) return source;

    // 일반적인 브랜드 패턴 (첫 단어가 브랜드인 경우가 많음)
    const words = title.split(' ');
    if (words.length > 0) {
      // 대문자로 시작하는 첫 단어를 브랜드로 추정
      const firstWord = words[0];
      if (firstWord && firstWord[0] === firstWord[0].toUpperCase()) {
        return firstWord;
      }
    }

    return source;
  }

  private extractBadges(item: SerpApiShoppingResult): string[] {
    const badges: string[] = [];

    if (item.tag) {
      badges.push(item.tag);
    }
    if (item.delivery?.toLowerCase().includes('free')) {
      badges.push('Free Shipping');
    }
    if (item.rating && item.rating >= 4.5) {
      badges.push('Top Rated');
    }
    if (item.extracted_old_price && item.extracted_price) {
      const discount = Math.round((1 - item.extracted_price / item.extracted_old_price) * 100);
      if (discount >= 20) {
        badges.push(`${discount}% OFF`);
      }
    }

    return badges;
  }
}

// 팩토리 함수
export function createSerpApiProvider(config?: SerpApiConfig): SerpApiProvider {
  return new SerpApiProvider(config);
}
