import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Chronotype = 'morning' | 'evening' | 'neutral';

interface UserSettings {
  chronotype: Chronotype;
  wakeUpTime: string; // HH:MM
  sleepTime: string; // HH:MM
  preferredWorkDuration: number; // minutes
  breakInterval: number; // minutes
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
    label: 'Early Bird',
    description: 'Preferences waking up early with high energy in the morning',
    icon: '🌅',
    focusHours: '6 AM - 11 AM',
    energyPeak: '8 AM - 11 AM',
  },
  evening: {
    label: 'Night Owl',
    description: 'Active late at night with higher energy in the evening',
    icon: '🌙',
    focusHours: '2 PM - 8 PM',
    energyPeak: '4 PM - 8 PM',
  },
  neutral: {
    label: 'Neutral',
    description: 'Maintains balanced energy throughout the day',
    icon: '⚖️',
    focusHours: '9 AM - 4 PM',
    energyPeak: '10 AM - 3 PM',
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

        // Default time settings based on Chronotype
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
