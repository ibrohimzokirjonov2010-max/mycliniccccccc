import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { safeLocalStorage as localStorage } from '@/utils/safeStorage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [isDoctor, setIsDoctor]           = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [token, setToken]                 = useState(() => localStorage.getItem('auth_token'));

  const setAuthData = useCallback((userData, authToken) => {
    setUser(userData);
    setIsAuthenticated(true);
    setIsAdmin(userData.role === 'admin');
    setIsDoctor(userData.role === 'doctor');
    if (authToken) {
      setToken(authToken);
      localStorage.setItem('auth_token', authToken);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setIsDoctor(false);
    setToken(null);

    [
      'auth_token',
      'is_authenticated',
      'user_id',
      'user_name',
      'user_role',
      'clinic_id',
      'current_clinic_id',
      'clinic_plan',
      'is_super_admin',
      'user_data'
    ].forEach((key) => localStorage.removeItem(key));

    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const authToken = localStorage.getItem('auth_token');
      const userId    = localStorage.getItem('user_id');
      const cachedUser = localStorage.getItem('user_data');

      // Optimistic mount: if cached user data exists, mount immediately to bypass the white loading screen!
      let isInitSync = false;
      if (authToken && userId && cachedUser) {
        try {
          const parsed = JSON.parse(cachedUser);
          if (parsed && parsed.id === userId) {
            setUser(parsed);
            setIsAuthenticated(true);
            setIsAdmin(parsed.role === 'admin');
            setIsDoctor(parsed.role === 'doctor');
            setIsLoadingAuth(false);
            isInitSync = true;
          }
        } catch (e) {
          console.warn('Error parsing cached user data:', e);
        }
      }

      if (authToken && userId) {
        try {
          // getUserById → faqat 1 qatorli DB so'rov (getAllUsers o'rniga — juda tez!)
          const foundUser = await base44.auth.getUserById(userId);
          if (foundUser) {
            setUser(foundUser);
            localStorage.setItem('user_data', JSON.stringify(foundUser));
            setIsAuthenticated(true);
            setIsAdmin(foundUser.role === 'admin');
            setIsDoctor(foundUser.role === 'doctor');
          } else {
            logout();
          }
        } catch {
          logout();
        }
      } else {
        setIsLoadingAuth(false);
      }


      if (!isInitSync) {
        setIsLoadingAuth(false);
      }
    };

    initAuth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Memoized context value ───────────────────────────────────────────────
  // Critical fix: without useMemo, every AuthProvider render creates a new
  // object reference → all consumers re-render unnecessarily
  const contextValue = useMemo(() => ({
    user,
    token,
    isAuthenticated,
    isAdmin,
    isDoctor,
    isLoadingAuth,
    setAuthData,
    logout,
  }), [user, token, isAuthenticated, isAdmin, isDoctor, isLoadingAuth, setAuthData, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

export default AuthContext;
