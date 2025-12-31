import { create } from 'zustand';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import * as api from '../services/api';
import { useGoalStore } from './goalStore';
import { useTodoStore } from './todoStore';
import { useCategoryStore } from './categoryStore';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  supabaseClient: SupabaseClient | null;
  loginWithGoogle: () => Promise<void>;
  handleGoogleCallback: () => Promise<boolean>;
  logout: () => void;
  setUser: (user: User | null) => void;
  initFromToken: () => Promise<void>;
}

// 다른 스토어에 사용자 ID 동기화
const syncUserToStores = (userId: string | null) => {
  useGoalStore.getState().setCurrentUser(userId);
  useTodoStore.getState().setCurrentUser(userId);
  useCategoryStore.getState().setCurrentUser(userId);
};

// Supabase 클라이언트 캐시
let supabaseClientCache: SupabaseClient | null = null;

async function getSupabaseClient(): Promise<SupabaseClient> {
  if (supabaseClientCache) return supabaseClientCache;

  try {
    const config = await api.getSupabaseConfig();
    supabaseClientCache = createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
    return supabaseClientCache;
  } catch (error) {
    console.error('Failed to get Supabase config:', error);
    throw new Error('Supabase 설정을 불러올 수 없습니다.');
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: false,
  supabaseClient: null,

  loginWithGoogle: async () => {
    set({ isLoading: true });
    try {
      const supabase = await getSupabaseClient();

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('OAuth error:', error);
        throw error;
      }
      // 리다이렉트가 발생하므로 여기서는 isLoading을 false로 설정하지 않음
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  handleGoogleCallback: async () => {
    set({ isLoading: true });
    try {
      const supabase = await getSupabaseClient();

      // URL 해시에서 세션 정보 추출
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        // URL 해시에서 직접 토큰을 가져온 경우
        console.log('Found access_token in URL hash');

        // Supabase 세션 설정
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
        }

        // access_token으로 백엔드에 로그인 요청
        const response = await api.loginWithGoogle(accessToken);

        const user: User = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          nickname: response.user.nickname || response.user.name,
          avatar_url: response.user.avatar_url,
          is_active: true,
          created_at: response.user.created_at,
        };

        set({ user, isLoading: false });
        syncUserToStores(user.id);
        return true;
      }

      // URL 해시에 토큰이 없으면 Supabase 세션에서 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('세션을 가져오는데 실패했습니다.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('세션을 찾을 수 없습니다. 다시 로그인해주세요.');
      }

      // 백엔드에 access_token 전송해서 우리 서비스 JWT 받기
      const response = await api.loginWithGoogle(session.access_token);

      const user: User = {
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        nickname: response.user.nickname || response.user.name,
        avatar_url: response.user.avatar_url,
        is_active: true,
        created_at: response.user.created_at,
      };

      set({ user, isLoading: false });
      syncUserToStores(user.id);
      return true;
    } catch (error) {
      console.error('Google callback error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    api.logout();
    set({ user: null });
    syncUserToStores(null);

    // Supabase 로그아웃도 처리
    getSupabaseClient()
      .then((supabase) => {
        supabase.auth.signOut();
      })
      .catch(() => {
        // 무시
      });
  },

  setUser: (user) => {
    set({ user });
    if (user) {
      syncUserToStores(user.id);
    }
  },

  initFromToken: async () => {
    const token = api.getAuthToken();
    if (token) {
      const savedUser = localStorage.getItem('palm_user');
      if (savedUser) {
        try {
          const user = JSON.parse(savedUser);
          set({ user });
          syncUserToStores(user.id);
        } catch {
          api.setAuthToken(null);
        }
      }
    }
  },
}));

// 사용자 정보 로컬 스토리지 동기화
useAuthStore.subscribe((state) => {
  if (state.user) {
    localStorage.setItem('palm_user', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('palm_user');
  }
});
