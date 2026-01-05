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

// Sync user ID to other stores
const syncUserToStores = (userId: string | null) => {
  useGoalStore.getState().setCurrentUser(userId);
  useTodoStore.getState().setCurrentUser(userId);
  useCategoryStore.getState().setCurrentUser(userId);
};

// Supabase client cache
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
    throw new Error('Failed to load Supabase config.');
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
      // Redirect occurs, so do not set isLoading to false here
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  handleGoogleCallback: async () => {
    set({ isLoading: true });
    try {
      const supabase = await getSupabaseClient();

      // Extract session info from URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      if (accessToken) {
        // When token is directly retrieved from URL hash
        console.log('Found access_token in URL hash');

        // Set Supabase session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);
        }

        // Request login to backend with access_token
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

      // If no token in URL hash, get from Supabase session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Failed to get session.');
      }

      if (!session) {
        console.error('No session found');
        throw new Error('Session not found. Please login again.');
      }

      // Send access_token to backend to receive service JWT
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

    // Handle Supabase logout as well
    getSupabaseClient()
      .then((supabase) => {
        supabase.auth.signOut();
      })
      .catch(() => {
        // Ignore
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

// Sync user info to local storage
useAuthStore.subscribe((state) => {
  if (state.user) {
    localStorage.setItem('palm_user', JSON.stringify(state.user));
  } else {
    localStorage.removeItem('palm_user');
  }
});
