import React from 'react';

export default function EmptyState({ 
  icon, 
  title = "Ma'lumot topilmadi", 
  description = "Hozirda bu bo'limda hech qanday ma'lumot mavjud emas.", 
  action,
  className = "" 
}) {
  const isElement = React.isValidElement(icon);
  const IconComponent = !isElement ? icon : null;

  return (
    <div className={`p-8 flex flex-col items-center justify-center text-center space-y-3 ${className}`}>
      {icon && (
        <div className="w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center text-muted-foreground">
          {isElement ? icon : <IconComponent className="w-8 h-8" />}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
