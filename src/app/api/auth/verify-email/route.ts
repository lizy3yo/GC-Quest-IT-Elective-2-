import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

export async function POST(request: NextRequest) {
  console.log('\n=== VERIFY EMAIL REQUEST ===');
  
  try {
    await connectToDatabase();

    const body = await request.json();
    const { email, code } = body;
    
    console.log('Request body:', { email, code: code ? '***' : 'missing' });

    if (!email || !code) {
      console.log('❌ Missing email or code');
      return NextResponse.json(
        { success: false, message: 'Email and verification code are required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found:', email);
      return NextResponse.json(
        { success: false, message: 'No account found with this email address' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', user.email);

    // Check if verification code exists
    if (!user.verificationCode) {
      console.log('❌ No verification code in database');
      return NextResponse.json(
        { success: false, message: 'No verification code found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (user.verificationCodeExpiry && user.verificationCodeExpiry < new Date()) {
      console.log('❌ Verification code expired');
      return NextResponse.json(
        { success: false, message: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify the code
    console.log('Comparing codes:', { provided: code, stored: user.verificationCode });
    if (user.verificationCode !== code) {
      console.log('❌ Invalid verification code');
      return NextResponse.json(
        { success: false, message: 'Invalid verification code' },
        { status: 400 }
      );
    }

    console.log('✅ Code verified! Marking email as verified...');

    // Mark email as verified and clear verification code
    user.emailVerified = true;
    user.verificationCode = undefined;
    user.verificationCodeExpiry = undefined;
    await user.save();

    console.log('✅ Email verified successfully');
    console.log('=== END VERIFY EMAIL ===\n');

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        email: user.email,
        verified: true
      }
    });
  } catch (error: any) {
    console.error('❌ Error verifying email:', error.message);
    console.log('=== END VERIFY EMAIL (ERROR) ===\n');
    return NextResponse.json(
      { success: false, message: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
