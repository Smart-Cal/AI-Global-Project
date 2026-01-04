/**
 * Shopping Provider Types
 *
 * 멀티 프로바이더 쇼핑 시스템의 공통 타입 정의
 */

// ============================================================
// 지역 및 통화
// ============================================================

export type ShoppingRegion = 'global' | 'us' | 'eu' | 'asia' | 'kr' | 'jp' | 'cn';

export type Currency = 'USD' | 'EUR' | 'KRW' | 'JPY' | 'CNY' | 'GBP';

export const REGION_CURRENCY: Record<ShoppingRegion, Currency> = {
  global: 'USD',
  us: 'USD',
  eu: 'EUR',
  asia: 'USD',
  kr: 'KRW',
  jp: 'JPY',
  cn: 'CNY'
};

// ============================================================
// 프로바이더 인터페이스
// ============================================================

export type ProviderName = 'amazon' | 'ebay' | 'aliexpress' | 'rakuten' | 'naver' | 'serpapi' | 'mock';

export interface ShoppingProvider {
  /** 프로바이더 이름 */
  name: ProviderName;

  /** 지원 지역 */
  supportedRegions: ShoppingRegion[];

  /** 프로바이더 활성화 여부 */
  isEnabled(): boolean;

  /** 상품 검색 */
  searchProducts(options: SearchOptions): Promise<ProviderSearchResult>;

  /** 상품 상세 정보 (선택적) */
  getProductDetails?(productId: string): Promise<ProductDetails | null>;

  /** 가격 비교 (선택적) */
  comparePrices?(query: string): Promise<PriceComparison | null>;
}

// ============================================================
// 검색 옵션
// ============================================================

export interface SearchOptions {
  query: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: Currency;
  region?: ShoppingRegion;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'reviews' | 'newest';
  limit?: number;
  page?: number;

  // 필터
  minRating?: number;
  freeShippingOnly?: boolean;
  primeOnly?: boolean;        // Amazon Prime
  fastShipping?: boolean;     // 빠른 배송

  // 언어
  language?: 'en' | 'ko' | 'ja' | 'zh';
}

// ============================================================
// 상품 결과
// ============================================================

export interface ProductResult {
  id: string;
  providerId: string;         // 프로바이더 내 고유 ID
  provider: ProviderName;

  // 기본 정보
  title: string;
  description?: string;
  brand?: string;
  category?: string;

  // 가격 (USD 기준으로 정규화)
  price: number;
  originalPrice?: number;
  discountRate?: number;
  currency: Currency;
  priceInUSD?: number;        // USD 환산 가격

  // 이미지
  imageUrl?: string;
  thumbnailUrl?: string;
  additionalImages?: string[];

  // 링크
  productUrl: string;
  affiliateUrl?: string;

  // 평점
  rating?: number;            // 1.0 ~ 5.0
  reviewCount?: number;

  // 배송
  shippingInfo?: {
    isFreeShipping?: boolean;
    shippingCost?: number;
    estimatedDays?: number;
    shipsFrom?: string;
    shipsTo?: string[];
  };

  // 판매자
  seller?: {
    name: string;
    rating?: number;
    isOfficial?: boolean;
  };

  // 프로바이더별 특성
  badges?: string[];          // 'Prime', 'Best Seller', 'Choice' 등
  availability?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'preorder';

  // 메타데이터
  fetchedAt: string;          // ISO datetime
}

export interface ProviderSearchResult {
  provider: ProviderName;
  success: boolean;
  products: ProductResult[];
  totalResults?: number;
  currentPage?: number;
  totalPages?: number;
  error?: string;
  responseTimeMs?: number;
}

// ============================================================
// 상품 상세
// ============================================================

export interface ProductDetails extends ProductResult {
  // 상세 정보
  fullDescription?: string;
  specifications?: Record<string, string>;
  features?: string[];

  // 리뷰
  reviews?: ProductReview[];
  ratingBreakdown?: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };

  // 관련 상품
  relatedProducts?: ProductResult[];

  // 변형 (색상, 사이즈 등)
  variants?: ProductVariant[];
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  title?: string;
  content: string;
  date: string;
  verified?: boolean;
  helpful?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  price?: number;
  available?: boolean;
  imageUrl?: string;
}

// ============================================================
// 가격 비교
// ============================================================

export interface PriceComparison {
  query: string;
  productName?: string;
  prices: PriceEntry[];
  lowestPrice: PriceEntry;
  highestPrice: PriceEntry;
  averagePrice: number;
  fetchedAt: string;
}

export interface PriceEntry {
  provider: ProviderName;
  price: number;
  currency: Currency;
  priceInUSD: number;
  productUrl: string;
  seller?: string;
  shippingCost?: number;
  totalPrice?: number;        // 배송비 포함
}

// ============================================================
// 프로바이더 설정
// ============================================================

export interface ProviderConfig {
  enabled: boolean;
  priority?: number;          // 우선순위 (낮을수록 높은 우선순위)
}

export interface AmazonConfig extends ProviderConfig {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
  marketplace?: AmazonMarketplace;
}

export type AmazonMarketplace =
  | 'www.amazon.com'      // US
  | 'www.amazon.co.uk'    // UK
  | 'www.amazon.de'       // Germany
  | 'www.amazon.fr'       // France
  | 'www.amazon.co.jp'    // Japan
  | 'www.amazon.com.au';  // Australia

export interface EbayConfig extends ProviderConfig {
  appId: string;
  certId: string;
  devId?: string;
  marketplace?: EbayMarketplace;
}

export type EbayMarketplace = 'EBAY_US' | 'EBAY_GB' | 'EBAY_DE' | 'EBAY_AU';

export interface AliExpressConfig extends ProviderConfig {
  appKey: string;
  appSecret: string;
  trackingId?: string;
}

export interface RakutenConfig extends ProviderConfig {
  applicationId: string;
  affiliateId?: string;
}

export interface NaverConfig extends ProviderConfig {
  clientId: string;
  clientSecret: string;
}

export interface ShoppingProvidersConfig {
  defaultRegion?: ShoppingRegion;
  defaultCurrency?: Currency;
  amazon?: AmazonConfig;
  ebay?: EbayConfig;
  aliexpress?: AliExpressConfig;
  rakuten?: RakutenConfig;
  naver?: NaverConfig;

  // Mock 데이터 사용 (개발/테스트용)
  useMockWhenUnavailable?: boolean;
}

// ============================================================
// 통합 검색 결과
// ============================================================

export interface AggregatedSearchResult {
  query: string;
  options: SearchOptions;

  // 모든 프로바이더 결과 통합
  products: ProductResult[];

  // 프로바이더별 결과
  providerResults: ProviderSearchResult[];

  // 통계
  stats: {
    totalProducts: number;
    successfulProviders: ProviderName[];
    failedProviders: ProviderName[];
    avgResponseTimeMs: number;
    priceRange: {
      min: number;
      max: number;
      avg: number;
      currency: Currency;
    };
  };

  fetchedAt: string;
}

// ============================================================
// 환율 (간단한 고정 환율 - 실제로는 API 사용 권장)
// ============================================================

export const EXCHANGE_RATES_TO_USD: Record<Currency, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
  KRW: 0.00075,
  JPY: 0.0067,
  CNY: 0.14
};

export function convertToUSD(amount: number, currency: Currency): number {
  return amount * EXCHANGE_RATES_TO_USD[currency];
}

export function convertFromUSD(amountUSD: number, targetCurrency: Currency): number {
  return amountUSD / EXCHANGE_RATES_TO_USD[targetCurrency];
}
