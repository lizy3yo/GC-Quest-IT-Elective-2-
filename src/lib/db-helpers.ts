/**
 * Database Helper Functions
 * 
 * These are convenience wrappers that automatically apply optimizations
 * to common database operations. Import these instead of using mongoose directly.
 */

import mongoose from 'mongoose';
import { optimizeQuery, batchFindByIds, DEFAULT_LIMITS } from './db-optimization';

/**
 * Optimized findById with automatic lean and select
 */
export async function findById<T>(
  model: mongoose.Model<T>,
  id: string,
  options: {
    select?: string | string[];
    populate?: string | string[];
  } = {}
): Promise<T | null> {
  return optimizeQuery(model.findById(id), {
    ...options,
    lean: true,
  }) as any;
}

/**
 * Optimized find with automatic limits and lean
 */
export async function find<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T> = {},
  options: {
    limit?: number;
    sort?: Record<string, 1 | -1>;
    select?: string | string[];
    populate?: string | string[];
  } = {}
): Promise<T[]> {
  return optimizeQuery(model.find(filter), {
    limit: options.limit || DEFAULT_LIMITS.LIST,
    sort: options.sort,
    select: options.select,
    populate: options.populate,
    lean: true,
  }) as any;
}

/**
 * Optimized findOne with automatic lean
 */
export async function findOne<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T>,
  options: {
    select?: string | string[];
    populate?: string | string[];
  } = {}
): Promise<T | null> {
  return optimizeQuery(model.findOne(filter), {
    ...options,
    lean: true,
  }) as any;
}

/**
 * Optimized batch find by IDs
 */
export async function findByIds<T>(
  model: mongoose.Model<T>,
  ids: string[],
  options: {
    select?: string | string[];
  } = {}
): Promise<T[]> {
  return batchFindByIds(model, ids, options) as any;
}

/**
 * Find with automatic pagination
 */
export async function findPaginated<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T>,
  page: number = 1,
  limit: number = DEFAULT_LIMITS.LIST,
  options: {
    sort?: Record<string, 1 | -1>;
    select?: string | string[];
  } = {}
) {
  const { paginatedQuery } = await import('./db-optimization');
  return paginatedQuery(model, filter, {
    page,
    limit,
    ...options,
  });
}

/**
 * Count documents (optimized)
 */
export async function count<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T> = {}
): Promise<number> {
  return model.countDocuments(filter);
}

/**
 * Check if document exists
 */
export async function exists<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T>
): Promise<boolean> {
  const doc = await model.findOne(filter).select('_id').lean();
  return !!doc;
}

/**
 * Find recent documents for a user
 */
export async function findRecent<T>(
  model: mongoose.Model<T>,
  userId: string,
  limit: number = DEFAULT_LIMITS.LIST,
  options: {
    select?: string | string[];
    dateField?: string;
  } = {}
): Promise<T[]> {
  const dateField = options.dateField || 'createdAt';
  return find(model, { userId } as any, {
    limit,
    sort: { [dateField]: -1 } as any,
    select: options.select,
  });
}

/**
 * Find active (non-archived) documents
 */
export async function findActive<T>(
  model: mongoose.Model<T>,
  filter: mongoose.FilterQuery<T> = {},
  options: {
    limit?: number;
    sort?: Record<string, 1 | -1>;
    select?: string | string[];
  } = {}
): Promise<T[]> {
  return find(
    model,
    {
      ...filter,
      archived: { $ne: true },
    } as any,
    {
      limit: options.limit || DEFAULT_LIMITS.LIST,
      sort: options.sort || ({ createdAt: -1 } as any),
      select: options.select,
    }
  );
}

/**
 * Aggregate with optimization
 */
export async function aggregate<T>(
  model: mongoose.Model<T>,
  pipeline: any[],
  options: {
    allowDiskUse?: boolean;
    maxTimeMS?: number;
  } = {}
): Promise<any[]> {
  const { optimizeAggregate } = await import('./db-optimization');
  return optimizeAggregate(model, pipeline, options);
}

// Export all for convenience
export default {
  findById,
  find,
  findOne,
  findByIds,
  findPaginated,
  count,
  exists,
  findRecent,
  findActive,
  aggregate,
};
