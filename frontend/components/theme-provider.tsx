'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Force a light-only theme: disable system theme switching and set default to 'light'
  return (
    <NextThemesProvider defaultTheme="light" enableSystem={false} attribute="class" {...props}>
      {children}
    </NextThemesProvider>
  );
} 