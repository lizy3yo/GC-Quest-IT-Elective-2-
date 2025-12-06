'use client';

import dynamic from 'next/dynamic';
import { ComponentType, ReactNode } from 'react';

/**
 * Lazy Loading Utilities for GC Quest
 * 
 * This module provides utilities for lazy loading components to reduce
 * initial bundle size and improve load times.
 */

// Default loading component
const DefaultLoadingFallback = () => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>
    </div>
  </div>
);

// Skeleton loading for cards
export const CardSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-6 animate-pulse">
    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-4" />
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2" />
    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3" />
  </div>
);

// Skeleton loading for tables
export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
      <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4 animate-pulse" />
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-full" />
          <div className="flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-2" />
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Page skeleton for full page loading
export const PageSkeleton = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
    <div className="max-w-7xl mx-auto">
      {/* Header skeleton */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 mb-8 animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3 mb-4" />
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  </div>
);

/**
 * Create a lazy-loaded component with custom loading fallback
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  LoadingComponent: ComponentType = DefaultLoadingFallback
) {
  return dynamic(importFn, {
    loading: () => <LoadingComponent />,
    ssr: true,
  });
}

/**
 * Create a lazy-loaded component without SSR (for client-only components)
 */
export function createClientOnlyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  LoadingComponent: ComponentType = DefaultLoadingFallback
) {
  return dynamic(importFn, {
    loading: () => <LoadingComponent />,
    ssr: false,
  });
}

// Pre-configured lazy components for heavy modules
export const LazyChatbot = dynamic(
  () => import('@/components/organisms/Chatbot/chatbot/Chatbot'),
  { 
    loading: () => <DefaultLoadingFallback />,
    ssr: false 
  }
);

export const LazyChart = dynamic(
  () => import('recharts').then(mod => ({ default: mod.ResponsiveContainer })),
  { 
    loading: () => <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />,
    ssr: false 
  }
);
