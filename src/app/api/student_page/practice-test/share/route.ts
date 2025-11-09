import { NextRequest, NextResponse } from 'next/server';
import { PracticeTest } from '@/models/practice-test';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * @deprecated This endpoint is deprecated. Practice tests now use isPublic field instead of share links.
 * Users should save tests as public (isPublic=true) to make them available in the public library.
 * This endpoint is kept for backward compatibility only.
 */

// Generate shareable link
export async function POST(req: NextRequest) {
  logger.warn('Share endpoint is deprecated. Use isPublic field instead.');
  
  return NextResponse.json(
    { 
      success: false, 
      error: 'This feature has been deprecated. Please use the public/private library system instead.',
      message: 'Save your practice test as public to share it with others.'
    },
    { status: 410 } // 410 Gone status
  );
}

// Get test by share link
export async function GET(req: NextRequest) {
  logger.warn('Share endpoint GET is deprecated. Check public library instead.');
  
  return NextResponse.json(
    { 
      success: false, 
      error: 'This feature has been deprecated. Please browse the public library instead.',
      message: 'Public practice tests are now available in the public library.'
    },
    { status: 410 } // 410 Gone status
  );
}
