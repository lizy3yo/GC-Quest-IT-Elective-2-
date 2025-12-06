import { connectToDatabase } from '@/lib/mongoose';
import Activity from '@/models/activity';
import { Types } from 'mongoose';

interface LogParams {
  userId: string;
  type: string;
  action: string;
  meta?: any;
  progress?: number;
}

export async function logActivity({ userId, type, action, meta, progress }: LogParams) {
  try {
    await connectToDatabase();
    // Create activity entry; keep errors non-fatal so main flows aren't broken
    // Ensure user is stored as ObjectId for consistent querying
    const userObjectId = Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId;
    await Activity.create({ user: userObjectId, type, action, meta, progress });
  } catch (err) {
    // Fail silently but log to console for debugging
    // Do not throw so callers can continue normally
    // eslint-disable-next-line no-console
    console.error('Failed to log activity', err);
  }
}

export default logActivity;
