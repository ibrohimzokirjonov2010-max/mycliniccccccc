import React from 'react';

/**
 * Custom Tooth Icon - Medical Grade SVG (Lucide-compatible 24x24)
 */
export const Tooth = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <path d="M12 2C8 2 5.5 5 5.5 9c0 3 1.5 6 2.5 10 .5 2 1.5 3 2.5 3s1.8-1 1.8-3c0-2 .7-3 1.2-3s1.2 1 1.2 3c0 2 .8 3 1.8 3s2-1 2.5-3c1-4 2.5-7 2.5-10 0-4-2.5-7-6.5-7z" />
    <path d="M9 7.5c1-.8 2-.8 3-.8s2 0 3 .8" />
  </svg>
);

/**
 * Realistic Dental Implant Fixture Icon - Medical Grade SVG
 * Precision anatomical dental screw fixture with abutment hex platform & spiral threads
 */
export const ImplantIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Hexagonal Abutment Connection Post */}
    <path d="M9 2h6v2.5H9z" fill="currentColor" fillOpacity="0.2" />
    {/* Implant Platform Collar */}
    <path d="M6 4.5h12v2H6z" fill="currentColor" fillOpacity="0.15" />
    {/* Tapered Root-Form Fixture Body Outline */}
    <path d="M6.5 6.5l2.5 14a2.5 2.5 0 0 0 6 0l2.5-14" />
    {/* Helical Titanium Screw Threads */}
    <path d="M6 9.5l12-1.5" />
    <path d="M6.5 12.5l11-1.5" />
    <path d="M7 15.5l10-1.5" />
    <path d="M7.8 18.2l8.4-1.2" />
    {/* Apical Cutting Flute */}
    <path d="M12 17.5v3.5" />
  </svg>
);

export const DentalImplant = ImplantIcon;

/**
 * Professional Dental Crown Icon (Karonka / Tojcha)
 * Anatomical dental crown cap with occlusal cusp anatomy, margin collar & prep finish
 */
export const CrownIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Crown Anatomical Cap Outer Contour */}
    <path d="M4 11.5C4 6.5 6.5 3 12 3s8 3.5 8 8.5c0 3.8-1 6.5-2.5 8.5H6.5C5 18 4 15.3 4 11.5z" />
    {/* Occlusal Cusp Ridges */}
    <path d="M7.5 4.5c1.2 2.2 2.8 3.5 4.5 3.5s3.3-1.3 4.5-3.5" />
    {/* Central Fissure Grooves */}
    <path d="M12 8v5.5" />
    <path d="M9.5 10.5l5 0" />
    {/* Chamfer Margin Line (Prosthetic Base) */}
    <path d="M5.5 17c2 1 4.2 1.5 6.5 1.5s4.5-.5 6.5-1.5" strokeWidth="1.4" />
  </svg>
);

export const DentalCrown = CrownIcon;

/**
 * Professional Gingiva Former / Healing Abutment Icon (Formik / Formirovatel)
 * Titanium healing cap dome with hex driver slot, emergence contour and connection base
 */
export const FormerIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Healing Cap Cylindrical Dome */}
    <ellipse cx="12" cy="5.5" rx="6.5" ry="2.5" fill="currentColor" fillOpacity="0.15" />
    {/* Transgingival Body Collar */}
    <path d="M5.5 5.5v5c0 1.8 2.9 3 6.5 3s6.5-1.2 6.5-3v-5" />
    {/* Internal Hex / Torx Driver Slot */}
    <path d="M10.5 4.5h3v1.8h-3z" fill="currentColor" fillOpacity="0.35" />
    {/* Subgingival Abutment Post */}
    <path d="M9 13.5v3.5l3 3.5 3-3.5v-3.5" />
    {/* Screw Thread Accent */}
    <path d="M9.5 16.5h5" />
    {/* Gingiva Tissue Margin Level Line */}
    <path d="M2.5 11c3 1.2 6 1.8 9.5 1.8s6.5-.6 9.5-1.8" strokeWidth="1.3" strokeDasharray="2 2" strokeOpacity="0.6" />
  </svg>
);

export const GingivaFormer = FormerIcon;
export const HealingAbutmentIcon = FormerIcon;

/**
 * Professional Dental Abutment Icon (Abatment)
 * Precision prosthetic abutment core with screw channel
 */
export const AbutmentIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Angled / Straight Abutment Core */}
    <path d="M7 4h10l-2 9H9L7 4z" fill="currentColor" fillOpacity="0.15" />
    {/* Screw Access Hole */}
    <path d="M10 2h4v2h-4z" />
    {/* Platform Margin Collar */}
    <path d="M6 13h12v2.5H6z" />
    {/* Anti-rotational Hex Base */}
    <path d="M8.5 15.5v4l3.5 2.5 3.5-2.5v-4" />
    <path d="M9.5 18.5h5" />
  </svg>
);

export const DentalAbutment = AbutmentIcon;

/**
 * Professional Dental Surgical & Instruments Icon (Boshqa xizmatlar / Jarrohlik)
 * Dental mirror + surgical explorer precision instruments
 */
export const DentalSurgicalIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Dental Examination Mirror */}
    <circle cx="7" cy="7" r="4.5" fill="currentColor" fillOpacity="0.12" />
    <path d="M10.2 10.2L20.5 20.5" strokeWidth="2" />
    <circle cx="7" cy="7" r="2.2" strokeDasharray="1.5 1.5" strokeWidth="1.2" />
    
    {/* Surgical Explorer / Scaler Tool */}
    <path d="M21 3.5c-.8.8-2 1.5-3.5 2l-6 6" />
    <path d="M8.5 14.5l-5 5c-.8.8-1.5.5-1.5 0s.5-1.5 1.5-2.5l5-5" />
  </svg>
);

