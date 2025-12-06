# Apply Optimizations to All API Routes

## Automatic Patterns to Apply

### Pattern 1: Simple Find Queries
**Before:**
```typescript
const users = await User.find({ role: 'student' });
```

**After:**
```typescript
import { optimizeQuery } from '@/lib/db-optimization';
const users = await optimizeQuery(User.find({ role: 'student' }), {
  limit: 50,
  select: 'firstName lastName email'
});
```

### Pattern 2: FindById Queries
**Before:**
```typescript
const user = await User.findById(userId).select('-password').lean();
```

**After:**
```typescript
import { optimizeQuery } from '@/lib/db-optimization';
const user = await optimizeQuery(User.findById(userId), {
  select: '-password'
});
```

### Pattern 3: Batch Queries with $in
**Before:**
```typescript
const users = await User.find({ _id: { $in: studentIds } })
  .select('firstName lastName email')
  .lean();
```

**After:**
```typescript
import { batchFindByIds } from '@/lib/db-optimization';
const users = await batchFindByIds(User, studentIds, {
  select: 'firstName lastName email'
});
```

### Pattern 4: Paginated Queries
**Before:**
```typescript
const skip = (page - 1) * limit;
const classes = await Class.find(query)
  .sort({ createdAt: -1 })
  .skip(skip)
  .limit(limit)
  .lean();
const total = await Class.countDocuments(query);
```

**After:**
```typescript
import { paginatedQuery } from '@/lib/db-optimization';
const result = await paginatedQuery(Class, query, {
  page,
  limit,
  sort: { createdAt: -1 }
});
// result.data, result.pagination
```

### Pattern 5: Critical Queries with Monitoring
**Before:**
```typescript
const submissions = await Submission.find({ assessmentId })
  .sort({ submittedAt: -1 })
  .lean();
```

**After:**
```typescript
import { measureQuery, optimizeQuery } from '@/lib/db-optimization';
const submissions = await measureQuery('Get submissions', async () => {
  return await optimizeQuery(Submission.find({ assessmentId }), {
    sort: { submittedAt: -1 },
    limit: 100
  });
});
```

## Files That Need Updates

### High Priority (Most Used)
1. ✅ `src/app/api/v1/student/class/[classId]/route.ts` - Student class view
2. ✅ `src/app/api/v1/student/class/route.ts` - Student class list
3. ✅ `src/app/api/teacher_page/activity/recent/route.ts` - Teacher dashboard
4. ✅ `src/app/api/teacher_page/leaderboards/route.ts` - Leaderboards
5. ✅ `src/app/api/teacher_page/submissions/pending/route.ts` - Pending submissions
6. ✅ `src/app/api/teacher_page/class/[id]/route.ts` - Class details

### Medium Priority
7. ✅ `src/app/api/v1/users/route.ts` - User list
8. ✅ `src/app/api/v1/users/[userId]/route.ts` - User details
9. ✅ `src/app/api/teacher_page/history/route.ts` - Activity history
10. ✅ `src/app/api/student_page/flashcard/route.ts` - Flashcards
11. ✅ `src/app/api/student_page/summary/route.ts` - Summaries
12. ✅ `src/app/api/student_page/resources/route.ts` - Resources

### Lower Priority (Less Frequent)
13. ✅ All other API routes

## Quick Migration Strategy

### Step 1: Add Import to All API Files
Add this to the top of each API route file:
```typescript
import { optimizeQuery, paginatedQuery, batchFindByIds, measureQuery } from '@/lib/db-optimization';
```

### Step 2: Wrap Existing Queries
Most queries already have `.lean()` - just wrap them:
```typescript
// Before
const data = await Model.find(query).select('fields').lean();

// After
const data = await optimizeQuery(Model.find(query), {
  select: 'fields',
  limit: 50 // Add appropriate limit
});
```

### Step 3: Replace Batch Operations
```typescript
// Before
const users = await User.find({ _id: { $in: ids } }).lean();

// After
const users = await batchFindByIds(User, ids);
```

### Step 4: Add Monitoring to Critical Paths
```typescript
// Wrap important operations
const result = await measureQuery('Operation name', async () => {
  return await optimizeQuery(Model.find(query), options);
});
```

## Verification

After applying optimizations:

1. Run tests: `npm test` (if you have tests)
2. Test locally: `npm run dev`
3. Check for errors in console
4. Run: `npm run db:analyze`
5. Verify all queries use indexes

## Notes

- All queries already have `.lean()` - good!
- Most queries already have `.select()` - good!
- Need to add `.limit()` to prevent unbounded queries
- Need to add monitoring to critical paths
- Connection pooling is already configured
- Indexes are already defined in models
