import React from 'react';
import { cn } from './cn';

const variants = {
  primary:
    'bg-app-accent text-white hover:brightness-110 border border-transparent',
  secondary:
    'bg-app-bg-secondary text-app-text-primary border border-app-border hover:bg-slate-800',
  ghost:
    'bg-transparent text-app-text-primary border border-transparent hover:bg-slate-800',
  danger:
    'bg-app-danger text-white border border-transparent hover:brightness-110',
};

const sizes = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-5 text-sm',
};

const Button = ({ variant = 'primary', size = 'md', className, ...props }) => (
  <button
    className={cn(
      'inline-flex items-center justify-center gap-2 rounded-ui font-medium transition-ui',
      'focus-visible:ring-2 focus-visible:ring-app-accent disabled:opacity-60 disabled:cursor-not-allowed',
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  />
);

export default Button;
