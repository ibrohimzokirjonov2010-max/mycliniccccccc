import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, User, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';
import { useTranslation } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useAuth } from '@/lib/AuthContext';

/**
 * Topbar Component
 * 
 * Top navigation bar with mobile menu toggle, notifications, and user profile.
 * Provides quick access to settings and logout functionality.
 * 
 * @param {Object} props
 * @param {Function} props.onMenuClick - Callback to open mobile sidebar
 * @param {boolean} props.sidebarCollapsed - Whether sidebar is collapsed (for future use)
 */
export default function Topbar({ onMenuClick, sidebarCollapsed }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [notificationCount, setNotificationCount] = useState(0);

  /**
   * Fetch notification count on mount
   */
  useEffect(() => {
    fetchNotificationCount();
    // Poll for new notifications every 5 minutes
    const interval = setInterval(fetchNotificationCount, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Fetch pending notifications count
   */
  const fetchNotificationCount = useCallback(async () => {
    try {
      // This would typically fetch from a notifications endpoint
      // For now, we'll use a placeholder
      setNotificationCount(0);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  }, []);

  /**
   * Handle user logout
   */
  const handleLogout = useCallback(() => {
    if (logout) {
      logout();
    } else {
      localStorage.removeItem('is_authenticated');
      localStorage.removeItem('user_name');
      base44.clinic.logout();
      navigate('/login');
    }
  }, [navigate, logout]);

  /**
   * Navigate to settings page
   */
  const goToSettings = useCallback(() => {
    navigate('/settings');
  }, [navigate]);

  /**
   * Navigate to profile page
   */
  const goToProfile = useCallback(() => {
    navigate('/profile');
  }, [navigate]);

  return (
    <header className="h-12 bg-card border-b border-border flex items-center justify-between px-4 lg:px-5 flex-shrink-0">
      {/* Left Section - Mobile Menu & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground hidden sm:block">
          My Clinic
        </h1>
      </div>

      {/* Right Section - Notifications, Language & User */}
      <div className="flex items-center gap-2">
        {/* Language Switcher */}
        <LanguageSwitcher variant="minimal" />
        {/* Notifications Button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </Button>

        {/* User Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="User menu"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {(user?.avatar_url || user?.photo || user?.avatar || user?.image) ? (
                  <img src={user.avatar_url || user.photo || user.avatar || user.image} alt={user?.name || 'User'} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4 text-primary" />
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={goToProfile} className="cursor-pointer">
              <User className="w-4 h-4 mr-2" />
              {t('common.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
              <Settings className="w-4 h-4 mr-2" />
              {t('common.settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              {t('common.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
