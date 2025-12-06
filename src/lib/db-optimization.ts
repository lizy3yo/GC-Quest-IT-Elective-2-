/*
 * Database Query Optimization Utilities
 * 
 * This module provides utilities for optimizing MongoDB queries
 * in a Vercel serverless environment.
 */

import mongoose from 'mongoose';

/**
 * Query optimization options
 */
export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: Record<string, 1 | -1>;
  select?: string | string[];
  lean?: boolean;
  populate?: string | string[];
}

/**
 * Default query limits to prevent large data transfers
 */
export const DEFAULT_LIMITS = {
  LIST: 50,
  SEARCH: 20,
  FEED: 30,
  NOTIFICATIONS: 50,
  SUBMISSIONS: 100,
  MAX: 500,
};

/**
 * Apply standard optimizations to a query
 * - Always use .lean() for read-only operations (faster, returns plain JS objects)
 * - Apply sensible limits
 * - Use projection to select only needed fields
 */
export function optimizeQuery<T>(
  query: any,
  options: QueryOptions = {}
): any {
  const {
    limit = DEFAULT_LIMITS.LIST,
    skip = 0,
    sort,
    select,
    lean = true,
    populate,
  } = options;

  // Apply limit (prevent unbounded queries)
  if (limit && limit > 0) {
    query = query.limit(Math.min(limit, DEFAULT_LIMITS.MAX));
  }

  // Apply skip for pagination
  if (skip && skip > 0) {
    query = query.skip(skip);
  }

  // Apply sorting
  if (sort) {
    query = query.sort(sort);
  }

  // Apply field selection (projection)
  if (select) {
    query = query.select(select);
  }

  // Use lean for better performance (returns plain objects)
  if (lean) {
    query = query.lean();
  }

  // Apply population if needed
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((p) => {
        query = query.populate(p);
      });
    } else {
      query = query.populate(populate);
    }
  }

  return query;
}

/**
 * Pagination helper
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Execute a paginated query with optimizations
 */
export async function paginatedQuery<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T>,
  params: PaginationParams & Omit<QueryOptions, 'limit' | 'skip'> = {}
): Promise<PaginationResult<T>> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(params.limit || DEFAULT_LIMITS.LIST, DEFAULT_LIMITS.MAX);
  const skip = (page - 1) * limit;

  // Execute count and find in parallel
  const [total, data] = await Promise.all([
    model.countDocuments(filter),
    optimizeQuery(model.find(filter), {
      ...params,
      limit,
      skip,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: data as T[],
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Batch operations helper to reduce database round trips
 */
export async function batchFindByIds<T>(
  model: mongoose.Model<T>,
  ids: string[],
  options: Omit<QueryOptions, 'limit'> = {}
): Promise<T[]> {
  if (ids.length === 0) return [];

  // Remove duplicates
  const uniqueIds = [...new Set(ids)];

  return optimizeQuery(
    model.find({ _id: { $in: uniqueIds } } as any),
    options
  ) as any;
}

/**
 * Check if a query is using an index
 * Use this in development to verify query performance
 */
export async function explainQuery(
  query: any
): Promise<any> {
  return query.explain('executionStats');
}

/**
 * Log slow queries for monitoring
 */
export function logSlowQuery(
  operation: string,
  duration: number,
  threshold: number = 1000
): void {
  if (duration > threshold) {
    console.warn(`⚠️ Slow query detected: ${operation} took ${duration}ms`);
  }
}

/**
 * Measure query execution time
 */
export async function measureQuery<T>(
  operation: string,
  queryFn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await queryFn();
    const duration = Date.now() - start;
    logSlowQuery(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`❌ Query failed: ${operation} (${duration}ms)`, error);
    throw error;
  }
}

/**
 * Aggregate with optimization hints
 */
export function optimizeAggregate<T>(
  model: mongoose.Model<T>,
  pipeline: any[],
  options: { allowDiskUse?: boolean; maxTimeMS?: number } = {}
): mongoose.Aggregate<any[]> {
  return model.aggregate(pipeline).option({
    allowDiskUse: options.allowDiskUse ?? false,
    maxTimeMS: options.maxTimeMS ?? 30000, // 30 second timeout
  });
}

/**
 * Common query patterns with built-in optimizations
 */
export const QueryPatterns = {
  /**
   * Find recent items for a user
   */
  findRecent: <T>(
    model: mongoose.Model<T>,
    userId: string,
    limit: number = DEFAULT_LIMITS.LIST
  ) => {
    return optimizeQuery(model.find({ userId } as any), {
      limit,
      sort: { createdAt: -1 },
    });
  },

  /**
   * Find active items
   */
  findActive: <T>(
    model: mongoose.Model<T>,
    filter: mongoose.FilterQuery<T> = {}
  ) => {
    return optimizeQuery(
      model.find({
        ...filter,
        archived: { $ne: true },
      } as any),
      { sort: { createdAt: -1 } }
    );
  },

  /**
   * Find by IDs efficiently
   */
  findByIds: <T>(model: mongoose.Model<T>, ids: string[]) => {
    return batchFindByIds(model, ids);
  },
};

/**
 * Index verification helper
 * Use in development to check if indexes are being used
 */
export async function verifyIndexUsage(
  query: any
): Promise<{ usesIndex: boolean; indexName?: string; executionTimeMs: number }> {
  const explanation = await explainQuery(query);
  const stats = explanation.executionStats;
  
  const usesIndex = stats.executionStages?.stage !== 'COLLSCAN';
  const indexName = stats.executionStages?.indexName;
  const executionTimeMs = stats.executionTimeMillis;

  if (!usesIndex) {
    console.warn('⚠️ Query is not using an index (COLLSCAN detected)');
  }

  return {
    usesIndex,
    indexName,
    executionTimeMs,
  };
}
