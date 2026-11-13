import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { isLocalMode, supabase } from '../config/supabase';
import { dataService } from '../services/data/DataService';
import { createDefaultAuthSession } from '../modules/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const auth = useMemo(() => createDefaultAuthSession(), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Local + ?hallmark=1 seeds a session so Hallmark render can screenshot /today.
        if (
          isLocalMode &&
          import.meta.env.DEV &&
          typeof window !== 'undefined' &&
          new URLSearchParams(window.location.search).get('hallmark') === '1'
        ) {
          await supabase.auth.signInWithPassword({
            email: 'hallmark@local.dev',
            password: 'hallmark',
          });
        }

        const current = await auth.getCurrentUser();
        if (!cancelled) setUser(current);
      } catch (error) {
        console.error('Error in getInitialSession:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const unsubscribe = auth.subscribeSession((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [auth]);

  const login = async (email, password) => {
    try {
      setLoading(true);
      return await auth.login(email, password);
    } catch (error) {
      console.error('Login exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, confirmPassword, name = '') => {
    try {
      setLoading(true);

      if (!isLocalMode && password !== confirmPassword) {
        return { success: false, error: 'Passwords do not match' };
      }

      if (!isLocalMode && password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long' };
      }

      const { data, error } = await dataService.register(email, password, {
        name: name || email.split('@')[0],
      });

      if (error) {
        console.error('Registration error:', error);
        return {
          success: false,
          error: error.message || 'Registration failed. Please try again.',
        };
      }

      if (data.user) {
        if (!data.session) {
          return {
            success: true,
            message: 'Registration successful! Please check your email to confirm your account.',
          };
        }
        return { success: true };
      }

      return { success: false, error: 'Registration failed. Please try again.' };
    } catch (error) {
      console.error('Registration exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      return await auth.logout();
    } catch (error) {
      console.error('Logout exception:', error);
      return { success: false, error: 'Logout failed. Please try again.' };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error);
        return {
          success: false,
          error: error.message || 'Failed to send reset email. Please try again.',
        };
      }

      return {
        success: true,
        message: 'Password reset email sent! Please check your inbox.',
      };
    } catch (error) {
      console.error('Password reset exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates,
      });

      if (error) {
        console.error('Profile update error:', error);
        return {
          success: false,
          error: error.message || 'Failed to update profile. Please try again.',
        };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Profile update exception:', error);
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    }
  };

  const value = {
    user,
    login,
    register,
    logout,
    resetPassword,
    updateProfile,
    loading,
    isAuthenticated: !!user,
    userId: user?.id || null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
