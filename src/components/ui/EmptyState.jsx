import React from 'react';
import { Plus, Sparkles } from 'lucide-react';

export default function EmptyState({ 
  icon, 
  title = "Ma'lumot topilmadi", 
  description = "Hozirda bu bo'limda hech qanday ma'lumot mavjud emas.", 
  action,
  actionText,
  onAction,
  actionIcon: ActionIcon = Plus,
  secondaryActionText,
  onSecondaryAction,
  variant = "blue",
  size = "md",
  className = "" 
}) {
  const isElement = React.isValidElement(icon);
  const IconComponent = !isElement ? icon : null;

  // Variant themes for rich illustrative icon badge
  const variantStyles = {
    blue: {
      outerGlow: "from-sky-400/20 via-blue-500/10 to-indigo-500/20",
      container: "bg-gradient-to-br from-blue-50 via-sky-50/80 to-indigo-50/50 border-blue-100/80 text-[#0284c7] shadow-blue-500/10",
      accentBadge: "bg-blue-500 text-white",
      btnGrad: "from-[#0284c7] to-[#0369a1] shadow-blue-500/20"
    },
    emerald: {
      outerGlow: "from-emerald-400/20 via-teal-500/10 to-green-500/20",
      container: "bg-gradient-to-br from-emerald-50 via-teal-50/80 to-green-50/50 border-emerald-100/80 text-emerald-600 shadow-emerald-500/10",
      accentBadge: "bg-emerald-500 text-white",
      btnGrad: "from-emerald-600 to-teal-700 shadow-emerald-500/20"
    },
    amber: {
      outerGlow: "from-amber-400/20 via-orange-500/10 to-yellow-500/20",
      container: "bg-gradient-to-br from-amber-50 via-orange-50/80 to-yellow-50/50 border-amber-100/80 text-amber-600 shadow-amber-500/10",
      accentBadge: "bg-amber-500 text-white",
      btnGrad: "from-amber-600 to-orange-600 shadow-amber-500/20"
    },
    rose: {
      outerGlow: "from-rose-400/20 via-pink-500/10 to-red-500/20",
      container: "bg-gradient-to-br from-rose-50 via-pink-50/80 to-red-50/50 border-rose-100/80 text-rose-600 shadow-rose-500/10",
      accentBadge: "bg-rose-500 text-white",
      btnGrad: "from-rose-600 to-pink-600 shadow-rose-500/20"
    },
    purple: {
      outerGlow: "from-purple-400/20 via-indigo-500/10 to-violet-500/20",
      container: "bg-gradient-to-br from-purple-50 via-indigo-50/80 to-violet-50/50 border-purple-100/80 text-purple-600 shadow-purple-500/10",
      accentBadge: "bg-purple-500 text-white",
      btnGrad: "from-purple-600 to-indigo-600 shadow-purple-500/20"
    },
    default: {
      outerGlow: "from-slate-300/20 via-slate-400/10 to-slate-500/20",
      container: "bg-gradient-to-br from-slate-50 via-slate-100/70 to-slate-50 border-slate-200/80 text-slate-600 shadow-slate-900/5",
      accentBadge: "bg-slate-700 text-white",
      btnGrad: "from-slate-900 to-slate-800 shadow-slate-900/20"
    }
  };

  const style = variantStyles[variant] || variantStyles.blue;

  const sizeClasses = {
    sm: {
      wrap: "py-6 px-4 space-y-2.5",
      iconBox: "w-12 h-12 rounded-2xl",
      iconSize: "w-6 h-6",
      title: "text-xs font-black",
      desc: "text-[11px]"
    },
    md: {
      wrap: "py-10 px-6 space-y-3.5",
      iconBox: "w-16 h-16 sm:w-18 sm:h-18 rounded-[1.5rem]",
      iconSize: "w-8 h-8 sm:w-9 sm:h-9",
      title: "text-sm sm:text-base font-black",
      desc: "text-xs sm:text-[13px]"
    },
    lg: {
      wrap: "py-16 px-8 space-y-4",
      iconBox: "w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem]",
      iconSize: "w-10 h-10 sm:w-12 sm:h-12",
      title: "text-base sm:text-lg font-black",
      desc: "text-xs sm:text-sm"
    }
  }[size] || {
    wrap: "py-10 px-6 space-y-3.5",
    iconBox: "w-16 h-16 sm:w-18 sm:h-18 rounded-[1.5rem]",
    iconSize: "w-8 h-8 sm:w-9 sm:h-9",
    title: "text-sm sm:text-base font-black",
    desc: "text-xs sm:text-[13px]"
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center ${sizeClasses.wrap} ${className}`}>
      {/* Illustrative Icon Badge with Glow */}
      {icon && (
        <div className="relative mb-1">
          {/* Subtle ambient glow backdrop */}
          <div className={`absolute -inset-2 bg-gradient-to-r ${style.outerGlow} rounded-full blur-xl opacity-70 pointer-events-none`} />
          
          {/* Main Icon Container */}
          <div className={`relative ${sizeClasses.iconBox} ${style.container} border flex items-center justify-center shadow-lg transition-transform hover:scale-105 duration-300`}>
            {isElement ? (
              icon
            ) : IconComponent ? (
              <IconComponent className={`${sizeClasses.iconSize} stroke-[1.8]`} />
            ) : null}

            {/* Micro floating accent badge */}
            <div className={`absolute -top-1 -right-1 w-5 h-5 rounded-full ${style.accentBadge} shadow-sm border-2 border-white flex items-center justify-center`}>
              <Sparkles className="w-2.5 h-2.5 fill-current" />
            </div>
          </div>
        </div>
      )}

      {/* Typography */}
      <div className="space-y-1 max-w-md mx-auto">
        <h3 className={`${sizeClasses.title} text-slate-800 tracking-tight leading-snug`}>
          {title}
        </h3>
        {description && (
          <p className={`${sizeClasses.desc} text-slate-400 font-medium leading-relaxed max-w-sm mx-auto`}>
            {description}
          </p>
        )}
      </div>

      {/* Action / Call-to-action buttons */}
      {(action || actionText || secondaryActionText) && (
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
          {action ? (
            action
          ) : actionText && onAction ? (
            <button
              onClick={onAction}
              type="button"
              className={`inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r ${style.btnGrad} text-white rounded-xl text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer`}
            >
              <ActionIcon className="w-3.5 h-3.5" />
              <span>{actionText}</span>
            </button>
          ) : null}

          {secondaryActionText && onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border border-slate-200/80"
            >
              <span>{secondaryActionText}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
