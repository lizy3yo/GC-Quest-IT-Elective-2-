import { NextResponse } from 'next/server';

/**
 * Diagnostic route to check Pusher credentials
 */
export async function GET() {
  const credentials = {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    secret: process.env.PUSHER_SECRET ? '***' + process.env.PUSHER_SECRET.slice(-4) : 'NOT SET',
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
    secretLength: process.env.PUSHER_SECRET?.length || 0,
  };

  return NextResponse.json({
    message: 'Pusher credentials check',
    credentials,
    allSet: !!(
      process.env.PUSHER_APP_ID &&
      process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.PUSHER_SECRET &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER
    ),
  });
}
