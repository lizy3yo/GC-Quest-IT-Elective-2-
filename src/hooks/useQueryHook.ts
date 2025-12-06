/**
 * Base Query Hook Interface
 * Provides a standard contract for all query hooks to integrate with Atomic Design
 */

import { UseQueryResult, UseMutationResult, UseQueryOptions } from '@tanstack/react-query';

// ============ STANDARD INTERFACES ============

/**
 * Standard Query Response Interface
 * Used by all query hooks for consistency across components
 */
export interface QueryResponse<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  isFetching: boolean;
  refetch: () => void;
}

/**
 * Standard Mutation Response Interface
 * Used by all mutation hooks for consistency
 */
export interface MutationResponse<TData, TVariables> {
  mutate: (variables: TVariables, options?: MutationOptions<TData>) => void;
  mutateAsync: (variables: TVariables, options?: MutationOptions<TData>) => Promise<TData>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  isSuccess: boolean;
  data: TData | undefined;
  reset: () => void;
}

/**
 * Mutation Options
 */
export interface MutationOptions<TData> {
  onSuccess?: (data: TData) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
  onMutate?: () => void;
}

/**
 * List Response Interface (for paginated data)
 * Standard format for all list endpoints
 */
export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Base Filter Interface
 * Extended by specific filter types
 */
export interface BaseFilters {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ============ HOOK STATE FOR UI COMPONENTS ============

/**
 * Hook State Interface
 * Simplified state for UI components (Atoms, Molecules, Organisms)
 */
export interface HookState {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  isEmpty: boolean;
  isRefetching?: boolean;
}

/**
 * Component Props Interface
 * Standard props that components receive from hooks
 */
export interface ComponentDataProps<T> {
  data: T | undefined;
  state: HookState;
  error: Error | null;
  refetch?: () => void;
}

// ============ TRANSFORMATION UTILITIES ============

/**
 * Transform UseQueryResult to QueryResponse
 * Ensures consistent interface across all query hooks
 */
export function transformQueryResult<T>(
  result: UseQueryResult<T, Error>
): QueryResponse<T> {
  return {
    data: result.data,
    isLoading: result.isLoading,
    isError: result.isError,
    error: result.error,
    isSuccess: result.isSuccess,
    isFetching: result.isFetching,
    refetch: result.refetch,
  };
}

/**
 * Transform UseMutationResult to MutationResponse
 * Ensures consistent interface across all mutation hooks
 */
export function transformMutationResult<TData, TVariables>(
  result: UseMutationResult<TData, Error, TVariables>
): MutationResponse<TData, TVariables> {
  return {
    mutate: result.mutate,
    mutateAsync: result.mutateAsync,
    isPending: result.isPending,
    isError: result.isError,
    error: result.error,
    isSuccess: result.isSuccess,
    data: result.data,
    reset: result.reset,
  };
}

/**
 * Extract hook state for UI components
 * Simplifies state management in Atoms/Molecules/Organisms
 */
export function extractHookState<T>(
  data: T | undefined,
  isLoading: boolean,
  isError: boolean,
  isSuccess: boolean,
  isFetching?: boolean
): HookState {
  const isEmpty = isSuccess && (!data || (Array.isArray(data) && data.length === 0));
  
  return {
    isLoading,
    isError,
    isSuccess,
    isEmpty,
    isRefetching: isFetching && !isLoading,
  };
}

/**
 * Create component props from query result
 * Simplifies passing data to components
 */
export function createComponentProps<T>(
  result: UseQueryResult<T, Error>
): ComponentDataProps<T> {
  return {
    data: result.data,
    state: extractHookState(
      result.data,
      result.isLoading,
      result.isError,
      result.isSuccess,
      result.isFetching
    ),
    error: result.error,
    refetch: result.refetch,
  };
}

// ============ HOOK COMPOSITION UTILITIES ============

/**
 * Compose multiple query results
 * Useful for components that need data from multiple sources
 */
export function composeQueryStates(...states: HookState[]): HookState {
  return {
    isLoading: states.some(s => s.isLoading),
    isError: states.some(s => s.isError),
    isSuccess: states.every(s => s.isSuccess),
    isEmpty: states.every(s => s.isEmpty),
    isRefetching: states.some(s => s.isRefetching),
  };
}

/**
 * Check if any query is loading
 */
export function isAnyLoading(...results: UseQueryResult<any, Error>[]): boolean {
  return results.some(r => r.isLoading);
}

/**
 * Check if any query has error
 */
export function hasAnyError(...results: UseQueryResult<any, Error>[]): boolean {
  return results.some(r => r.isError);
}

/**
 * Get first error from multiple queries
 */
export function getFirstError(...results: UseQueryResult<any, Error>[]): Error | null {
  const errorResult = results.find(r => r.isError);
  return errorResult?.error || null;
}

// ============ PAGINATION UTILITIES ============

/**
 * Pagination State Interface
 */
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Extract pagination state from list response
 */
export function extractPaginationState<T>(
  response: ListResponse<T> | undefined
): PaginationState | null {
  if (!response) return null;
  
  return {
    page: response.page,
    limit: response.items.length,
    total: response.total,
    totalPages: response.totalPages,
    hasNext: response.hasMore,
    hasPrev: response.page > 1,
  };
}

// ============ ERROR HANDLING UTILITIES ============

/**
 * Standard Error Response
 */
export interface ErrorResponse {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
}

/**
 * Extract error message for display
 */
export function getErrorMessage(error: Error | null): string {
  if (!error) return '';
  
  // Check if it's our custom error format
  const customError = error as any;
  if (customError.message) return customError.message;
  
  return 'An unexpected error occurred';
}

/**
 * Extract field errors for forms
 */
export function getFieldErrors(error: Error | null): Record<string, string[]> {
  if (!error) return {};
  
  const customError = error as any;
  return customError.errors || {};
}

// ============ LOADING STATE UTILITIES ============

/**
 * Loading State Types
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Get loading state from hook state
 */
export function getLoadingState(state: HookState): LoadingState {
  if (state.isLoading) return 'loading';
  if (state.isError) return 'error';
  if (state.isSuccess) return 'success';
  return 'idle';
}

// ============ OPTIMISTIC UPDATE UTILITIES ============

/**
 * Optimistic Update Context
 */
export interface OptimisticContext<T> {
  previousData: T | undefined;
  rollback: () => void;
}

/**
 * Create optimistic update context
 */
export function createOptimisticContext<T>(
  previousData: T | undefined,
  rollback: () => void
): OptimisticContext<T> {
  return {
    previousData,
    rollback,
  };
}

// ============ TYPE GUARDS ============

/**
 * Check if response is a list response
 */
export function isListResponse<T>(data: any): data is ListResponse<T> {
  return (
    data &&
    Array.isArray(data.items) &&
    typeof data.total === 'number' &&
    typeof data.page === 'number'
  );
}

/**
 * Check if data is empty
 */
export function isEmpty<T>(data: T | undefined): boolean {
  if (!data) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (typeof data === 'object') return Object.keys(data).length === 0;
  return false;
}

// ============ EXPORT ALL ============

export type {
  UseQueryResult,
  UseMutationResult,
  UseQueryOptions,
};
