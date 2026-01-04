/**
 * Weather API Service
 * OpenWeatherMap API를 사용하여 날씨 정보 제공
 */

export interface WeatherData {
  temperature: number;          // 섭씨 온도
  feels_like: number;           // 체감 온도
  condition: string;            // 날씨 상태 (맑음, 흐림, 비 등)
  condition_code: string;       // 날씨 코드 (01d, 02d 등)
  icon: string;                 // 아이콘 URL
  humidity: number;             // 습도 (%)
  wind_speed: number;           // 풍속 (m/s)
  description: string;          // 상세 설명
  recommendation: string;       // 옷차림/활동 추천
}

export interface ForecastData {
  date: string;                 // YYYY-MM-DD
  temperature_min: number;
  temperature_max: number;
  condition: string;
  icon: string;
}

// 날씨 코드별 한글 상태
const WEATHER_CONDITIONS: Record<string, string> = {
  '01d': '맑음', '01n': '맑음',
  '02d': '구름 조금', '02n': '구름 조금',
  '03d': '구름 많음', '03n': '구름 많음',
  '04d': '흐림', '04n': '흐림',
  '09d': '소나기', '09n': '소나기',
  '10d': '비', '10n': '비',
  '11d': '뇌우', '11n': '뇌우',
  '13d': '눈', '13n': '눈',
  '50d': '안개', '50n': '안개',
};

// 날씨별 옷차림 추천
function getClothingRecommendation(temp: number, condition: string): string {
  const recommendations: string[] = [];

  // 온도 기반 추천
  if (temp <= 5) {
    recommendations.push('패딩이나 두꺼운 코트를 입으세요');
  } else if (temp <= 10) {
    recommendations.push('코트나 두꺼운 자켓을 챙기세요');
  } else if (temp <= 15) {
    recommendations.push('자켓이나 가디건이 필요해요');
  } else if (temp <= 20) {
    recommendations.push('얇은 겉옷을 준비하세요');
  } else if (temp <= 25) {
    recommendations.push('가벼운 옷차림이 좋아요');
  } else {
    recommendations.push('시원한 옷차림을 추천해요');
  }

  // 날씨 상태 기반 추천
  if (condition.includes('비') || condition.includes('소나기')) {
    recommendations.push('우산을 꼭 챙기세요!');
  } else if (condition.includes('눈')) {
    recommendations.push('미끄럼 주의, 따뜻하게 입으세요');
  } else if (condition.includes('안개')) {
    recommendations.push('시야가 좁으니 주의하세요');
  }

  return recommendations.join(' ');
}

/**
 * 현재 날씨 조회
 * @param city 도시명 (영문, 예: "Seoul", "Tokyo")
 */
export async function getCurrentWeather(city: string): Promise<WeatherData | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('OPENWEATHER_API_KEY not set, using mock data');
    return getMockWeather(city);
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return getMockWeather(city);
    }

    const data = await response.json() as {
      weather: Array<{ icon: string; main: string; description: string }>;
      main: { temp: number; feels_like: number; humidity: number };
      wind: { speed: number };
    };
    const conditionCode = data.weather[0].icon;
    const condition = WEATHER_CONDITIONS[conditionCode] || data.weather[0].main;

    return {
      temperature: Math.round(data.main.temp),
      feels_like: Math.round(data.main.feels_like),
      condition,
      condition_code: conditionCode,
      icon: `https://openweathermap.org/img/wn/${conditionCode}@2x.png`,
      humidity: data.main.humidity,
      wind_speed: data.wind.speed,
      description: data.weather[0].description,
      recommendation: getClothingRecommendation(data.main.temp, condition)
    };
  } catch (error) {
    console.error('Weather API fetch error:', error);
    return getMockWeather(city);
  }
}

/**
 * 좌표로 현재 날씨 조회
 * @param lat 위도
 * @param lon 경도
 */
export async function getWeatherByCoords(lat: number, lon: number): Promise<{ weather: WeatherData; city: string } | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('OPENWEATHER_API_KEY not set, using mock data');
    return { weather: getMockWeather('Unknown'), city: 'Unknown' };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric&lang=kr`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather API error: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      weather: Array<{ icon: string; main: string; description: string }>;
      main: { temp: number; feels_like: number; humidity: number };
      wind: { speed: number };
      name: string;
    };
    const conditionCode = data.weather[0].icon;
    const condition = WEATHER_CONDITIONS[conditionCode] || data.weather[0].main;

    return {
      weather: {
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        condition,
        condition_code: conditionCode,
        icon: `https://openweathermap.org/img/wn/${conditionCode}@2x.png`,
        humidity: data.main.humidity,
        wind_speed: data.wind.speed,
        description: data.weather[0].description,
        recommendation: getClothingRecommendation(data.main.temp, condition)
      },
      city: data.name
    };
  } catch (error) {
    console.error('Weather API fetch error:', error);
    return null;
  }
}

/**
 * 좌표로 도시명 조회 (역지오코딩)
 * @param lat 위도
 * @param lon 경도
 */
export async function getCityFromCoords(lat: number, lon: number): Promise<string | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as Array<{ name: string; local_names?: { ko?: string } }>;
    if (data.length === 0) return null;

    // 한글 이름 우선, 없으면 영문 이름
    return data[0].local_names?.ko || data[0].name;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
}

