import React from 'react';
import { cn } from './cn';

const ACCENT_STYLES = {
  emerald: 'flow-card-accent-emerald',
  orange: 'flow-card-accent-orange',
  violet: 'flow-card-accent-violet',
  neutral: 'flow-card-accent-neutral',
};

const Card = ({ className, hover = false, accent = 'neutral', children, onClick, ...rest }) => {
  const isInteractive = typeof onClick === 'function';
  return (
    <section
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      className={cn(
        'flow-card p-5 rounded-ui border border-white/5',
        ACCENT_STYLES[accent] || ACCENT_STYLES.neutral,
        hover && isInteractive && 'cursor-pointer',
        !isInteractive && 'hover:transform-none hover:shadow-[0_2px_8px_rgba(0,0,0,0.2),0_8px_24px_rgba(0,0,0,0.15)]',
        className
      )}
      {...rest}
    >
      {children}
    </section>
  );
};

export default Card;
