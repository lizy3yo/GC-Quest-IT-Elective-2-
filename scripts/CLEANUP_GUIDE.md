# Database Resource Cleanup Guide

This guide explains how to clean up and reduce the amount of data stored in your MongoDB database, specifically focusing on resource files (PDFs, images, videos, documents).

## Available Cleanup Scripts

### 1. cleanup-resources.js (Recommended)
**Purpose:** Intelligently delete old or unused resource files from the database.

**Features:**
- Delete resources older than X days
- Filter by file type (PDF, images, videos, documents)
- Find and delete unused resources (not referenced anywhere)
- Dry-run mode to preview what will be deleted
- Shows size savings before deletion

**Usage Examples:**

```bash
# Preview what would be deleted (older than 90 days) - SAFE
node scripts/cleanup-resources.js --dry-run

# Delete resources older than 180 days
node scripts/cleanup-resources.js --older-than=180

# Delete only PDF files older than 60 days
node scripts/cleanup-resources.js --type=pdf --older-than=60

# Delete only image files older than 30 days
node scripts/cleanup-resources.js --type=image --older-than=30

# Find and delete unused resources (not referenced by any document)
node scripts/cleanup-resources.js --unused --dry-run

# Combine options: delete old unused images
node scripts/cleanup-resources.js --type=image --older-than=90 --unused --dry-run
```

**Options:**
- `--dry-run` - Preview only, don't delete anything (ALWAYS USE THIS FIRST!)
- `--older-than=DAYS` - Delete resources older than X days (default: 90)
- `--type=TYPE` - Filter by type: `all`, `pdf`, `image`, `video`, `document`
- `--unused` - Only delete resources not referenced by any collection
- `--help` - Show help message

### 2. clear-resources.js
**Purpose:** Delete ALL resources from the database.

⚠️ **WARNING:** This deletes everything! Use with extreme caution.

```bash
node scripts/clear-resources.js
```

## Recommended Cleanup Strategy

### Step 1: Analyze Current Usage
```bash
# See what resources exist and how old they are
node scripts/cleanup-resources.js --dry-run
```

### Step 2: Clean Up Unused Resources
```bash
# First, preview unused resources
node scripts/cleanup-resources.js --unused --dry-run

# If satisfied, delete them
node scripts/cleanup-resources.js --unused
```

### Step 3: Clean Up Old Resources by Type
```bash
# Delete old images (older than 60 days)
node scripts/cleanup-resources.js --type=image --older-than=60 --dry-run
node scripts/cleanup-resources.js --type=image --older-than=60

# Delete old PDFs (older than 90 days)
node scripts/cleanup-resources.js --type=pdf --older-than=90 --dry-run
node scripts/cleanup-resources.js --type=pdf --older-than=90

# Delete old videos (older than 30 days)
node scripts/cleanup-resources.js --type=video --older-than=30 --dry-run
node scripts/cleanup-resources.js --type=video --older-than=30
```

### Step 4: Regular Maintenance
Set up a monthly cleanup routine:

```bash
# Every month, delete resources older than 180 days
node scripts/cleanup-resources.js --older-than=180

# Every month, delete unused resources
node scripts/cleanup-resources.js --unused
```

## Safety Tips

1. **Always use --dry-run first** to preview what will be deleted
2. **Backup your database** before running cleanup scripts
3. **Start with longer time periods** (e.g., 180 days) and gradually reduce
4. **Test on a development database** first
5. **Monitor your application** after cleanup to ensure nothing breaks

## MongoDB Backup Command

Before running cleanup, backup your database:

```bash
# Backup entire database
mongodump --uri="your_mongodb_uri" --out=./backup

# Backup only resources collection
mongodump --uri="your_mongodb_uri" --collection=resources --out=./backup
```

## Restore if Needed

If something goes wrong, restore from backup:

```bash
# Restore entire database
mongorestore --uri="your_mongodb_uri" ./backup

# Restore only resources collection
mongorestore --uri="your_mongodb_uri" --collection=resources ./backup/your_db_name/resources.bson
```

## Expected Results

Depending on your usage, you can expect:

- **Unused resources cleanup:** 10-30% reduction
- **Old resources cleanup (90+ days):** 20-50% reduction
- **Old images cleanup:** 30-60% reduction (images are usually the largest)
- **Combined cleanup:** 40-70% total reduction

## Monitoring Storage Usage

After cleanup, monitor your MongoDB storage:

```javascript
// In MongoDB shell or Compass
db.resources.stats()
// Look at 'size' and 'storageSize' fields
```

## Troubleshooting

**Q: Script says "No resources to delete"**
- Your resources might be newer than the cutoff date
- Try increasing the `--older-than` value
- Check if resources exist: `db.resources.countDocuments({})`

**Q: How do I know if a resource is safe to delete?**
- Use `--unused` flag to only delete unreferenced resources
- Use `--dry-run` to preview before deleting
- Start with very old resources (180+ days)

**Q: Can I undo a deletion?**
- No, deletions are permanent
- Always backup before cleanup
- Always use `--dry-run` first

## Automation (Optional)

Create a cron job for automatic monthly cleanup:

```bash
# Add to crontab (runs on 1st of each month at 2 AM)
0 2 1 * * cd /path/to/your/app && node scripts/cleanup-resources.js --older-than=180 >> /var/log/resource-cleanup.log 2>&1
```

## Support

If you encounter issues:
1. Check the error message
2. Verify your MongoDB connection
3. Ensure you have proper permissions
4. Try with `--dry-run` first
5. Check MongoDB logs
