import React from 'react';

/**
 * Custom Tooth Icon - Medical Grade SVG
 * Provides a professional, consistent look across all platforms
 */
export const Tooth = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 100 100" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    <path 
      d="M 28 85 C 24 70 16 55 16 35 C 16 20 28 10 42 16 C 46 18 50 24 50 24 C 50 24 54 18 58 16 C 72 10 84 20 84 35 C 84 55 76 70 72 85 C 69 95 61 95 61 83 C 61 65 54 53 50 53 C 46 53 39 65 39 83 C 39 95 31 95 28 85 Z" 
      fill="#F5EFE1" 
      stroke="#162D3D" 
      strokeWidth="6" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
    />
    <path
      d="M 45 52 C 51 47 56 49 59 58"
      stroke="#162D3D"
      strokeWidth="4"
      strokeLinecap="round"
    />
    <path d="M 26 21 C 29 18 32 16 36 14" stroke="#162D3D" strokeWidth="3" strokeLinecap="round" />
    <path d="M 25 26 L 26 31" stroke="#162D3D" strokeWidth="3" strokeLinecap="round" />
    <path d="M 27 36 L 28 41" stroke="#162D3D" strokeWidth="3" strokeLinecap="round" />
  </svg>
);


/**
 * Implant Icon
 */
export const ImplantIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <path d="M19.5 8c0-4.5-5-5-5-5s-2 1-2.5 1S9.5 3 9.5 3s-5 .5-5 5c0 3.5 2.5 6.5 2.5 9.5a4 4 0 0 0 4 4 4 4 0 0 0 4-4c0-3 2.5-6 2.5-9.5z" />
    <path d="M12 11v6" />
    <path d="M10 14h4" />
    <path d="M10 17h4" />
  </svg>
);

/**
 * Stethoscope Premium
 */
export const StethoscopeIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
    <path d="M8 15v1a6 6 0 0 0 6 6h2" />
    <circle cx="20" cy="22" r="2" />
  </svg>
);
