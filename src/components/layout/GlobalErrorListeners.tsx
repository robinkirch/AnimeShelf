"use client";

import { useEffect } from 'react';
import { rendererLogger } from '@/lib/logger';

// RootLayout is a server component, so window listeners have to be registered from a client component.
export function GlobalErrorListeners() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      rendererLogger.error('Unhandled Renderer Error:', {
        category: 'renderer-error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack
      });
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      rendererLogger.error('Unhandled Renderer Rejection:', {
        category: 'renderer-rejection',
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
