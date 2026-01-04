/**
 * Google Calendar MCP Client
 *
 * Google Calendar API를 통해 실제 캘린더 조작을 수행합니다.
 * - 일정 생성/수정/삭제
 * - Free/Busy 조회 (그룹 일정 매칭의 핵심)
 * - 일정 검색
 */

import { google, calendar_v3 } from 'googleapis';

// Google OAuth2 클라이언트 타입
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;  // ISO 8601
    date?: string;      // YYYY-MM-DD (종일 일정)
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{ email: string; displayName?: string }>;
  reminders?: {
    useDefault: boolean;
    overrides?: Array<{ method: string; minutes: number }>;
  };
}

export interface FreeBusyResult {
  calendars: {
    [email: string]: {
      busy: Array<{
        start: string;
        end: string;
      }>;
      errors?: Array<{ domain: string; reason: string }>;
    };
  };
  timeMin: string;
  timeMax: string;
}

export interface AvailableSlot {
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  allAvailable: boolean;
  unavailableMembers?: string[];
}

export class GoogleCalendarMCP {
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;
  private timeZone: string = 'Asia/Seoul';

  constructor(credentials?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }) {
    // OAuth2 클라이언트 초기화
    this.oauth2Client = new google.auth.OAuth2(
      credentials?.clientId || process.env.GOOGLE_CLIENT_ID,
      credentials?.clientSecret || process.env.GOOGLE_CLIENT_SECRET,
      credentials?.redirectUri || process.env.GOOGLE_REDIRECT_URI
    );

    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * 사용자 토큰 설정
   */
  setCredentials(tokens: {
    access_token: string;
    refresh_token?: string;
    expiry_date?: number;
  }) {
    this.oauth2Client.setCredentials(tokens);
  }

  /**
   * OAuth URL 생성 (사용자 인증용)
   */
  getAuthUrl(scopes: string[] = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ]): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  /**
   * 인증 코드로 토큰 교환
   */
  async getTokenFromCode(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // ====================================================
  // 일정 조회
  // ====================================================

  /**
   * 일정 목록 조회
   */
  async listEvents(options: {
    calendarId?: string;
    timeMin?: string;
    timeMax?: string;
    maxResults?: number;
    singleEvents?: boolean;
    orderBy?: 'startTime' | 'updated';
  } = {}): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: options.calendarId || 'primary',
        timeMin: options.timeMin || new Date().toISOString(),
        timeMax: options.timeMax,
        maxResults: options.maxResults || 50,
        singleEvents: options.singleEvents ?? true,
        orderBy: options.orderBy || 'startTime'
      });

      return (response.data.items || []).map(event => this.mapToCalendarEvent(event));
    } catch (error) {
      console.error('[GoogleCalendarMCP] listEvents error:', error);
      throw error;
    }
  }

  /**
   * 특정 일정 조회
   */
  async getEvent(eventId: string, calendarId: string = 'primary'): Promise<CalendarEvent | null> {
    try {
      const response = await this.calendar.events.get({
        calendarId,
        eventId
      });

      return this.mapToCalendarEvent(response.data);
    } catch (error) {
      console.error('[GoogleCalendarMCP] getEvent error:', error);
      return null;
    }
  }

  // ====================================================
  // 일정 생성/수정/삭제
  // ====================================================

  /**
   * 일정 생성
   */
  async createEvent(event: CalendarEvent, calendarId: string = 'primary'): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.insert({
        calendarId,
        requestBody: {
          summary: event.summary,
          description: event.description,
          location: event.location,
          start: event.start,
          end: event.end,
          attendees: event.attendees,
          reminders: event.reminders
        }
      });

      console.log('[GoogleCalendarMCP] Event created:', response.data.id);
      return this.mapToCalendarEvent(response.data);
    } catch (error) {
      console.error('[GoogleCalendarMCP] createEvent error:', error);
      throw error;
    }
  }

  /**
   * 일정 수정
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>,
    calendarId: string = 'primary'
  ): Promise<CalendarEvent> {
    try {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: updates
      });

      console.log('[GoogleCalendarMCP] Event updated:', eventId);
      return this.mapToCalendarEvent(response.data);
    } catch (error) {
      console.error('[GoogleCalendarMCP] updateEvent error:', error);
      throw error;
    }
  }

  /**
   * 일정 삭제
   */
  async deleteEvent(eventId: string, calendarId: string = 'primary'): Promise<boolean> {
    try {
      await this.calendar.events.delete({
        calendarId,
        eventId
      });

      console.log('[GoogleCalendarMCP] Event deleted:', eventId);
      return true;
    } catch (error) {
      console.error('[GoogleCalendarMCP] deleteEvent error:', error);
      return false;
    }
  }

  // ====================================================
  // Free/Busy 조회 (그룹 기능의 핵심!)
  // ====================================================

  /**
   * Free/Busy 정보 조회
   *
   * 그룹 멤버들의 바쁜 시간을 한 번에 조회합니다.
   * 이를 통해 모두가 가능한 시간을 찾을 수 있습니다.
   */
  async getFreeBusy(options: {
    emails: string[];           // 조회할 캘린더 이메일 목록
    timeMin: string;            // 조회 시작 시간 (ISO 8601)
    timeMax: string;            // 조회 종료 시간 (ISO 8601)
  }): Promise<FreeBusyResult> {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: options.timeMin,
          timeMax: options.timeMax,
          timeZone: this.timeZone,
          items: options.emails.map(email => ({ id: email }))
        }
      });

      return {
        calendars: response.data.calendars as FreeBusyResult['calendars'],
        timeMin: options.timeMin,
        timeMax: options.timeMax
      };
    } catch (error) {
      console.error('[GoogleCalendarMCP] getFreeBusy error:', error);
      throw error;
    }
  }

  /**
   * 그룹 멤버들의 공통 가용 시간 찾기
   *
   * Free/Busy API 결과를 분석하여 모두가 가능한 시간 슬롯을 반환합니다.
   */
  async findGroupAvailableSlots(options: {
    emails: string[];
    startDate: string;          // YYYY-MM-DD
    endDate: string;            // YYYY-MM-DD
    slotDurationMinutes?: number;  // 기본 60분
    workHoursStart?: number;    // 기본 9시
    workHoursEnd?: number;      // 기본 21시
  }): Promise<AvailableSlot[]> {
    const {
      emails,
      startDate,
      endDate,
      slotDurationMinutes = 60,
      workHoursStart = 9,
      workHoursEnd = 21
    } = options;

    // Free/Busy 조회
    const freeBusyResult = await this.getFreeBusy({
      emails,
      timeMin: `${startDate}T00:00:00+09:00`,
      timeMax: `${endDate}T23:59:59+09:00`
    });

    // 각 날짜별로 가용 슬롯 계산
    const availableSlots: AvailableSlot[] = [];
    const currentDate = new Date(startDate);
    const lastDate = new Date(endDate);

    while (currentDate <= lastDate) {
      const dateStr = currentDate.toISOString().split('T')[0];

      // 해당 날짜의 업무 시간대 슬롯 생성
      for (let hour = workHoursStart; hour < workHoursEnd; hour++) {
        const slotStart = `${hour.toString().padStart(2, '0')}:00`;
        const slotEnd = `${(hour + 1).toString().padStart(2, '0')}:00`;
        const slotStartTime = new Date(`${dateStr}T${slotStart}:00+09:00`);
        const slotEndTime = new Date(`${dateStr}T${slotEnd}:00+09:00`);

        // 각 멤버의 바쁜 시간과 겹치는지 확인
        const unavailableMembers: string[] = [];

        for (const email of emails) {
          const calendarData = freeBusyResult.calendars[email];
          if (calendarData?.busy) {
            for (const busyPeriod of calendarData.busy) {
              const busyStart = new Date(busyPeriod.start);
              const busyEnd = new Date(busyPeriod.end);

              // 슬롯과 바쁜 시간이 겹치는지 확인
              if (slotStartTime < busyEnd && slotEndTime > busyStart) {
                if (!unavailableMembers.includes(email)) {
                  unavailableMembers.push(email);
                }
                break;
              }
            }
          }
        }

        availableSlots.push({
          date: dateStr,
          startTime: slotStart,
          endTime: slotEnd,
          allAvailable: unavailableMembers.length === 0,
          unavailableMembers: unavailableMembers.length > 0 ? unavailableMembers : undefined
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableSlots;
  }

  /**
   * 충돌 확인
   */
  async checkConflicts(options: {
    startTime: string;  // ISO 8601
    endTime: string;    // ISO 8601
    calendarId?: string;
  }): Promise<CalendarEvent[]> {
    const events = await this.listEvents({
      calendarId: options.calendarId,
      timeMin: options.startTime,
      timeMax: options.endTime
    });

    return events.filter(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date || '');
      const eventEnd = new Date(event.end.dateTime || event.end.date || '');
      const checkStart = new Date(options.startTime);
      const checkEnd = new Date(options.endTime);

      // 시간이 겹치는지 확인
      return eventStart < checkEnd && eventEnd > checkStart;
    });
  }

  // ====================================================
  // 유틸리티
  // ====================================================

  private mapToCalendarEvent(event: calendar_v3.Schema$Event): CalendarEvent {
    return {
      id: event.id || undefined,
      summary: event.summary || '',
      description: event.description || undefined,
      location: event.location || undefined,
      start: {
        dateTime: event.start?.dateTime || undefined,
        date: event.start?.date || undefined,
        timeZone: event.start?.timeZone || undefined
      },
      end: {
        dateTime: event.end?.dateTime || undefined,
        date: event.end?.date || undefined,
        timeZone: event.end?.timeZone || undefined
      },
      attendees: event.attendees?.map(a => ({
        email: a.email || '',
        displayName: a.displayName || undefined
      })),
      reminders: event.reminders ? {
        useDefault: event.reminders.useDefault || false,
        overrides: event.reminders.overrides?.map(o => ({
          method: o.method || 'popup',
          minutes: o.minutes || 10
        }))
      } : undefined
    };
  }

  /**
   * 빠른 일정 생성 (자연어에서 파싱된 정보로)
   */
  async quickCreateEvent(options: {
    title: string;
    date: string;        // YYYY-MM-DD
    startTime: string;   // HH:mm
    endTime?: string;    // HH:mm (기본: startTime + 1시간)
    location?: string;
    description?: string;
  }): Promise<CalendarEvent> {
    const { title, date, startTime, endTime, location, description } = options;

    // 종료 시간 계산
    let calculatedEndTime = endTime;
    if (!calculatedEndTime) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endHour = (hours + 1) % 24;
      calculatedEndTime = `${endHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    const event: CalendarEvent = {
      summary: title,
      description,
      location,
      start: {
        dateTime: `${date}T${startTime}:00`,
        timeZone: this.timeZone
      },
      end: {
        dateTime: `${date}T${calculatedEndTime}:00`,
        timeZone: this.timeZone
      }
    };

    return this.createEvent(event);
  }
}

// 싱글톤 인스턴스 (필요시 사용)
let instance: GoogleCalendarMCP | null = null;

export function getGoogleCalendarMCP(): GoogleCalendarMCP {
  if (!instance) {
    instance = new GoogleCalendarMCP();
  }
  return instance;
}
