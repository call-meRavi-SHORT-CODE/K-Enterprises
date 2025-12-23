'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null;
  max?: number;
  getValueLabel?: (value: number | null) => string;
};

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = null, max = 100, getValueLabel, ...props }, ref) => {
    const percent = typeof value === 'number' && !isNaN(value) ? Math.round((value / max) * 100) : undefined;
    const ariaValueNow = typeof percent === 'number' ? Math.min(Math.max(percent, 0), 100) : undefined;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={ariaValueNow}
        className={cn('relative h-4 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <div
          className="h-full bg-primary transition-all"
          style={{ width: ariaValueNow != null ? `${ariaValueNow}%` : '100%' }}
        />
      </div>
    );
  }
);

Progress.displayName = 'Progress';

export { Progress };