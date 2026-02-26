import React, { createContext, useContext, useState, useEffect } from 'react';
import { isLocalMode, supabase } from '../config/supabase';
import { dataService } from '../services/data/DataService';

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

  useEffect(() => {
    // Get initial session
    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          // User is signed in
          setUser({
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
            createdAt: session.user.created_at,
            emailConfirmed: session.user.email_confirmed_at ? true : false
          });
        } else {
          // User is signed out
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const getInitialSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
          createdAt: session.user.created_at,
          emailConfirmed: session.user.email_confirmed_at ? true : false
        });
      }
    } catch (error) {
      console.error('Error in getInitialSession:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setLoading(true);

      const { data, error } = await dataService.login(email, password);

      if (error) {
        console.error('Login error:', error);
        return { 
          success: false, 
          error: error.message || 'Login failed. Please check your credentials.' 
        };
      }

      if (data.user) {
        // User will be set by the auth state change listener
        return { success: true };
      }

      return { success: false, error: 'Login failed. Please try again.' };
    } catch (error) {
      console.error('Login exception:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password, confirmPassword, name = '') => {
    try {
      setLoading(true);

      // In local mode, auth is intentionally permissive for fast offline usage.
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
          error: error.message || 'Registration failed. Please try again.' 
        };
      }

      if (data.user) {
        // Check if email confirmation is required
        if (!data.session) {
          return { 
            success: true, 
            message: 'Registration successful! Please check your email to confirm your account.' 
          };
        }
        
        // User will be set by the auth state change listener
        return { success: true };
      }

      return { success: false, error: 'Registration failed. Please try again.' };
    } catch (error) {
      console.error('Registration exception:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      const { error } = await dataService.logout();
      
      if (error) {
        console.error('Logout error:', error);
        // Even if there's an error, we should clear the local user state
      }
      
      // User will be set to null by the auth state change listener
      return { success: true };
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
          error: error.message || 'Failed to send reset email. Please try again.' 
        };
      }

      return { 
        success: true, 
        message: 'Password reset email sent! Please check your inbox.' 
      };
    } catch (error) {
      console.error('Password reset exception:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      };
    }
  };

  const updateProfile = async (updates) => {
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: updates
      });

      if (error) {
        console.error('Profile update error:', error);
        return { 
          success: false, 
          error: error.message || 'Failed to update profile. Please try again.' 
        };
      }

      return { success: true, data };
    } catch (error) {
      console.error('Profile update exception:', error);
      return { 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
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
    // Helper to check if user is authenticated
    isAuthenticated: !!user,
    // Helper to get user ID for database operations
    userId: user?.id || null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 