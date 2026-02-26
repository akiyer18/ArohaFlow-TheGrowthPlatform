import React from 'react';
import { cn } from './cn';

export const Input = ({ className, ...props }) => (
  <input
    className={cn(
      'w-full h-11 rounded-ui border border-app-border bg-app-bg-primary text-app-text-primary',
      'px-3 text-sm placeholder:text-app-text-muted transition-ui',
      'focus:border-app-accent focus:ring-2 focus:ring-app-accent/30',
      className
    )}
    {...props}
  />
);

export const Textarea = ({ className, ...props }) => (
  <textarea
    className={cn(
      'w-full rounded-ui border border-app-border bg-app-bg-primary text-app-text-primary',
      'px-3 py-2 text-sm placeholder:text-app-text-muted transition-ui',
      'focus:border-app-accent focus:ring-2 focus:ring-app-accent/30',
      className
    )}
    {...props}
  />
);

export const Select = ({ className, children, ...props }) => (
  <select
    className={cn(
      'w-full h-11 rounded-ui border border-app-border bg-app-bg-primary text-app-text-primary',
      'px-3 text-sm transition-ui',
      'focus:border-app-accent focus:ring-2 focus:ring-app-accent/30',
      className
    )}
    {...props}
  >
    {children}
  </select>
);
