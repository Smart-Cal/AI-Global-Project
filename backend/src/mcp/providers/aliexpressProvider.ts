/**
 * AliExpress Affiliate API Provider
 *
 * AliExpress Affiliate API를 통해 상품 검색 및 정보를 제공합니다.
 *
 * 필요한 설정:
 * - ALIEXPRESS_APP_KEY: AliExpress App Key
 * - ALIEXPRESS_APP_SECRET: AliExpress App Secret
 * - ALIEXPRESS_TRACKING_ID: Affiliate Tracking ID (선택)
 *
 * 참고: https://portals.aliexpress.com/help/help_center_API.html
 */

import axios from 'axios';
import crypto from 'crypto';
import {
  ShoppingProvider,
  ProviderName,
  ShoppingRegion,
  SearchOptions,
  ProviderSearchResult,
  ProductResult,
  ProductDetails,
  AliExpressConfig,
  convertToUSD
} from './types.js';

const ALIEXPRESS_API_URL = 'https://api-sg.aliexpress.com/sync';

export class AliExpressProvider implements ShoppingProvider {
  name: ProviderName = 'aliexpress';
  supportedRegions: ShoppingRegion[] = ['global', 'asia', 'cn'];

  private appKey: string;
  private appSecret: string;
  private trackingId: string;
  private enabled: boolean;

  constructor(config?: AliExpressConfig) {
    this.appKey = config?.appKey || process.env.ALIEXPRESS_APP_KEY || '';
    this.appSecret = config?.appSecret || process.env.ALIEXPRESS_APP_SECRET || '';
    this.trackingId = config?.trackingId || process.env.ALIEXPRESS_TRACKING_ID || '';
    this.enabled = config?.enabled !== false && !!(this.appKey && this.appSecret);

    if (!this.enabled) {
      console.warn('[AliExpressProvider] API credentials not configured. Provider disabled.');
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
        error: 'AliExpress API credentials not configured'
      };
    }

