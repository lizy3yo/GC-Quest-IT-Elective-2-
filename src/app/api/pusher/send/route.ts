import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

// Initialize Pusher server instance
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

/**
 * API route to send messages via Pusher
 * This is used by the client to send messages through Pusher
 */
export async function POST(request: NextRequest) {
  try {
    const { type, payload, channel = 'notifications' } = await request.json();

    // Trigger the event on Pusher
    await pusher.trigger(channel, type, payload);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Pusher API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
