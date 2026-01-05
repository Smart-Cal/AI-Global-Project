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

// Weather conditions by code
const WEATHER_CONDITIONS: Record<string, string> = {
  '01d': 'Sunny', '01n': 'Clear',
  '02d': 'Few Clouds', '02n': 'Few Clouds',
  '03d': 'Scattered Clouds', '03n': 'Scattered Clouds',
  '04d': 'Cloudy', '04n': 'Cloudy',
  '09d': 'Shower Rain', '09n': 'Shower Rain',
  '10d': 'Rain', '10n': 'Rain',
  '11d': 'Thunderstorm', '11n': 'Thunderstorm',
  '13d': 'Snow', '13n': 'Snow',
  '50d': 'Mist', '50n': 'Mist',
};

// Clothing recommendation based on weather
function getClothingRecommendation(temp: number, condition: string): string {
  const recommendations: string[] = [];

  // Temperature based
  if (temp <= 5) {
    recommendations.push('Wear a heavy coat or puffer jacket.');
  } else if (temp <= 10) {
    recommendations.push('Bring a coat or warm jacket.');
  } else if (temp <= 15) {
    recommendations.push('A jacket or cardigan is needed.');
  } else if (temp <= 20) {
    recommendations.push('Prepare a light outer layer.');
  } else if (temp <= 25) {
    recommendations.push('Light clothing is good.');
  } else {
    recommendations.push('Recommend cool clothing.');
  }

  // Condition based (Priority on Rain/Snow)
  if (condition.includes('Rain') || condition.includes('Shower') || condition.includes('Drizzle')) {
    recommendations.push('Don\'t forget your umbrella!');
  } else if (condition.includes('Snow')) {
    recommendations.push('Watch out for ice and dress warmly.');
  } else if (condition.includes('Mist') || condition.includes('Fog')) {
    recommendations.push('Visibility is low, be careful.');
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
 * Check specifically for rain or snow in the forecast for the rest of the day (or tomorrow)
 * @param city City name
 * @param date Target date (YYYY-MM-DD)
 */
export async function checkPrecipitationForecast(city: string, date: string): Promise<{ willRain: boolean; willSnow: boolean; time?: string } | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    // Mock random chance
    const willRain = Math.random() > 0.7;
    return { willRain, willSnow: false, time: willRain ? '15:00' : undefined };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json() as {
      list: Array<{
        dt_txt: string;
        weather: Array<{ main: string; description: string; id: number }>;
      }>;
    };

    // Filter for the specific date
    // Note: dt_txt is "YYYY-MM-DD HH:mm:ss" UTC usually, but simple comparison works for broad check
    const targetForecasts = data.list.filter(item => item.dt_txt.startsWith(date));

    // Check for precipitation codes
    // Rain: 5xx, Snow: 6xx, Drizzle: 3xx, Thunderstorm: 2xx
    for (const item of targetForecasts) {
      const weatherId = item.weather[0].id;
      const hours = item.dt_txt.split(' ')[1].substring(0, 5); // HH:mm

      if (weatherId >= 600 && weatherId < 700) {
        return { willRain: false, willSnow: true, time: hours };
      }
      if ((weatherId >= 200 && weatherId < 600) || (weatherId === 804)) { // 804 is overcast, but let's stick to rain codes for strictness -> 5xx, 3xx, 2xx
        if (weatherId >= 200 && weatherId < 600) {
          return { willRain: true, willSnow: false, time: hours };
        }
      }
    }

    return { willRain: false, willSnow: false };

  } catch (error) {
    console.error('Precipitation check error:', error);
    return null;
  }
}

/**
 * Check precipitation by coordinates
 */
export async function checkPrecipitationByCoords(lat: number, lon: number, date: string): Promise<{ willRain: boolean; willSnow: boolean; time?: string } | null> {
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    const willRain = Math.random() > 0.7;
    return { willRain, willSnow: false, time: willRain ? '15:00' : undefined };
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json() as {
      list: Array<{
        dt_txt: string;
        weather: Array<{ main: string; description: string; id: number }>;
      }>;
    };

    const targetForecasts = data.list.filter(item => item.dt_txt.startsWith(date));

    for (const item of targetForecasts) {
      const weatherId = item.weather[0].id;
      const hours = item.dt_txt.split(' ')[1].substring(0, 5);

      if (weatherId >= 600 && weatherId < 700) {
        return { willRain: false, willSnow: true, time: hours };
      }
      if (weatherId >= 200 && weatherId < 600) {
        return { willRain: true, willSnow: false, time: hours };
      }
    }

    return { willRain: false, willSnow: false };

  } catch (error) {
    console.error('Precipitation check error:', error);
    return null;
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
 * Activity recommendation based on weather
 */
export function getActivityRecommendation(weather: WeatherData): string[] {
  const activities: string[] = [];

  if (weather.condition.includes('Sunny') || weather.condition.includes('Clear') || weather.condition.includes('Few Clouds')) {
    if (weather.temperature >= 15 && weather.temperature <= 25) {
      activities.push('Great weather for outdoor exercise.');
      activities.push('Recommend walking or cycling.');
    } else if (weather.temperature >= 25) {
      activities.push('Swimming or water activities recommended.');
      activities.push('Stay hydrated during outdoor activities.');
    }
  }

  if (weather.condition.includes('Rain') || weather.condition.includes('Snow') || weather.condition.includes('Thunderstorm')) {
    activities.push('Recommend indoor activities.');
    activities.push('How about reading or watching a movie at home?');
  }

  if (weather.condition.includes('Cloudy')) {
    activities.push('Good for both indoor and outdoor activities.');
  }

  if (activities.length === 0) {
    activities.push('Have a great day!');
  }

  return activities;
}

// Mock 데이터 (API 키 없을 때 사용)
function getMockWeather(city: string): WeatherData {
  const temp = Math.floor(Math.random() * 20) + 5; // 5~25 degrees
  const conditions = ['Sunny', 'Few Clouds', 'Scattered Clouds', 'Cloudy', 'Rain'];
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
  const conditions = ['Sunny', 'Few Clouds', 'Scattered Clouds', 'Cloudy', 'Rain'];

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