/**
 * 5일 날씨 예보 조회
 * @param city 도시명
 */
export async function getWeatherForecast(city: string, days: number = 5): Promise<ForecastData[]> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    console.warn('OPENWEATHER_API_KEY not set, using mock data');
    return getMockForecast(days);
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=kr`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Weather forecast API error: ${response.status}`);
      return getMockForecast(days);
    }

    const data = await response.json() as {
      list: Array<{
        dt_txt: string;
        main: { temp: number };
        weather: Array<{ main: string; icon: string }>;
      }>;
    };

    // 날짜별로 그룹화
    const dailyData: Map<string, { temps: number[]; conditions: string[]; icons: string[] }> = new Map();

    for (const item of data.list) {
      const date = item.dt_txt.split(' ')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { temps: [], conditions: [], icons: [] });
      }
      const dayData = dailyData.get(date)!;
      dayData.temps.push(item.main.temp);
      dayData.conditions.push(item.weather[0].main);
      dayData.icons.push(item.weather[0].icon);
    }

    const forecast: ForecastData[] = [];
    let count = 0;

    for (const [date, dayData] of dailyData) {
      if (count >= days) break;

      // 가장 많이 나온 아이콘 선택
      const iconCounts = dayData.icons.reduce((acc, icon) => {
        acc[icon] = (acc[icon] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const mainIcon = Object.entries(iconCounts).sort((a, b) => b[1] - a[1])[0][0];

      forecast.push({
        date,
        temperature_min: Math.round(Math.min(...dayData.temps)),
        temperature_max: Math.round(Math.max(...dayData.temps)),
        condition: WEATHER_CONDITIONS[mainIcon] || dayData.conditions[0],
        icon: `https://openweathermap.org/img/wn/${mainIcon}@2x.png`
      });
      count++;
    }

    return forecast;
  } catch (error) {
    console.error('Weather forecast fetch error:', error);
    return getMockForecast(days);
  }
}

/**
 * 특정 날짜의 날씨 조회
 */
export async function getWeatherForDate(city: string, date: string): Promise<WeatherData | null> {
  const forecast = await getWeatherForecast(city, 5);
  const dayForecast = forecast.find(f => f.date === date);

  if (!dayForecast) {
    // 예보 범위를 벗어나면 현재 날씨 반환
    return getCurrentWeather(city);
  }

  const avgTemp = Math.round((dayForecast.temperature_min + dayForecast.temperature_max) / 2);

  return {
    temperature: avgTemp,
    feels_like: avgTemp,
    condition: dayForecast.condition,
    condition_code: '',
    icon: dayForecast.icon,
    humidity: 50, // 예보에서는 습도 정보 제한적
    wind_speed: 0,
    description: dayForecast.condition,
    recommendation: getClothingRecommendation(avgTemp, dayForecast.condition)
  };
}

/**
 * 날씨 기반 활동 추천
 */
export function getActivityRecommendation(weather: WeatherData): string[] {
  const activities: string[] = [];

  if (weather.condition.includes('맑음') || weather.condition.includes('구름 조금')) {
    if (weather.temperature >= 15 && weather.temperature <= 25) {
      activities.push('야외 운동하기 좋은 날씨예요');
      activities.push('산책이나 자전거 타기 추천');
    } else if (weather.temperature >= 25) {
      activities.push('수영이나 물놀이 추천');
      activities.push('야외 활동 시 충분히 수분 섭취하세요');
    }
  }

  if (weather.condition.includes('비') || weather.condition.includes('눈')) {
    activities.push('실내 활동을 추천해요');
    activities.push('집에서 독서나 영화 감상은 어떨까요');
  }

  if (weather.condition.includes('흐림')) {
    activities.push('실내외 활동 모두 가능해요');
  }

  if (activities.length === 0) {
    activities.push('오늘도 좋은 하루 보내세요!');
  }

  return activities;
}

// Mock 데이터 (API 키 없을 때 사용)
function getMockWeather(city: string): WeatherData {
  const temp = Math.floor(Math.random() * 20) + 5; // 5~25도
  const conditions = ['맑음', '구름 조금', '구름 많음', '흐림'];
  const condition = conditions[Math.floor(Math.random() * conditions.length)];

  return {
    temperature: temp,
    feels_like: temp - 2,
    condition,
    condition_code: '01d',
    icon: 'https://openweathermap.org/img/wn/01d@2x.png',
    humidity: 50,
    wind_speed: 3,
    description: condition,
    recommendation: getClothingRecommendation(temp, condition)
  };
}

function getMockForecast(days: number): ForecastData[] {
  const forecast: ForecastData[] = [];
  const conditions = ['맑음', '구름 조금', '구름 많음', '흐림', '비'];

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const tempMin = Math.floor(Math.random() * 10) + 5;
    const tempMax = tempMin + Math.floor(Math.random() * 10) + 5;

    forecast.push({
      date: date.toISOString().split('T')[0],
      temperature_min: tempMin,
      temperature_max: tempMax,
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      icon: 'https://openweathermap.org/img/wn/01d@2x.png'
    });
  }

  return forecast;
}
