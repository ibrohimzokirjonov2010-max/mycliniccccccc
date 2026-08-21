import React from 'react';

export default function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend, 
  className = "" 
}) {
  return (
    <div className={`bg-card rounded-2xl border border-border p-5 shadow-sm space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {Icon && (
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        {(description || trend) && (
          <div className="flex items-center gap-1.5 mt-1.5">
            {trend && (
              <span className={`text-xs font-medium ${trend.value > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        )}
      </div>
    </div>
  );
}
