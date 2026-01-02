import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Chronotype = 'morning' | 'evening' | 'neutral';

interface UserSettings {
  chronotype: Chronotype;
  wakeUpTime: string; // HH:MM
  sleepTime: string; // HH:MM
  preferredWorkDuration: number; // 분 단위
  breakInterval: number; // 분 단위
  notificationsEnabled: boolean;
  soundEnabled: boolean;
}

interface SettingsState {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  setChronotype: (chronotype: Chronotype) => void;
  getOptimalWorkHours: () => { start: number; end: number };
  getChronotypeInfo: () => {
    label: string;
    description: string;
    icon: string;
    focusHours: string;
    energyPeak: string;
  };
}

const defaultSettings: UserSettings = {
  chronotype: 'neutral',
  wakeUpTime: '07:00',
  sleepTime: '23:00',
  preferredWorkDuration: 90,
  breakInterval: 15,
  notificationsEnabled: true,
  soundEnabled: true,
};

const chronotypeInfo: Record<Chronotype, {
  label: string;
  description: string;
  icon: string;
  focusHours: string;
  energyPeak: string;
}> = {
  morning: {
    label: '아침형',
    description: '아침에 에너지가 높고 일찍 일어나는 것을 선호합니다',
    icon: '🌅',
    focusHours: '오전 6시 ~ 11시',
    energyPeak: '오전 8시 ~ 11시',
  },
  evening: {
    label: '저녁형',
    description: '저녁에 에너지가 높고 늦게까지 활동하는 것을 선호합니다',
    icon: '🌙',
    focusHours: '오후 2시 ~ 저녁 8시',
    energyPeak: '오후 4시 ~ 저녁 8시',
  },
  neutral: {
    label: '중립형',
    description: '일정한 시간대에 균형잡힌 에너지를 유지합니다',
    icon: '⚖️',
    focusHours: '오전 9시 ~ 오후 4시',
    energyPeak: '오전 10시 ~ 오후 3시',
  },
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,

      updateSettings: (updates) => {
        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      setChronotype: (chronotype) => {
        const updates: Partial<UserSettings> = { chronotype };

        // Chronotype에 따른 기본 시간 설정
        switch (chronotype) {
          case 'morning':
            updates.wakeUpTime = '05:30';
            updates.sleepTime = '22:00';
            break;
          case 'evening':
            updates.wakeUpTime = '09:00';
            updates.sleepTime = '01:00';
            break;
          case 'neutral':
            updates.wakeUpTime = '07:00';
            updates.sleepTime = '23:00';
            break;
        }

        set((state) => ({
          settings: { ...state.settings, ...updates },
        }));
      },

      getOptimalWorkHours: () => {
        const { chronotype } = get().settings;
        switch (chronotype) {
          case 'morning':
            return { start: 6, end: 11 };
          case 'evening':
            return { start: 14, end: 20 };
          case 'neutral':
            return { start: 9, end: 16 };
          default:
            return { start: 9, end: 17 };
        }
      },

      getChronotypeInfo: () => {
        const { chronotype } = get().settings;
        return chronotypeInfo[chronotype];
      },
    }),
    {
      name: 'palm-settings',
    }
  )
);
