import React from 'react';
import { cn } from '@/lib/utils';

/**
 * LeadSourceIcon
 * Crisp, authentic, high-definition official brand vector badge for lead sources.
 * Supports: Instagram, Facebook, Telegram, WhatsApp, Phone/Call, Website, TikTok, Direct
 */
export default function LeadSourceIcon({ source = '', className = "w-8 h-8", size = 32 }) {
  const s = String(source || '').toLowerCase().trim();

  // 1. INSTAGRAM
  if (s.includes('instagram') || s.includes('insta') || s.includes('ig')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-black/5 select-none relative overflow-hidden",
          "bg-gradient-to-tr from-[#FFDC80] via-[#FD1D1D] to-[#833AB4]",
          className
        )}
        title={`Instagram: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }

  // 2. FACEBOOK
  if (s.includes('facebook') || s.includes('fb') || s.includes('meta')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-blue-600/30 select-none bg-[#1877F2]",
          className
        )}
        title={`Facebook: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      </div>
    );
  }

  // 3. TELEGRAM
  if (s.includes('telegram') || s.includes('tg') || s.includes('bot')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-sky-500/30 select-none bg-gradient-to-tr from-[#1D93D2] to-[#2AABEE]",
          className
        )}
        title={`Telegram: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.75-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
        </svg>
      </div>
    );
  }

  // 4. WHATSAPP
  if (s.includes('whatsapp') || s.includes('wa')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-emerald-500/30 select-none bg-[#25D366]",
          className
        )}
        title={`WhatsApp: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="62%" height="62%" fill="currentColor">
          <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 6.46 17.5 2 12.04 2M12.05 3.67C16.58 3.67 20.28 7.37 20.28 11.92C20.28 16.46 16.58 20.17 12.05 20.17C10.6 20.17 9.21 19.79 8 19.08L7.43 18.74L4.31 19.56L5.14 16.52L4.77 15.93C3.99 14.69 3.58 13.27 3.58 11.91C3.58 7.37 7.28 3.67 12.05 3.67M9.05 6.87C8.87 6.87 8.58 6.94 8.33 7.21C8.08 7.48 7.37 8.14 7.37 9.48C7.37 10.82 8.35 12.11 8.49 12.3C8.63 12.49 10.42 15.24 13.15 16.42C15.42 17.4 15.88 17.2 16.38 17.15C16.88 17.11 17.98 16.5 18.21 15.86C18.44 15.22 18.44 14.67 18.37 14.55C18.3 14.43 18.12 14.36 17.85 14.23C17.58 14.1 16.27 13.45 16.03 13.36C15.79 13.27 15.61 13.23 15.44 13.5C15.27 13.77 14.77 14.36 14.62 14.53C14.47 14.7 14.32 14.72 14.05 14.59C13.78 14.46 12.92 14.18 11.9 13.27C11.1 12.55 10.56 11.67 10.41 11.41C10.26 11.15 10.39 11.01 10.53 10.87C10.65 10.75 10.8 10.55 10.94 10.39C11.08 10.23 11.13 10.12 11.22 9.94C11.31 9.76 11.26 9.61 11.2 9.48C11.14 9.35 10.65 8.14 10.44 7.64C10.24 7.15 10.04 7.22 9.88 7.21C9.74 7.2 9.57 7.2 9.39 7.2C9.21 7.2 9.05 6.87 9.05 6.87Z"/>
        </svg>
      </div>
    );
  }

  // 5. CALL / PHONE
  if (s.includes('call') || s.includes('phone') || s.includes('telefon') || s.includes('qo\'ng\'iroq') || s.includes('qongiroq') || s.includes('direct')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-emerald-500/30 select-none bg-gradient-to-tr from-emerald-600 to-teal-500",
          className
        )}
        title={`Telefon Qo'ng'irog'i: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
      </div>
    );
  }

  // 6. WEBSITE / GOOGLE
  if (s.includes('web') || s.includes('sayt') || s.includes('site') || s.includes('google') || s.includes('seo')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-indigo-500/30 select-none bg-gradient-to-tr from-indigo-600 to-cyan-500",
          className
        )}
        title={`Veb-sayt / Google: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </div>
    );
  }

  // 7. TIKTOK
  if (s.includes('tiktok') || s.includes('tik tok') || s.includes('tt')) {
    return (
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-slate-800 select-none bg-slate-950",
          className
        )}
        title={`TikTok: ${source}`}
      >
        <svg viewBox="0 0 24 24" width="60%" height="60%" fill="currentColor">
          <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 3.18-4.303V9.48a6.34 6.34 0 0 0-5.467 1.488 6.335 6.335 0 0 0 4.11 11.032 6.34 6.34 0 0 0 6.336-6.336V8.627a8.21 8.21 0 0 0 4.325 1.543V6.686z" fill="#00f2fe"/>
          <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.068-.102a2.895 2.895 0 0 1 3.18-4.303V9.48a6.34 6.34 0 0 0-5.467 1.488 6.335 6.335 0 0 0 4.11 11.032 6.34 6.34 0 0 0 6.336-6.336V8.627a8.21 8.21 0 0 0 4.325 1.543V6.686z" fill="#fe2c55" opacity="0.7"/>
        </svg>
      </div>
    );
  }

  // 8. DEFAULT / CLINIC DIRECT
  return (
    <div 
      className={cn(
        "rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ring-1 ring-slate-400/20 select-none bg-gradient-to-tr from-slate-700 to-slate-800",
        className
      )}
      title={`Lid: ${source || 'Noma\'lum'}`}
    >
      <svg viewBox="0 0 24 24" width="58%" height="58%" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}
