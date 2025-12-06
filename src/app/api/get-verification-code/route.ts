import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

// WARNING: This is for development/testing only!
// Never use this in production as it exposes verification codes
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({
      success: false,
      message: 'This endpoint is not available in production'
    }, { status: 403 });
  }

  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email parameter is required'
      }, { status: 400 });
    }

    const user = await User.findOne({ email }).select('email emailVerificationToken emailVerificationExpires');
    
    if (!user || !user.emailVerificationToken) {
      return NextResponse.json({
        success: false,
        message: 'No verification token found for this user'
      });
    }

    // Since we can't reverse the hash, we'll generate codes and check which one matches
    // This is only for testing purposes
    let foundCode = null;
    for (let i = 100000; i <= 999999; i++) {
      const testCode = i.toString();
      const hashedTestCode = crypto.createHash('sha256').update(testCode).digest('hex');
      if (hashedTestCode === user.emailVerificationToken) {
        foundCode = testCode;
        break;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'This is for testing only - check your email for the actual code',
      debug: {
        email: user.email,
        hasToken: !!user.emailVerificationToken,
        expires: user.emailVerificationExpires,
        isExpired: user.emailVerificationExpires ? new Date() > user.emailVerificationExpires : null,
        // Don't expose the actual code in production
        hint: foundCode ? `Code starts with ${foundCode.substring(0, 2)}****` : 'Code not found in range'
      }
    });

  } catch (error) {
    console.error('Get verification code error:', error);
    return NextResponse.json({
      success: false,
      message: 'Error getting verification code',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}