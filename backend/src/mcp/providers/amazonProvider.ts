/**
 * Amazon Product Advertising API 5.0 Provider
 *
 * Amazon PA-API를 통해 상품 검색 및 정보를 제공합니다.
 *
 * 필요한 설정:
 * - AMAZON_ACCESS_KEY: AWS Access Key
 * - AMAZON_SECRET_KEY: AWS Secret Key
 * - AMAZON_PARTNER_TAG: Amazon Associates Partner Tag
 *
 * 참고: https://webservices.amazon.com/paapi5/documentation/
 */

import crypto from 'crypto';
import axios from 'axios';
import {
  ShoppingProvider,
  ProviderName,
  ShoppingRegion,
  SearchOptions,
  ProviderSearchResult,
  ProductResult,
  ProductDetails,
  AmazonConfig,
  AmazonMarketplace,
  convertToUSD
} from './types.js';

// Amazon 마켓플레이스별 엔드포인트
const AMAZON_ENDPOINTS: Record<AmazonMarketplace, { host: string; region: string }> = {
  'www.amazon.com': { host: 'webservices.amazon.com', region: 'us-east-1' },
  'www.amazon.co.uk': { host: 'webservices.amazon.co.uk', region: 'eu-west-1' },
  'www.amazon.de': { host: 'webservices.amazon.de', region: 'eu-west-1' },
  'www.amazon.fr': { host: 'webservices.amazon.fr', region: 'eu-west-1' },
  'www.amazon.co.jp': { host: 'webservices.amazon.co.jp', region: 'us-west-2' },
  'www.amazon.com.au': { host: 'webservices.amazon.com.au', region: 'us-west-2' }
};

// 지역별 마켓플레이스 매핑
const REGION_TO_MARKETPLACE: Record<ShoppingRegion, AmazonMarketplace> = {
  global: 'www.amazon.com',
  us: 'www.amazon.com',
  eu: 'www.amazon.de',
  asia: 'www.amazon.co.jp',
  kr: 'www.amazon.com',  // 한국은 US 마켓 사용
  jp: 'www.amazon.co.jp',
  cn: 'www.amazon.com'   // 중국은 US 마켓 사용 (amazon.cn 별도)
};

export class AmazonProvider implements ShoppingProvider {
  name: ProviderName = 'amazon';
  supportedRegions: ShoppingRegion[] = ['global', 'us', 'eu', 'asia', 'jp'];

  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private marketplace: AmazonMarketplace;
  private enabled: boolean;

  constructor(config?: AmazonConfig) {
    this.accessKey = config?.accessKey || process.env.AMAZON_ACCESS_KEY || '';
    this.secretKey = config?.secretKey || process.env.AMAZON_SECRET_KEY || '';
    this.partnerTag = config?.partnerTag || process.env.AMAZON_PARTNER_TAG || '';
    this.marketplace = config?.marketplace || 'www.amazon.com';
    this.enabled = config?.enabled !== false && !!(this.accessKey && this.secretKey && this.partnerTag);

    if (!this.enabled) {
      console.warn('[AmazonProvider] API credentials not configured. Provider disabled.');
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
        error: 'Amazon API credentials not configured'
      };
    }

