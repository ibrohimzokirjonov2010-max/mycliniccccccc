import React from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * ShifoCrmLogoEmblem
 * Ultra-sharp, medical-grade vector emblem for ShifoCRM.
 * Features a stylized dental tooth fused with a medical heart & vitality spark.
 */
export const ShifoCrmLogoEmblem = ({ className = "w-10 h-10", size = 44, hasGlow = true }) => {
  const gradientId = "shifo-grad-" + Math.random().toString(36).substr(2, 5);
  const glowId = "shifo-glow-" + Math.random().toString(36).substr(2, 5);

  return (
    <div className={cn("relative flex items-center justify-center shrink-0 select-none", className)}>
      {hasGlow && (
        <div 
          className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#00D084] via-[#1499AD] to-[#38BDF8] blur-[10px] opacity-45 pointer-events-none transform -scale-95"
        />
      )}
      
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 48 48" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
        className="relative z-10 w-full h-full drop-shadow-sm"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E599" />
            <stop offset="35%" stopColor="#1499AD" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>
          
          <linearGradient id={`${gradientId}-inner`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.05" />
          </linearGradient>

          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Squircle Background Base */}
        <rect 
          x="1.5" 
          y="1.5" 
          width="45" 
          height="45" 
          rx="13" 
          fill={`url(#${gradientId})`} 
          stroke="rgba(255, 255, 255, 0.4)" 
          strokeWidth="1.2"
        />

        {/* Subtle Glassmorphism Highlight Layer */}
        <rect 
          x="3" 
          y="3" 
          width="42" 
          height="21" 
          rx="10" 
          fill={`url(#${gradientId}-inner)`} 
        />

        {/* Central Anatomical Tooth & Vital Heart Fusion Crest */}
        <g filter={`url(#${glowId})`} transform="translate(0, 0)">
          {/* Main Tooth Silhouette in Crisp White */}
          <path
            d="M24 10.5 C17 10.5 13 14 13 19 C13 23.2 15 27.5 16.5 32 C17.8 35.5 19.5 37.5 21.2 37.5 C22.8 37.5 23.3 35.5 24 33 C24.7 35.5 25.2 37.5 26.8 37.5 C28.5 37.5 30.2 35.5 31.5 32 C33 27.5 35 23.2 35 19 C35 14 31 10.5 24 10.5 Z"
            fill="#FFFFFF"
            fillOpacity="0.98"
          />

          {/* Medical Heart & Care Pulse Inlay (Cyan/Teal contrast) */}
          <path
            d="M24 16.2 C22.2 13.8 18.5 14.8 18.5 18.2 C18.5 21.2 24 25.5 24 25.5 C24 25.5 29.5 21.2 29.5 18.2 C29.5 14.8 25.8 13.8 24 16.2 Z"
            fill="#0E7490"
            fillOpacity="0.9"
          />

          {/* Center Medical Vital Spark */}
          <circle cx="24" cy="18.8" r="1.6" fill="#FFFFFF" />
        </g>

        {/* Top-right Precision Sparkle Accent */}
        <path 
          d="M37 8.5 L38 11.5 L41 12.5 L38 13.5 L37 16.5 L36 13.5 L33 12.5 L36 11.5 Z" 
          fill="#FFFFFF" 
          fillOpacity="0.9"
        />
      </svg>
    </div>
  );
};

/**
 * ShifoCrmLogo
 * Full brand logo with sharp emblem and typography.
 */
export default function ShifoCrmLogo({ 
  collapsed = false, 
  size = "md", // "sm" | "md" | "lg"
  className = "",
  showSubtitle = true 
}) {
  const { t, language } = useTranslation();

  const getSubtitle = () => {
    if (language === 'ru') return 'Управление Клиникой';
    if (language === 'en') return 'Clinical Management';
    return t('navigation.subtitle') || 'Klinika Boshqaruvi';
  };

  const emblemSizes = {
    sm: { box: "w-8 h-8", px: 32 },
    md: { box: "w-10 h-10 lg:w-11 lg:h-11", px: 44 },
    lg: { box: "w-12 h-12 lg:w-14 lg:h-14", px: 56 }
  };

  const currentSize = emblemSizes[size] || emblemSizes.md;

  return (
    <div className={cn("flex items-center gap-3 select-none", collapsed ? "justify-center" : "", className)}>
      <ShifoCrmLogoEmblem 
        className={currentSize.box} 
        size={currentSize.px} 
        hasGlow={true} 
      />

      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1 leading-none">
            <span className="text-slate-900 lg:text-white font-[950] text-lg lg:text-[21px] tracking-tight uppercase drop-shadow-xs">
              SHIFO
            </span>
            <span className="text-[#00D084] lg:text-[#38BDF8] font-[950] text-lg lg:text-[21px] tracking-tight uppercase">
              CRM
            </span>
          </div>

          {showSubtitle && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00D084] animate-pulse shrink-0 hidden lg:inline-block" />
              <span className="text-[9.5px] font-extrabold text-slate-400 lg:text-slate-300/90 tracking-wider uppercase truncate">
                {getSubtitle()}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
