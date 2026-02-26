import React from 'react';
import { cn } from './cn';

const PageContainer = ({ className, children }) => (
  <div className={cn('mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8', className)}>
    {children}
  </div>
);

export default PageContainer;
