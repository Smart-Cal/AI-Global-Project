/**
 * Google Maps MCP Client
 *
 * Google Maps/Places API를 통해 장소 관련 기능을 수행합니다.
 * - 장소 검색 (맛집, 카페, 모임 장소)
 * - 장소 상세 정보 (평점, 리뷰, 영업시간)
 * - 거리/시간 계산
 * - 중간 지점 찾기
 */

import axios from 'axios';

export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;  // 0-4
  types: string[];
  openNow?: boolean;
  photoReference?: string;
  photoUrl?: string;     // 실제 사진 URL
  mapsUrl?: string;      // Google Maps 링크
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  formattedAddress: string;
  phone?: string;
  website?: string;
  location: {
    lat: number;
    lng: number;
  };
  rating?: number;
  userRatingsTotal?: number;
  priceLevel?: number;
  types: string[];
  openingHours?: {
    openNow: boolean;
    weekdayText: string[];
  };
  reviews?: Array<{
    authorName: string;
    rating: number;
    text: string;
    relativeTimeDescription: string;
  }>;
  photos?: string[];  // Photo URLs
}

export interface DistanceResult {
  origin: string;
  destination: string;
  distance: {
    text: string;    // "5.2 km"
    value: number;   // meters
  };
  duration: {
    text: string;    // "15분"
    value: number;   // seconds
  };
  mode: 'driving' | 'walking' | 'transit' | 'bicycling';
}

export interface MidpointResult {
  location: {
    lat: number;
    lng: number;
  };
  nearbyPlaces: PlaceSearchResult[];
  memberDistances: Array<{
    memberName: string;
    distance: DistanceResult;
  }>;
}

