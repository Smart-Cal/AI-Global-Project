/**
 * Mock Shopping Provider
 *
 * API 키가 없거나 테스트 환경에서 사용하는 Mock 프로바이더
 * 개발 및 데모용으로 사용됩니다.
 */

import {
  ShoppingProvider,
  ProviderName,
  ShoppingRegion,
  SearchOptions,
  ProviderSearchResult,
  ProductResult,
  ProductDetails
} from './types.js';

export class MockProvider implements ShoppingProvider {
  name: ProviderName = 'mock';
  supportedRegions: ShoppingRegion[] = ['global', 'us', 'eu', 'asia', 'kr', 'jp', 'cn'];

  isEnabled(): boolean {
    return true;  // Mock은 항상 사용 가능
  }

  async searchProducts(options: SearchOptions): Promise<ProviderSearchResult> {
    const startTime = Date.now();

    // 검색어에 따른 Mock 데이터 생성
    const products = this.generateMockProducts(options);

    // 가격 필터링
    let filtered = products;
    if (options.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price >= options.minPrice!);
    }
    if (options.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price <= options.maxPrice!);
    }

    // 정렬
    if (options.sort) {
      filtered = this.sortProducts(filtered, options.sort);
    }

    // 페이지네이션
    const limit = options.limit || 10;
    const page = options.page || 1;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return {
      provider: this.name,
      success: true,
      products: paged,
      totalResults: filtered.length,
      currentPage: page,
      totalPages: Math.ceil(filtered.length / limit),
      responseTimeMs: Date.now() - startTime
    };
  }

  async getProductDetails(productId: string): Promise<ProductDetails | null> {
    // Mock 상세 정보 생성
    const baseProduct = this.generateMockProducts({ query: 'product', limit: 1 })[0];

    if (!baseProduct) return null;

    return {
      ...baseProduct,
      id: productId,
      fullDescription: `This is a detailed description for ${baseProduct.title}. High quality product with excellent features.`,
      features: [
        'Premium Quality Materials',
        'Fast Worldwide Shipping',
        '30-Day Money Back Guarantee',
        'Excellent Customer Support'
      ],
      specifications: {
        'Material': 'Premium',
        'Weight': '500g',
        'Dimensions': '10 x 10 x 5 cm',
        'Warranty': '1 Year'
      }
    };
  }

  // ====================================================
  // Mock 데이터 생성
  // ====================================================

  private generateMockProducts(options: SearchOptions): ProductResult[] {
    const query = options.query.toLowerCase();
    const category = this.detectCategory(query);

    const mockProducts: ProductResult[] = [];
    const productCount = 20;

    for (let i = 0; i < productCount; i++) {
      const basePrice = this.generatePrice(category);
      const hasDiscount = Math.random() > 0.6;
      const discountRate = hasDiscount ? Math.floor(Math.random() * 40) + 10 : undefined;
      const originalPrice = hasDiscount
        ? Math.round(basePrice / (1 - discountRate! / 100))
        : undefined;

      const providers: ProviderName[] = ['amazon', 'ebay', 'aliexpress'];
      const provider = providers[i % 3];

      mockProducts.push({
        id: `mock-${provider}-${i + 1}`,
        providerId: `${provider.toUpperCase()}-${Date.now()}-${i}`,
        provider: 'mock',

        title: this.generateTitle(query, category, i),
        description: `High quality ${query} product with excellent reviews`,
        brand: this.generateBrand(category, i),
        category,

        price: basePrice,
        originalPrice,
        discountRate,
        currency: 'USD',
        priceInUSD: basePrice,

        imageUrl: `https://via.placeholder.com/400x400?text=${encodeURIComponent(query)}`,
        thumbnailUrl: `https://via.placeholder.com/200x200?text=${encodeURIComponent(query)}`,

        productUrl: `https://example.com/product/${i}`,
        affiliateUrl: `https://example.com/product/${i}?ref=affiliate`,

        rating: this.generateRating(),
        reviewCount: Math.floor(Math.random() * 5000) + 50,

        shippingInfo: {
          isFreeShipping: Math.random() > 0.3,
          shippingCost: Math.random() > 0.3 ? 0 : Math.floor(Math.random() * 10) + 3,
          estimatedDays: Math.floor(Math.random() * 10) + 3,
          shipsFrom: ['US', 'CN', 'DE', 'JP'][Math.floor(Math.random() * 4)]
        },

        seller: {
          name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Seller ${i + 1}`,
          rating: Math.round((Math.random() * 1 + 4) * 10) / 10,
          isOfficial: Math.random() > 0.7
        },

        badges: this.generateBadges(hasDiscount),
        availability: 'in_stock',

        fetchedAt: new Date().toISOString()
      });
    }

    return mockProducts;
  }

  private detectCategory(query: string): string {
    const categoryKeywords: Record<string, string[]> = {
      'Electronics': ['phone', 'laptop', 'computer', 'headphone', 'earphone', 'tablet', 'camera', 'speaker', 'watch', 'smart'],
      'Fashion': ['shirt', 'pants', 'dress', 'shoes', 'jacket', 'bag', 'wallet', 'hat', 'sunglasses'],
      'Sports': ['running', 'yoga', 'fitness', 'gym', 'sports', 'exercise', 'dumbbell', 'mat'],
      'Beauty': ['makeup', 'skincare', 'cosmetic', 'perfume', 'lipstick', 'cream', 'serum'],
      'Home': ['kitchen', 'home', 'furniture', 'decor', 'lamp', 'bed', 'pillow', 'towel']
    };

    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => query.includes(kw))) {
        return category;
      }
    }

    return 'General';
  }

  private generateTitle(query: string, category: string, index: number): string {
    const adjectives = ['Premium', 'Professional', 'High-Quality', 'Best Selling', 'Top Rated', 'Popular'];
    const adjective = adjectives[index % adjectives.length];

    const variations = ['Pro', 'Plus', 'Max', 'Ultra', 'Classic', 'Essential'];
    const variation = variations[index % variations.length];

    return `${adjective} ${query.charAt(0).toUpperCase() + query.slice(1)} ${variation} - ${category} Edition`;
  }

  private generateBrand(category: string, index: number): string {
    const brands: Record<string, string[]> = {
      'Electronics': ['TechPro', 'DigiMax', 'SmartLife', 'ElectroBrand', 'TechGear'],
      'Fashion': ['StyleHub', 'FashionForward', 'TrendyWear', 'ClassicStyle', 'ModernFit'],
      'Sports': ['FitPro', 'SportMax', 'ActiveLife', 'GymGear', 'FlexFit'],
      'Beauty': ['GlowUp', 'BeautyPro', 'SkinFirst', 'PureLux', 'NaturalGlow'],
      'Home': ['HomeEssentials', 'LivingSpace', 'ComfortZone', 'DecorHub', 'HomeStyle']
    };

    const categoryBrands = brands[category] || brands['Electronics'];
    return categoryBrands[index % categoryBrands.length];
  }

  private generatePrice(category: string): number {
    const priceRanges: Record<string, { min: number; max: number }> = {
      'Electronics': { min: 20, max: 500 },
      'Fashion': { min: 15, max: 200 },
      'Sports': { min: 10, max: 150 },
      'Beauty': { min: 5, max: 100 },
      'Home': { min: 10, max: 300 },
      'General': { min: 10, max: 200 }
    };

    const range = priceRanges[category] || priceRanges['General'];
    return Math.round((Math.random() * (range.max - range.min) + range.min) * 100) / 100;
  }

  private generateRating(): number {
    // 3.5 ~ 5.0 사이의 평점 (대부분 4.0 이상)
    return Math.round((Math.random() * 1.5 + 3.5) * 10) / 10;
  }

  private generateBadges(hasDiscount: boolean): string[] {
    const badges: string[] = [];

    if (hasDiscount) badges.push('Sale');
    if (Math.random() > 0.7) badges.push('Best Seller');
    if (Math.random() > 0.8) badges.push('Free Shipping');
    if (Math.random() > 0.9) badges.push('Top Rated');

    return badges;
  }

  private sortProducts(products: ProductResult[], sort: string): ProductResult[] {
    const sorted = [...products];

    switch (sort) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'reviews':
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      default:
        return sorted;
    }
  }
}

// 팩토리 함수
export function createMockProvider(): MockProvider {
  return new MockProvider();
}