export const OtherServicesIcon = DentalSurgicalIcon;

/**
 * Professional Bone Graft & Bio-material Icon (Suyak ekish / Graft)
 * Scaffolding lattice matrix with osteogenic granules
 */
export const BoneGraftIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Scaffolding Contour */}
    <path d="M4 8c2-3 6-4 8-1 2-3 6-2 8 1s-1 8-4 11-8 3-10 0S2 11 4 8z" fill="currentColor" fillOpacity="0.1" />
    {/* Bio-ceramic Granule Particles */}
    <circle cx="9" cy="9" r="1.2" fill="currentColor" />
    <circle cx="15" cy="8.5" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="9.5" cy="15" r="1" fill="currentColor" />
    <circle cx="14.5" cy="14.5" r="1" fill="currentColor" />
    {/* Cellular Regenerative Matrix Lines */}
    <path d="M9 9l3 3 2.5-3.5" strokeWidth="1.2" strokeOpacity="0.6" />
    <path d="M9.5 15l2.5-3 2.5 2.5" strokeWidth="1.2" strokeOpacity="0.6" />
  </svg>
);

/**
 * Professional Sinus Lift Icon (Sinus-lifting)
 * Maxillary sinus elevation curve with membrane elevator
 */
export const SinusLiftIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Sinus Cavity Vault */}
    <path d="M3 15c2-6 6-9 10-9s7 3 8 7" />
    {/* Schneiderian Membrane Elevation Arc */}
    <path d="M5 13c3-3 5-4.5 8-4.5s5 1.5 7 3.5" strokeWidth="1.5" strokeDasharray="2 2" stroke="currentColor" />
    {/* Bone Floor Level */}
    <path d="M2 18h20" strokeWidth="2" />
    {/* Sinus Elevator Curette */}
    <path d="M12 18v-4.5c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5" strokeWidth="1.8" />
  </svg>
);

/**
 * Professional Brand & Stock Registry Icon (Brendlar & Zaxira)
 * Sterile titanium fixture canister box with clinical shield badge
 */
export const BrandStockIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Sterile Container Isometric Box */}
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="currentColor" fillOpacity="0.08" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
    {/* Medical Grade Quality Cross Mark */}
    <path d="M12 6.5v3" strokeWidth="2" strokeLinecap="round" />
    <path d="M10.5 8h3" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ImplantStockIcon = BrandStockIcon;

/**
 * Professional Data Fill Required Icon (Kiritish talab)
 * Medical record file with an active edit/input pen indicator
 */
export const KiritishTalabIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Clinical File Base */}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M8 13h4" />
    <path d="M8 17h2" />
    {/* Interactive Stylus / Pen Action */}
    <path d="M18.5 12.5a2.121 2.121 0 0 1 3 3L15 22l-4 1 1-4 6.5-6.5z" fill="currentColor" fillOpacity="0.18" strokeWidth="1.8" />
  </svg>
);

export const DataInputRequiredIcon = KiritishTalabIcon;

/**
 * Professional Clinical Follow-up / Inspection Icon (Nazorat talab)
 * Clinical monitoring stethoscope & reminder timer
 */
export const ClinicalControlIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Inspection Timer / Clock Ring */}
    <circle cx="12" cy="12" r="9" />
    {/* Clinical Stethoscope Pulse Indicator */}
    <polyline points="12 7 12 12 15 15" strokeWidth="2" />
    {/* Alert Pulse Dot */}
    <circle cx="18.5" cy="5.5" r="2.5" fill="currentColor" />
  </svg>
);

export const InspectionAlertIcon = ClinicalControlIcon;

/**
 * Stethoscope Premium Icon
 */
export const StethoscopeIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.3.3 0 1 0 .2.3" />
    <path d="M8 15v1a6 6 0 0 0 6 6h2" />
    <circle cx="20" cy="22" r="2" fill="currentColor" fillOpacity="0.2" />
  </svg>
);

/**
 * Professional Clinical Summa / Revenue Icon (Jami Qiymat)
 * Clean medical billing / treasury ledger without any foreign currency ($) marks
 */
export const ClinicalRevenueIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    {/* Banknote / Financial Voucher Outline */}
    <rect x="2" y="5" width="20" height="14" rx="3" fill="currentColor" fillOpacity="0.08" />
    {/* Center Seal / Medical Financial Emblem */}
    <circle cx="12" cy="12" r="3.5" />
    <path d="M12 10.5v3" />
    <path d="M10.5 12h3" />
    {/* Security Lines */}
    <path d="M6 9h.01" strokeWidth="2.5" />
    <path d="M6 15h.01" strokeWidth="2.5" />
    <path d="M18 9h.01" strokeWidth="2.5" />
    <path d="M18 15h.01" strokeWidth="2.5" />
  </svg>
);

export const SummaIcon = ClinicalRevenueIcon;

/**
 * Professional Dental X-Ray & Radiography Film Icon
 */
export const XrayIcon = ({ className = "w-6 h-6", ...props }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.8" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    {...props}
  >
    <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" fillOpacity="0.06" />
    <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" strokeWidth="2.5" />
    {/* Central Radiographic Tooth Silhouette */}
    <path d="M12 7c-1.8 0-3 1.2-3 3 0 1.2.6 2.5 1 4.2.3 1.2.7 2.3 1 2.8.3.5.7.5 1-.5.3-1 .6-1 .9-1s.6 0 .9 1c.3 1 .7 1 1 .5.3-.5.7-1.6 1-2.8.4-1.7 1-3 1-4.2 0-1.8-1.2-3-3-3z" strokeWidth="1.5" />
  </svg>
);