    try {
      // 지역에 따른 마켓플레이스 선택
      const marketplace = options.region
        ? REGION_TO_MARKETPLACE[options.region]
        : this.marketplace;

      const endpoint = AMAZON_ENDPOINTS[marketplace];

      const payload = this.buildSearchPayload(options);
      const headers = await this.signRequest('SearchItems', payload, endpoint);

      const response = await axios.post(
        `https://${endpoint.host}/paapi5/searchitems`,
        payload,
        {
          headers,
          timeout: 10000
        }
      );

      const products = this.mapSearchResults(response.data, marketplace);

      return {
        provider: this.name,
        success: true,
        products,
        totalResults: response.data.SearchResult?.TotalResultCount,
        responseTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      console.error('[AmazonProvider] Search error:', error.message);

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
  async getProductDetails(asin: string): Promise<ProductDetails | null> {
    if (!this.enabled) return null;

    try {
      const endpoint = AMAZON_ENDPOINTS[this.marketplace];

      const payload = {
        ItemIds: [asin],
        Resources: [
          'Images.Primary.Large',
          'Images.Variants.Large',
          'ItemInfo.Title',
          'ItemInfo.Features',
          'ItemInfo.ProductInfo',
          'ItemInfo.ByLineInfo',
          'ItemInfo.TechnicalInfo',
          'Offers.Listings.Price',
          'Offers.Listings.DeliveryInfo.IsPrimeEligible',
          'CustomerReviews.Count',
          'CustomerReviews.StarRating',
          'BrowseNodeInfo.BrowseNodes'
        ],
        PartnerTag: this.partnerTag,
        PartnerType: 'Associates',
        Marketplace: this.marketplace
      };

      const headers = await this.signRequest('GetItems', payload, endpoint);

      const response = await axios.post(
        `https://${endpoint.host}/paapi5/getitems`,
        payload,
        { headers, timeout: 10000 }
      );

      const item = response.data.ItemsResult?.Items?.[0];
      if (!item) return null;

      return this.mapItemToProductDetails(item);
    } catch (error: any) {
      console.error('[AmazonProvider] GetDetails error:', error.message);
      return null;
    }
  }

  // ====================================================
  // Private Methods
  // ====================================================

  private buildSearchPayload(options: SearchOptions): any {
    const payload: any = {
      Keywords: options.query,
      Resources: [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'ItemInfo.ByLineInfo',
        'Offers.Listings.Price',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'Offers.Listings.Availability.Type',
        'CustomerReviews.Count',
        'CustomerReviews.StarRating'
      ],
      ItemCount: Math.min(options.limit || 10, 10),  // PA-API 최대 10개
      PartnerTag: this.partnerTag,
      PartnerType: 'Associates',
      Marketplace: this.marketplace
    };

    // 카테고리 매핑 (SearchIndex)
    if (options.category) {
      payload.SearchIndex = this.mapCategoryToSearchIndex(options.category);
    }

    // 가격 필터
    if (options.minPrice !== undefined || options.maxPrice !== undefined) {
      payload.MinPrice = options.minPrice ? Math.round(options.minPrice * 100) : undefined;
      payload.MaxPrice = options.maxPrice ? Math.round(options.maxPrice * 100) : undefined;
    }

    // 정렬
    if (options.sort) {
      payload.SortBy = this.mapSortOption(options.sort);
    }

    return payload;
  }

  private mapCategoryToSearchIndex(category: string): string {
    const categoryMap: Record<string, string> = {
      '전자기기': 'Electronics',
      'electronics': 'Electronics',
      '운동': 'SportingGoods',
      'fitness': 'SportingGoods',
      '패션': 'Fashion',
      'fashion': 'Fashion',
      '뷰티': 'Beauty',
      'beauty': 'Beauty',
      '홈': 'HomeAndKitchen',
      'home': 'HomeAndKitchen',
      '책': 'Books',
      'books': 'Books',
      '장난감': 'Toys',
      'toys': 'Toys'
    };

    return categoryMap[category.toLowerCase()] || 'All';
  }

  private mapSortOption(sort: string): string {
    const sortMap: Record<string, string> = {
      'relevance': 'Relevance',
      'price_asc': 'Price:LowToHigh',
      'price_desc': 'Price:HighToLow',
      'rating': 'AvgCustomerReviews',
      'reviews': 'AvgCustomerReviews',
      'newest': 'NewestArrivals'
    };

    return sortMap[sort] || 'Relevance';
  }

  private mapSearchResults(data: any, marketplace: AmazonMarketplace): ProductResult[] {
    const items = data.SearchResult?.Items || [];

    return items.map((item: any) => this.mapItemToProduct(item, marketplace));
  }

  private mapItemToProduct(item: any, marketplace: AmazonMarketplace): ProductResult {
    const listing = item.Offers?.Listings?.[0];
    const price = listing?.Price?.Amount || 0;
    const currency = listing?.Price?.Currency || 'USD';

    return {
      id: `amazon-${item.ASIN}`,
      providerId: item.ASIN,
      provider: 'amazon',

      title: item.ItemInfo?.Title?.DisplayValue || '',
      brand: item.ItemInfo?.ByLineInfo?.Brand?.DisplayValue,
      category: item.BrowseNodeInfo?.BrowseNodes?.[0]?.DisplayName,

      price,
      currency: currency as any,
      priceInUSD: convertToUSD(price, currency as any),

      imageUrl: item.Images?.Primary?.Large?.URL || item.Images?.Primary?.Medium?.URL,
      thumbnailUrl: item.Images?.Primary?.Medium?.URL,

      productUrl: item.DetailPageURL,
      affiliateUrl: item.DetailPageURL,  // PA-API URL은 이미 어필리에이트 포함

      rating: item.CustomerReviews?.StarRating?.Value,
      reviewCount: item.CustomerReviews?.Count,

      shippingInfo: {
        isFreeShipping: listing?.DeliveryInfo?.IsPrimeEligible || false
      },

      badges: listing?.DeliveryInfo?.IsPrimeEligible ? ['Prime'] : [],
      availability: this.mapAvailability(listing?.Availability?.Type),

      fetchedAt: new Date().toISOString()
    };
  }

  private mapItemToProductDetails(item: any): ProductDetails {
    const baseProduct = this.mapItemToProduct(item, this.marketplace);

    return {
      ...baseProduct,
      fullDescription: item.ItemInfo?.Features?.DisplayValues?.join('\n'),
      features: item.ItemInfo?.Features?.DisplayValues || [],
      specifications: this.extractSpecifications(item.ItemInfo?.TechnicalInfo),
      additionalImages: item.Images?.Variants?.map((v: any) => v.Large?.URL).filter(Boolean)
    };
  }

  private mapAvailability(type: string): ProductResult['availability'] {
    switch (type) {
      case 'Now': return 'in_stock';
      case 'OutOfStock': return 'out_of_stock';
      case 'PreOrder': return 'preorder';
      default: return 'in_stock';
    }
  }

  private extractSpecifications(techInfo: any): Record<string, string> {
    if (!techInfo) return {};

    const specs: Record<string, string> = {};
    if (techInfo.Color?.DisplayValue) specs['Color'] = techInfo.Color.DisplayValue;
    if (techInfo.Size?.DisplayValue) specs['Size'] = techInfo.Size.DisplayValue;

    return specs;
  }

  /**
   * AWS Signature Version 4 서명
   */
  private async signRequest(
    operation: string,
    payload: any,
    endpoint: { host: string; region: string }
  ): Promise<Record<string, string>> {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const service = 'ProductAdvertisingAPI';
    const host = endpoint.host;
    const region = endpoint.region;

    const canonicalUri = '/paapi5/' + operation.toLowerCase();
    const canonicalQuerystring = '';

    const payloadString = JSON.stringify(payload);
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    const headers: Record<string, string> = {
      'content-encoding': 'amz-1.0',
      'content-type': 'application/json; charset=utf-8',
      'host': host,
      'x-amz-date': amzDate,
      'x-amz-target': `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`
    };

    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers)
      .sort()
      .map(key => `${key}:${headers[key]}`)
      .join('\n') + '\n';

    const canonicalRequest = [
      'POST',
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const algorithm = 'AWS4-HMAC-SHA256';
    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      algorithm,
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    // 서명 키 계산
    const getSignatureKey = (key: string, dateStamp: string, region: string, service: string) => {
      const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
      const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
      return kSigning;
    };

    const signingKey = getSignatureKey(this.secretKey, dateStamp, region, service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorizationHeader = `${algorithm} Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      ...headers,
      'Authorization': authorizationHeader
    };
  }
}

// 팩토리 함수
export function createAmazonProvider(config?: AmazonConfig): AmazonProvider {
  return new AmazonProvider(config);
}
