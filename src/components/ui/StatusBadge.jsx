import React from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

const STATUS_CONFIG = {
  // Appointment Statuses
  'Scheduled': 'bg-blue-50 text-blue-700 border-blue-200',
  'Completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Cancelled': 'bg-rose-50 text-rose-700 border-rose-200',
  'No-Show': 'bg-amber-50 text-amber-700 border-amber-200',
  'Waiting': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'In Progress': 'bg-orange-50 text-orange-700 border-orange-200',

  // Patient Statuses
  'New': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Active': 'bg-blue-50 text-blue-700 border-blue-200',
  'Inactive': 'bg-gray-50 text-gray-700 border-gray-200',

  // Payment Statuses
  'Income': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Expense': 'bg-rose-50 text-rose-700 border-rose-200',
  'Debt': 'bg-amber-50 text-amber-700 border-amber-200',
  'Discount': 'bg-purple-50 text-purple-700 border-purple-200',
  'Refund': 'bg-indigo-50 text-indigo-700 border-indigo-200',

  // Treatment Plan Statuses
  'Planned': 'bg-blue-50 text-blue-700 border-blue-200',
  'Urgent': 'bg-rose-50 text-rose-700 border-rose-200',
  'Low': 'bg-gray-50 text-gray-700 border-gray-200',
  'Medium': 'bg-blue-50 text-blue-700 border-blue-200',
  'High': 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function StatusBadge({ status, className = '', size = 'md' }) {
  const { t } = useTranslation();
  
  const normalizedStatus = String(status || '').trim();
  const lowerStatus = normalizedStatus.toLowerCase();
  
  // Find style - match lowercase or exact
  const styleKey = Object.keys(STATUS_CONFIG).find(k => k.toLowerCase() === lowerStatus) || normalizedStatus;
  const styles = STATUS_CONFIG[styleKey] || 'bg-gray-50 text-gray-700 border-gray-200';
  
  // Translation lookup: try lowercase first, then exact
  const transKey = `status.${lowerStatus}`;
  const translated = t(transKey);
  const label = translated !== transKey ? translated : (t(`status.${normalizedStatus}`) !== `status.${normalizedStatus}` ? t(`status.${normalizedStatus}`) : normalizedStatus);
  
  const sizeClasses = {
    'xs': 'px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
    'sm': 'px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
    'md': 'px-3 py-1 text-[11px] font-black uppercase tracking-wider',
    'lg': 'px-4 py-1.5 text-xs font-black uppercase tracking-wider',
  };

  return (
    <span className={`inline-flex items-center border shadow-sm transition-all hover:scale-105 active:scale-95 cursor-default ${sizeClasses[size] || sizeClasses.md} ${styles.replace('rounded-full', '')} rounded-xl ${styles} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-2 bg-current opacity-40 animate-pulse" />
      {label}
    </span>
  );
}
