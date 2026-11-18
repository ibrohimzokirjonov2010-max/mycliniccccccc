import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { clearServerSession, supabase } from '@/api/supabaseClient';
import { safeLocalStorage as localStorage } from '@/utils/safeStorage';
import { sanitizeUser } from '@/utils/password';
import { applyClinicSession, clearClinicSessionCache } from '@/lib/clinicPlan';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]                   = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin]             = useState(false);
  const [isDoctor, setIsDoctor]           = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [token, setToken]                 = useState(null);

  const setAuthData = useCallback((userData) => {
    const safeUser = sanitizeUser(userData);
    setUser(safeUser);
    setIsAuthenticated(true);
    setIsAdmin(safeUser.role === 'admin');
    setIsDoctor(safeUser.role === 'doctor');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('token');
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
      'clinic_settings',
      'is_super_admin',
      'user_data'
    ].forEach((key) => localStorage.removeItem(key));
    clearClinicSessionCache();
    clearServerSession();
    localStorage.removeItem('crm_auth_mode');

    window.location.href = '/login';
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      try {
        const { data: userResult, error } = await supabase.auth.getUser();
        const meta = userResult?.user?.app_metadata || {};
        const userId = meta.crm_user_id || localStorage.getItem('user_id');
        if (error || !userResult?.user || !userId) {
          setIsLoadingAuth(false);
          return;
        }
        const { data: sessionData } = await supabase.auth.getSession();
        setToken(sessionData?.session?.access_token || null);
        const foundUser = await base44.auth.getUserById(userId);
        if (!foundUser) {
          setIsLoadingAuth(false);
          return;
        }
        const safeUser = sanitizeUser(foundUser);
        setUser(safeUser);
        localStorage.setItem('user_data', JSON.stringify(safeUser));
        localStorage.setItem('user_id', safeUser.id);
        setIsAuthenticated(true);
        setIsAdmin(safeUser.role === 'admin');
        setIsDoctor(safeUser.role === 'doctor');
        const clinic = await base44.clinic.getById(foundUser.clinic_id);
        if (clinic) applyClinicSession(clinic);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsLoadingAuth(false);
      }
    };

    initAuth();
  }, []);

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