export class GoogleMapsMCP {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[GoogleMapsMCP] API key not set. Maps features will be limited.');
    }
  }

  // ====================================================
  // 장소 검색
  // ====================================================

  /**
   * 주변 장소 검색
   */
  async searchNearby(options: {
    location: { lat: number; lng: number } | string;  // 좌표 또는 주소
    radius?: number;        // 미터 (기본 1000m)
    type?: string;          // 예: 'restaurant', 'cafe', 'bar'
    keyword?: string;       // 검색 키워드
    minPrice?: number;      // 0-4
    maxPrice?: number;      // 0-4
    openNow?: boolean;
  }): Promise<PlaceSearchResult[]> {
    try {
      let lat: number, lng: number;

      // 주소인 경우 좌표로 변환
      if (typeof options.location === 'string') {
        const geocoded = await this.geocode(options.location);
        if (!geocoded) {
          throw new Error('Failed to geocode address');
        }
        lat = geocoded.lat;
        lng = geocoded.lng;
      } else {
        lat = options.location.lat;
        lng = options.location.lng;
      }

      const params: any = {
        location: `${lat},${lng}`,
        radius: options.radius || 1000,
        key: this.apiKey
      };

      if (options.type) params.type = options.type;
      if (options.keyword) params.keyword = options.keyword;
      if (options.minPrice !== undefined) params.minprice = options.minPrice;
      if (options.maxPrice !== undefined) params.maxprice = options.maxPrice;
      if (options.openNow) params.opennow = true;

      const response = await axios.get(`${this.baseUrl}/place/nearbysearch/json`, { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${response.data.status}`);
      }

      return (response.data.results || []).map(this.mapToPlaceSearchResult);
    } catch (error) {
      console.error('[GoogleMapsMCP] searchNearby error:', error);
      throw error;
    }
  }

  /**
   * 텍스트 기반 장소 검색
   */
  async searchText(options: {
    query: string;          // 검색어 (예: "홍대 맛집", "강남역 카페")
    location?: { lat: number; lng: number };
    radius?: number;
    type?: string;
    minPrice?: number;
    maxPrice?: number;
    openNow?: boolean;
  }): Promise<PlaceSearchResult[]> {
    try {
      const params: any = {
        query: options.query,
        key: this.apiKey,
        language: 'ko'
      };

      if (options.location) {
        params.location = `${options.location.lat},${options.location.lng}`;
        params.radius = options.radius || 5000;
      }

      if (options.type) params.type = options.type;
      if (options.minPrice !== undefined) params.minprice = options.minPrice;
      if (options.maxPrice !== undefined) params.maxprice = options.maxPrice;
      if (options.openNow) params.opennow = true;

      const response = await axios.get(`${this.baseUrl}/place/textsearch/json`, { params });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Places API error: ${response.data.status}`);
      }

      return (response.data.results || []).map(this.mapToPlaceSearchResult);
    } catch (error) {
      console.error('[GoogleMapsMCP] searchText error:', error);
      throw error;
    }
  }

  /**
   * 장소 상세 정보 조회
   */
  async getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          fields: 'place_id,name,formatted_address,formatted_phone_number,website,geometry,rating,user_ratings_total,price_level,types,opening_hours,reviews,photos',
          key: this.apiKey,
          language: 'ko'
        }
      });

      if (response.data.status !== 'OK') {
        return null;
      }

      const result = response.data.result;
      return {
        placeId: result.place_id,
        name: result.name,
        address: result.formatted_address,
        formattedAddress: result.formatted_address,
        phone: result.formatted_phone_number,
        website: result.website,
        location: {
          lat: result.geometry?.location?.lat,
          lng: result.geometry?.location?.lng
        },
        rating: result.rating,
        userRatingsTotal: result.user_ratings_total,
        priceLevel: result.price_level,
        types: result.types || [],
        openingHours: result.opening_hours ? {
          openNow: result.opening_hours.open_now,
          weekdayText: result.opening_hours.weekday_text || []
        } : undefined,
        reviews: result.reviews?.slice(0, 5).map((r: any) => ({
          authorName: r.author_name,
          rating: r.rating,
          text: r.text,
          relativeTimeDescription: r.relative_time_description
        })),
        photos: result.photos?.slice(0, 5).map((p: any) =>
          `${this.baseUrl}/place/photo?maxwidth=400&photo_reference=${p.photo_reference}&key=${this.apiKey}`
        )
      };
    } catch (error) {
      console.error('[GoogleMapsMCP] getPlaceDetails error:', error);
      return null;
    }
  }

  // ====================================================
  // 거리/시간 계산
  // ====================================================

  /**
   * 거리 및 소요 시간 계산
   */
  async getDistance(options: {
    origin: string | { lat: number; lng: number };
    destination: string | { lat: number; lng: number };
    mode?: 'driving' | 'walking' | 'transit' | 'bicycling';
  }): Promise<DistanceResult | null> {
    try {
      const originStr = typeof options.origin === 'string'
        ? options.origin
        : `${options.origin.lat},${options.origin.lng}`;

      const destStr = typeof options.destination === 'string'
        ? options.destination
        : `${options.destination.lat},${options.destination.lng}`;

      const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
        params: {
          origins: originStr,
          destinations: destStr,
          mode: options.mode || 'transit',
          key: this.apiKey,
          language: 'ko'
        }
      });

      if (response.data.status !== 'OK') {
        return null;
      }

      const element = response.data.rows[0]?.elements[0];
      if (element?.status !== 'OK') {
        return null;
      }

      return {
        origin: response.data.origin_addresses[0],
        destination: response.data.destination_addresses[0],
        distance: element.distance,
        duration: element.duration,
        mode: options.mode || 'transit'
      };
    } catch (error) {
      console.error('[GoogleMapsMCP] getDistance error:', error);
      return null;
    }
  }

  /**
   * 여러 멤버의 중간 지점 찾기
   */
  async findMidpoint(options: {
    members: Array<{
      name: string;
      location: string | { lat: number; lng: number };
    }>;
    placeType?: string;  // 중간 지점 주변 검색할 장소 유형
    radius?: number;
  }): Promise<MidpointResult | null> {
    try {
      // 모든 멤버의 좌표 수집
      const coordinates: Array<{ name: string; lat: number; lng: number }> = [];

      for (const member of options.members) {
        if (typeof member.location === 'string') {
          const geocoded = await this.geocode(member.location);
          if (geocoded) {
            coordinates.push({ name: member.name, ...geocoded });
          }
        } else {
          coordinates.push({ name: member.name, ...member.location });
        }
      }

      if (coordinates.length < 2) {
        return null;
      }

      // 중간 지점 계산 (단순 평균)
      const midpoint = {
        lat: coordinates.reduce((sum, c) => sum + c.lat, 0) / coordinates.length,
        lng: coordinates.reduce((sum, c) => sum + c.lng, 0) / coordinates.length
      };

      // 중간 지점 주변 장소 검색
      const nearbyPlaces = await this.searchNearby({
        location: midpoint,
        radius: options.radius || 1000,
        type: options.placeType || 'restaurant'
      });

      // 각 멤버의 이동 거리/시간 계산
      const memberDistances: MidpointResult['memberDistances'] = [];
      for (const coord of coordinates) {
        const distance = await this.getDistance({
          origin: { lat: coord.lat, lng: coord.lng },
          destination: midpoint
        });
        if (distance) {
          memberDistances.push({
            memberName: coord.name,
            distance
          });
        }
      }

      return {
        location: midpoint,
        nearbyPlaces: nearbyPlaces.slice(0, 5),
        memberDistances
      };
    } catch (error) {
      console.error('[GoogleMapsMCP] findMidpoint error:', error);
      return null;
    }
  }

  // ====================================================
  // 유틸리티
  // ====================================================

  /**
   * 주소 → 좌표 변환
   */
  async geocode(address: string): Promise<{ lat: number; lng: number } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address,
          key: this.apiKey,
          language: 'ko'
        }
      });

      if (response.data.status !== 'OK' || !response.data.results[0]) {
        return null;
      }

      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } catch (error) {
      console.error('[GoogleMapsMCP] geocode error:', error);
      return null;
    }
  }

  /**
   * 좌표 → 주소 변환
   */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${lat},${lng}`,
          key: this.apiKey,
          language: 'ko'
        }
      });

      if (response.data.status !== 'OK' || !response.data.results[0]) {
        return null;
      }

      return response.data.results[0].formatted_address;
    } catch (error) {
      console.error('[GoogleMapsMCP] reverseGeocode error:', error);
      return null;
    }
  }

  /**
   * Google Place Photo URL 생성
   */
  getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
    if (!photoReference || !this.apiKey) return '';
    return `${this.baseUrl}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${this.apiKey}`;
  }

  /**
   * Google Maps URL 생성 (장소 검색 링크)
   */
  getMapsUrl(placeId: string, name?: string): string {
    // Google Maps에서 장소를 직접 열 수 있는 URL
    return `https://www.google.com/maps/place/?q=place_id:${placeId}`;
  }

  private mapToPlaceSearchResult = (place: any): PlaceSearchResult => {
    const photoReference = place.photos?.[0]?.photo_reference;
    const placeId = place.place_id;

    return {
      placeId,
      name: place.name,
      address: place.vicinity || place.formatted_address,
      location: {
        lat: place.geometry?.location?.lat,
        lng: place.geometry?.location?.lng
      },
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      priceLevel: place.price_level,
      types: place.types || [],
      openNow: place.opening_hours?.open_now,
      photoReference,
      photoUrl: photoReference ? this.getPhotoUrl(photoReference) : undefined,
      mapsUrl: placeId ? this.getMapsUrl(placeId, place.name) : undefined
    };
  };

  /**
   * 맛집 추천 (간편 메서드)
   */
  async recommendRestaurants(options: {
    area: string;           // 지역명 (예: "홍대", "강남")
    cuisine?: string;       // 음식 종류 (예: "한식", "이탈리안")
    minRating?: number;     // 최소 평점
    priceLevel?: number;    // 가격대 (0-4)
    limit?: number;         // 결과 수
  }): Promise<PlaceSearchResult[]> {
    const query = options.cuisine
      ? `${options.area} ${options.cuisine} 맛집`
      : `${options.area} 맛집`;

    const results = await this.searchText({
      query,
      type: 'restaurant',
      minPrice: options.priceLevel,
      maxPrice: options.priceLevel
    });

    // 필터링 및 정렬
    let filtered = results;

    if (options.minRating) {
      filtered = filtered.filter(r => (r.rating || 0) >= options.minRating!);
    }

    // 평점과 리뷰 수로 정렬
    filtered.sort((a, b) => {
      const scoreA = (a.rating || 0) * Math.log10((a.userRatingsTotal || 1) + 1);
      const scoreB = (b.rating || 0) * Math.log10((b.userRatingsTotal || 1) + 1);
      return scoreB - scoreA;
    });

    return filtered.slice(0, options.limit || 5);
  }
}

// 싱글톤 인스턴스
let instance: GoogleMapsMCP | null = null;

export function getGoogleMapsMCP(): GoogleMapsMCP {
  if (!instance) {
    instance = new GoogleMapsMCP();
  }
  return instance;
}
