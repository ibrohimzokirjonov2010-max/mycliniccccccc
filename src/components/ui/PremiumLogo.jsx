import React from 'react';
import { Shield, BookOpen, GraduationCap, Stethoscope } from 'lucide-react';

export const PremiumLogo = ({ className = "w-12 h-12", ...props }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`} {...props}>
      {/* Gradients */}
      <svg className="absolute w-0 h-0">
        <defs>
          <linearGradient id="shieldbg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0B2A55" />
            <stop offset="50%" stopColor="#061B39" />
            <stop offset="100%" stopColor="#020E1F" />
          </linearGradient>
          <linearGradient id="goldgrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E2C167" />
            <stop offset="50%" stopColor="#C49B38" />
            <stop offset="100%" stopColor="#966D1B" />
          </linearGradient>
        </defs>
      </svg>

      {/* Book at bottom */}
      <BookOpen 
        className="absolute -bottom-2 z-0 w-[85%] h-[60%] opacity-90 drop-shadow-md" 
        style={{ color: "url(#shieldbg)" }} 
        strokeWidth={2} 
        fill="white"
      />
      
      {/* Stethoscope wrapping from behind */}
      <Stethoscope 
        className="absolute z-10 w-[105%] h-[105%] -left-[2.5%]" 
        style={{ color: "url(#goldgrad)" }} 
        strokeWidth={1.25} 
      />

      {/* Main Shield */}
      <Shield 
        className="absolute z-20 w-[80%] h-[80%] mt-1 drop-shadow-xl" 
        style={{ color: "url(#goldgrad)" }} 
        fill="url(#shieldbg)" 
        strokeWidth={1.5} 
      />
      
      {/* White Tooth inside Shield */}
      <svg 
        viewBox="0 0 100 100" 
        className="absolute z-30 w-[45%] h-[45%] mt-2" 
        style={{ filter: "drop-shadow(0px 4px 6px rgba(0,0,0,0.5))" }}
      >
        <path 
          d="M 28 85 C 24 70 16 55 16 35 C 16 20 28 10 42 16 C 46 18 50 24 50 24 C 50 24 54 18 58 16 C 72 10 84 20 84 35 C 84 55 76 70 72 85 C 69 95 61 95 61 83 C 61 65 54 53 50 53 C 46 53 39 65 39 83 C 39 95 31 95 28 85 Z" 
          fill="#FFFFFF" 
        />
        <path d="M 50 24 C 50 24 45 40 50 60" stroke="#E6EEF5" strokeWidth="2" strokeLinecap="round" />
      </svg>

      {/* Crown/Cap on Top */}
      <GraduationCap 
        className="absolute -top-1 z-40 w-[60%] h-[60%]" 
        style={{ color: "url(#goldgrad)" }} 
        fill="url(#shieldbg)" 
        strokeWidth={1.5} 
      />
    </div>
  );
};