    try {
      const params = this.buildSearchParams(options);
      const signedParams = this.signRequest('aliexpress.affiliate.product.query', params);

      const response = await axios.get(ALIEXPRESS_API_URL, {
        params: signedParams,
        timeout: 15000  // AliExpress는 응답이 느릴 수 있음
      });

      // API 에러 체크
      if (response.data.error_response) {
        throw new Error(response.data.error_response.msg || 'AliExpress API error');
      }

      const result = response.data.aliexpress_affiliate_product_query_response?.resp_result;
      if (!result || result.resp_code !== 200) {
        throw new Error(result?.resp_msg || 'Invalid response');
      }

      const products = this.mapSearchResults(result.result);

      return {
        provider: this.name,
        success: true,
        products,
        totalResults: result.result?.total_record_count,
        currentPage: result.result?.current_page_no,
        totalPages: Math.ceil((result.result?.total_record_count || 0) / (options.limit || 20)),
        responseTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[AliExpressProvider] Search error:', error.message);

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
   * 상품 상세 정보
   */
  async getProductDetails(productId: string): Promise<ProductDetails | null> {
    if (!this.enabled) return null;

    try {
      const params = {
        product_ids: productId,
        fields: 'commission_rate,sale_price,original_price,product_title,product_main_image_url,product_small_image_urls,evaluate_rate,lastest_volume,discount,ship_to_days'
      };

      const signedParams = this.signRequest('aliexpress.affiliate.productdetail.get', params);

      const response = await axios.get(ALIEXPRESS_API_URL, {
        params: signedParams,
        timeout: 10000
      });

      const result = response.data.aliexpress_affiliate_productdetail_get_response?.resp_result?.result;
      if (!result?.products?.product?.[0]) return null;

      return this.mapItemToProductDetails(result.products.product[0]);
    } catch (error: any) {
      console.error('[AliExpressProvider] GetDetails error:', error.message);
      return null;
    }
  }

  // ====================================================
  // Private Methods
  // ====================================================

  private buildSearchParams(options: SearchOptions): Record<string, string> {
    const params: Record<string, string> = {
      keywords: options.query,
      page_no: String(options.page || 1),
      page_size: String(Math.min(options.limit || 20, 50)),  // 최대 50개
      target_currency: options.currency || 'USD',
      target_language: this.mapLanguage(options.language),
      ship_to_country: this.mapRegionToCountry(options.region)
    };

    // 가격 필터
    if (options.minPrice !== undefined) {
      params.min_sale_price = String(options.minPrice);
    }
    if (options.maxPrice !== undefined) {
      params.max_sale_price = String(options.maxPrice);
    }

    // 카테고리
    if (options.category) {
      params.category_ids = this.mapCategoryToId(options.category);
    }

    // 정렬
    if (options.sort) {
      params.sort = this.mapSortOption(options.sort);
    }

    // 트래킹 ID
    if (this.trackingId) {
      params.tracking_id = this.trackingId;
    }

    return params;
  }

  private mapLanguage(lang?: string): string {
    const langMap: Record<string, string> = {
      'en': 'EN',
      'ko': 'KO',
      'ja': 'JA',
      'zh': 'ZH'
    };
    return langMap[lang || 'en'] || 'EN';
  }

  private mapRegionToCountry(region?: ShoppingRegion): string {
    const countryMap: Record<ShoppingRegion, string> = {
      global: 'US',
      us: 'US',
      eu: 'DE',
      asia: 'KR',
      kr: 'KR',
      jp: 'JP',
      cn: 'CN'
    };
    return countryMap[region || 'global'];
  }

  private mapCategoryToId(category: string): string {
    // AliExpress 카테고리 ID 매핑 (주요 카테고리)
    const categoryMap: Record<string, string> = {
      '전자기기': '44',       // Consumer Electronics
      'electronics': '44',
      '패션': '200000853',    // Women's Clothing
      'fashion': '200000853',
      '운동': '200000532',    // Sports & Entertainment
      'fitness': '200000532',
      '뷰티': '66',           // Beauty & Health
      'beauty': '66',
      '홈': '15',             // Home & Garden
      'home': '15',
      '장난감': '26',         // Toys & Hobbies
      'toys': '26'
    };

    return categoryMap[category.toLowerCase()] || '';
  }

  private mapSortOption(sort: string): string {
    const sortMap: Record<string, string> = {
      'relevance': 'SALE_PRICE_ASC',  // AliExpress 기본 정렬 없음
      'price_asc': 'SALE_PRICE_ASC',
      'price_desc': 'SALE_PRICE_DESC',
      'rating': 'LAST_VOLUME_DESC',   // 판매량 기준
      'reviews': 'LAST_VOLUME_DESC',
      'newest': 'LAST_VOLUME_DESC'
    };

    return sortMap[sort] || 'SALE_PRICE_ASC';
  }

  private mapSearchResults(data: any): ProductResult[] {
    const products = data?.products?.product || [];

    return products.map((item: any) => this.mapItemToProduct(item));
  }

  private mapItemToProduct(item: any): ProductResult {
    const salePrice = parseFloat(item.target_sale_price || item.sale_price || '0');
    const originalPrice = parseFloat(item.target_original_price || item.original_price || '0');
    const currency = (item.target_sale_price_currency || 'USD') as any;

    const discountRate = originalPrice > 0
      ? Math.round((1 - salePrice / originalPrice) * 100)
      : undefined;

    return {
      id: `aliexpress-${item.product_id}`,
      providerId: item.product_id,
      provider: 'aliexpress',

      title: item.product_title || '',
      description: item.product_title,
      category: item.first_level_category_name || item.second_level_category_name,

      price: salePrice,
      originalPrice: originalPrice > salePrice ? originalPrice : undefined,
      discountRate,
      currency,
      priceInUSD: convertToUSD(salePrice, currency),

      imageUrl: item.product_main_image_url,
      thumbnailUrl: item.product_main_image_url,
      additionalImages: item.product_small_image_urls?.string || [],

      productUrl: item.product_detail_url,
      affiliateUrl: item.promotion_link,

      rating: item.evaluate_rate ? parseFloat(item.evaluate_rate) / 20 : undefined,  // 100점 만점 → 5점 만점
      reviewCount: item.lastest_volume,

      shippingInfo: {
        isFreeShipping: item.freeship_icon === 'true',
        estimatedDays: item.ship_to_days ? parseInt(item.ship_to_days) : undefined
      },

      seller: {
        name: item.shop_id || 'AliExpress Seller',
        isOfficial: false
      },

      badges: this.extractBadges(item),
      availability: 'in_stock',

      fetchedAt: new Date().toISOString()
    };
  }

  private mapItemToProductDetails(item: any): ProductDetails {
    const baseProduct = this.mapItemToProduct(item);

    return {
      ...baseProduct,
      fullDescription: item.product_title,
      additionalImages: item.product_small_image_urls?.string || []
    };
  }

  private extractBadges(item: any): string[] {
    const badges: string[] = [];

    if (item.freeship_icon === 'true') badges.push('Free Shipping');
    if (parseFloat(item.discount || '0') > 0) badges.push('Sale');
    if (item.lastest_volume > 1000) badges.push('Best Seller');

    return badges;
  }

  /**
   * AliExpress API 서명 생성
   */
  private signRequest(method: string, params: Record<string, string>): Record<string, string> {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 14);

    const allParams: Record<string, string> = {
      app_key: this.appKey,
      method,
      sign_method: 'md5',
      timestamp,
      v: '2.0',
      ...params
    };

    // 파라미터 정렬
    const sortedKeys = Object.keys(allParams).sort();
    let signStr = this.appSecret;

    sortedKeys.forEach(key => {
      signStr += key + allParams[key];
    });
    signStr += this.appSecret;

    // MD5 해시
    const sign = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

    return {
      ...allParams,
      sign
    };
  }
}

// 팩토리 함수
export function createAliExpressProvider(config?: AliExpressConfig): AliExpressProvider {
  return new AliExpressProvider(config);
}
