import Pusher from 'pusher';

/**
 * Pusher Server Instance
 * Use this in your API routes to broadcast events
 */
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * Helper function to broadcast to all users in a channel
 * 
 * @example
 * await broadcastToChannel('notifications', 'student:assessment-graded', {
 *   assessmentId,
 *   grade,
 *   feedback
 * });
 */
export async function broadcastToChannel(
  channel: string,
  eventType: string,
  data: any
) {
  try {
    await pusherServer.trigger(channel, eventType, data);
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Broadcast error:', error);
    return { success: false, error };
  }
}

/**
 * Helper function to send to specific user
 * Uses private channels for user-specific messages
 * 
 * @example
 * await sendToUser(studentId, 'student:assessment-graded', {
 *   assessmentId,
 *   grade,
 *   feedback
 * });
 */
export async function sendToUser(
  userId: string,
  eventType: string,
  data: any
) {
  try {
    const channel = `private-user-${userId}`;
    await pusherServer.trigger(channel, eventType, data);
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Send to user error:', error);
    return { success: false, error };
  }
}

/**
 * Helper function to broadcast to multiple channels at once
 * 
 * @example
 * await broadcastToMultipleChannels(
 *   ['notifications', 'teacher-dashboard'],
 *   'teacher:submission-received',
 *   { assessmentId, studentId }
 * );
 */
export async function broadcastToMultipleChannels(
  channels: string[],
  eventType: string,
  data: any
) {
  try {
    await pusherServer.trigger(channels, eventType, data);
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Multi-channel broadcast error:', error);
    return { success: false, error };
  }
}
