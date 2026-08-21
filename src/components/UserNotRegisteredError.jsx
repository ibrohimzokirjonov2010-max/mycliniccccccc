import React from 'react';
import { AlertTriangle, Mail, RefreshCw, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * UserNotRegisteredError Component
 * 
 * Error page displayed when a user is not registered to access the application.
 * Provides guidance on how to resolve the access issue.
 * 
 * @returns {JSX.Element} Access restricted error page
 */
const UserNotRegisteredError = () => {
  /**
   * Handle logout action
   */
  const handleLogout = () => {
    // Clear any stored auth tokens
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    // Redirect to login or home
    window.location.href = '/';
  };

  /**
   * Handle refresh action
   */
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-white to-slate-50 p-4">
      <div className="max-w-md w-full p-8 bg-white rounded-2xl shadow-lg border border-slate-100">
        <div className="text-center">
          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-orange-100">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
          
          {/* Title */}
          <h1 className="text-2xl font-bold text-slate-900 mb-3">
            Kirish cheklangan
          </h1>
          
          {/* Description */}
          <p className="text-slate-600 mb-6">
            Siz ushbu ilovadan foydalanish uchun ro'yxatdan o'tmagansiz. 
            Iltimos, administrator bilan bog'laning.
          </p>
          
          {/* Action Buttons */}
          <div className="flex flex-col gap-3 mb-6">
            <Button 
              variant="outline" 
              className="w-full gap-2"
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4" />
              Qayta yuklash
            </Button>
            <Button 
              variant="default" 
              className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              Chiqish
            </Button>
          </div>
          
          {/* Help Section */}
          <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-600 text-left">
            <p className="font-medium mb-2">Agar bu xatolik deb o'ylasangiz:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>To'g'ri hisobga kirganingizni tekshiring</li>
              <li>Administrator bilan bog'laning</li>
              <li>Qayta kirishga harakat qiling</li>
            </ul>
          </div>
          
          {/* Contact Info */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-500 flex items-center justify-center gap-1">
              <Mail className="w-3 h-3" />
              support@myclinic.uz
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
