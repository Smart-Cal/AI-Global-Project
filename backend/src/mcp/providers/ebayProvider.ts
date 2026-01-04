/**
 * eBay Browse API Provider
 *
 * eBay Browse API를 통해 상품 검색 및 정보를 제공합니다.
 *
 * 필요한 설정:
 * - EBAY_APP_ID: eBay Application ID (Client ID)
 * - EBAY_CERT_ID: eBay Cert ID (Client Secret)
 *
 * 참고: https://developer.ebay.com/api-docs/buy/browse/overview.html
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
  EbayConfig,
  EbayMarketplace,
  convertToUSD
} from './types.js';

// eBay 마켓플레이스별 설정
const EBAY_ENDPOINTS: Record<EbayMarketplace, { globalId: string; currency: string }> = {
  'EBAY_US': { globalId: 'EBAY-US', currency: 'USD' },
  'EBAY_GB': { globalId: 'EBAY-GB', currency: 'GBP' },
  'EBAY_DE': { globalId: 'EBAY-DE', currency: 'EUR' },
  'EBAY_AU': { globalId: 'EBAY-AU', currency: 'AUD' }
};

// 지역별 마켓플레이스 매핑
const REGION_TO_MARKETPLACE: Record<ShoppingRegion, EbayMarketplace> = {
  global: 'EBAY_US',
  us: 'EBAY_US',
  eu: 'EBAY_DE',
  asia: 'EBAY_US',
  kr: 'EBAY_US',
  jp: 'EBAY_US',
  cn: 'EBAY_US'
};

export class EbayProvider implements ShoppingProvider {
  name: ProviderName = 'ebay';
  supportedRegions: ShoppingRegion[] = ['global', 'us', 'eu'];

  private appId: string;
  private certId: string;
  private marketplace: EbayMarketplace;
  private enabled: boolean;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config?: EbayConfig) {
    this.appId = config?.appId || process.env.EBAY_APP_ID || '';
    this.certId = config?.certId || process.env.EBAY_CERT_ID || '';
    this.marketplace = config?.marketplace || 'EBAY_US';
    this.enabled = config?.enabled !== false && !!(this.appId && this.certId);

    if (!this.enabled) {
      console.warn('[EbayProvider] API credentials not configured. Provider disabled.');
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
        error: 'eBay API credentials not configured'
      };
    }

    try {
      const token = await this.getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain access token');
      }

      const marketplace = options.region
        ? REGION_TO_MARKETPLACE[options.region]
        : this.marketplace;

      const params = this.buildSearchParams(options);
      const marketplaceInfo = EBAY_ENDPOINTS[marketplace];

      const response = await axios.get(
        'https://api.ebay.com/buy/browse/v1/item_summary/search',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': marketplaceInfo.globalId,
            'X-EBAY-C-ENDUSERCTX': 'affiliateCampaignId=<ePNCampaignId>,affiliateReferenceId=<referenceId>'
          },
          params,
          timeout: 10000
        }
      );

      const products = this.mapSearchResults(response.data);

      return {
        provider: this.name,
        success: true,
        products,
        totalResults: response.data.total,
        currentPage: Math.floor((response.data.offset || 0) / (options.limit || 10)) + 1,
        totalPages: Math.ceil((response.data.total || 0) / (options.limit || 10)),
        responseTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[EbayProvider] Search error:', error.message);

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
  async getProductDetails(itemId: string): Promise<ProductDetails | null> {
    if (!this.enabled) return null;

    try {
      const token = await this.getAccessToken();
      if (!token) return null;

      const response = await axios.get(
        `https://api.ebay.com/buy/browse/v1/item/${itemId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': EBAY_ENDPOINTS[this.marketplace].globalId
          },
          timeout: 10000
        }
      );

      return this.mapItemToProductDetails(response.data);
    } catch (error: any) {
      console.error('[EbayProvider] GetDetails error:', error.message);
      return null;
    }
  }

  // ====================================================
  // Private Methods
  // ====================================================

  /**
   * OAuth2 액세스 토큰 획득
   */
  private async getAccessToken(): Promise<string | null> {
    // 캐시된 토큰이 유효하면 재사용
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const credentials = Buffer.from(`${this.appId}:${this.certId}`).toString('base64');

      const response = await axios.post(
        'https://api.ebay.com/identity/v1/oauth2/token',
        'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 5000
        }
      );

      this.accessToken = response.data.access_token;
      // 토큰 만료 시간 (5분 여유)
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in - 300) * 1000);

      return this.accessToken;
    } catch (error: any) {
      console.error('[EbayProvider] Token error:', error.message);
      return null;
    }
  }

  private buildSearchParams(options: SearchOptions): Record<string, string> {
    const params: Record<string, string> = {
      q: options.query,
      limit: String(Math.min(options.limit || 10, 50))  // eBay 최대 50개
    };

    // 카테고리
    if (options.category) {
      params.category_ids = this.mapCategoryToId(options.category);
    }

    // 가격 필터
    const priceFilters: string[] = [];
    if (options.minPrice !== undefined) {
      priceFilters.push(`price:[${options.minPrice}..`);
    }
    if (options.maxPrice !== undefined) {
      if (priceFilters.length > 0) {
        priceFilters[0] = priceFilters[0].replace('..', `..${options.maxPrice}]`);
      } else {
        priceFilters.push(`price:[..${options.maxPrice}]`);
      }
    }
    if (priceFilters.length > 0) {
      params.filter = priceFilters.join(',');
    }

    // 정렬
    if (options.sort) {
      params.sort = this.mapSortOption(options.sort);
    }

    // 무료 배송 필터
    if (options.freeShippingOnly) {
      params.filter = (params.filter ? params.filter + ',' : '') + 'maxDeliveryCost:0';
    }

    return params;
  }

  private mapCategoryToId(category: string): string {
    // eBay 카테고리 ID 매핑 (주요 카테고리)
    const categoryMap: Record<string, string> = {
      '전자기기': '293',      // Consumer Electronics
      'electronics': '293',
      '패션': '11450',        // Clothing, Shoes & Accessories
      'fashion': '11450',
      '운동': '888',          // Sporting Goods
      'fitness': '888',
      '뷰티': '26395',        // Health & Beauty
      'beauty': '26395',
      '홈': '11700',          // Home & Garden
      'home': '11700',
      '장난감': '220',        // Toys & Hobbies
      'toys': '220'
    };

    return categoryMap[category.toLowerCase()] || '';
  }

  private mapSortOption(sort: string): string {
    const sortMap: Record<string, string> = {
      'relevance': 'bestMatch',
      'price_asc': 'price',
      'price_desc': '-price',
      'rating': 'bestMatch',  // eBay는 평점 정렬 미지원
      'newest': 'newlyListed'
    };

    return sortMap[sort] || 'bestMatch';
  }

  private mapSearchResults(data: any): ProductResult[] {
    const items = data.itemSummaries || [];

    return items.map((item: any) => this.mapItemToProduct(item));
  }

  private mapItemToProduct(item: any): ProductResult {
    const price = parseFloat(item.price?.value || '0');
    const currency = (item.price?.currency || 'USD') as any;

    return {
      id: `ebay-${item.itemId}`,
      providerId: item.itemId,
      provider: 'ebay',

      title: item.title || '',
      description: item.shortDescription,
      category: item.categories?.[0]?.categoryName,

      price,
      currency,
      priceInUSD: convertToUSD(price, currency),

      imageUrl: item.image?.imageUrl,
      thumbnailUrl: item.thumbnailImages?.[0]?.imageUrl || item.image?.imageUrl,

      productUrl: item.itemWebUrl,
      affiliateUrl: item.itemAffiliateWebUrl || item.itemWebUrl,

      rating: item.seller?.feedbackPercentage ? parseFloat(item.seller.feedbackPercentage) / 20 : undefined,
      reviewCount: item.seller?.feedbackScore,

      shippingInfo: {
        isFreeShipping: item.shippingOptions?.[0]?.shippingCostType === 'FREE',
        shippingCost: parseFloat(item.shippingOptions?.[0]?.shippingCost?.value || '0'),
        shipsFrom: item.itemLocation?.country
      },

      seller: {
        name: item.seller?.username || 'Unknown',
        rating: item.seller?.feedbackPercentage ? parseFloat(item.seller.feedbackPercentage) : undefined,
        isOfficial: item.seller?.topRatedSeller || false
      },

      badges: this.extractBadges(item),
      availability: item.buyingOptions?.includes('FIXED_PRICE') ? 'in_stock' : 'in_stock',

      fetchedAt: new Date().toISOString()
    };
  }

  private mapItemToProductDetails(item: any): ProductDetails {
    const baseProduct = this.mapItemToProduct(item);

    return {
      ...baseProduct,
      fullDescription: item.description,
      features: item.localizedAspects?.map((a: any) => `${a.name}: ${a.value}`) || [],
      specifications: this.extractSpecifications(item.localizedAspects),
      additionalImages: item.additionalImages?.map((img: any) => img.imageUrl) || []
    };
  }

  private extractBadges(item: any): string[] {
    const badges: string[] = [];

    if (item.seller?.topRatedSeller) badges.push('Top Rated');
    if (item.topRatedBuyingExperience) badges.push('Top Rated Plus');
    if (item.shippingOptions?.[0]?.shippingCostType === 'FREE') badges.push('Free Shipping');

    return badges;
  }

  private extractSpecifications(aspects: any[]): Record<string, string> {
    if (!aspects) return {};

    const specs: Record<string, string> = {};
    aspects.forEach((aspect: any) => {
      specs[aspect.name] = aspect.value;
    });

    return specs;
  }
}

// 팩토리 함수
export function createEbayProvider(config?: EbayConfig): EbayProvider {
  return new EbayProvider(config);
}
