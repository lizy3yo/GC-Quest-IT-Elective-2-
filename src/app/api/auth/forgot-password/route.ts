import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import { sendEmail, generatePasswordResetEmailHTML, generatePasswordResetEmailText } from '@/lib/email';

// Generate 6-digit reset code
function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  console.log('\n=== FORGOT PASSWORD REQUEST ===');
  
  try {
    await connectToDatabase();

    const body = await request.json();
    const { email } = body;
    console.log('Email:', email);

    if (!email) {
      console.log('❌ No email provided');
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', user.email);

    // Generate reset code
    const resetCode = generateResetCode();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    console.log('✅ Reset code generated:', resetCode);

    // Update user with reset code
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpiry = expiryTime;
    await user.save();
    console.log('✅ Reset code saved to database');

    // Send password reset email
    console.log('📧 Sending password reset email...');
    const emailSent = await sendEmail({
      to: user.email,
      subject: 'Password Reset Request - GC Quest',
      html: generatePasswordResetEmailHTML(resetCode, user.firstName || 'User'),
      text: generatePasswordResetEmailText(resetCode, user.firstName || 'User')
    });

    if (!emailSent) {
      console.error('❌ Failed to send password reset email');
    } else {
      console.log('✅ Password reset email sent successfully');
    }

    console.log('=== END FORGOT PASSWORD ===\n');

    return NextResponse.json({
      success: true,
      message: 'Password reset code has been sent.',
      data: {
        expiresIn: 15 // minutes
      }
    });
  } catch (error: any) {
    console.error('❌ Error in forgot password:', error.message);
    console.log('=== END FORGOT PASSWORD (ERROR) ===\n');
    return NextResponse.json(
      { success: false, message: 'Failed to process password reset request' },
      { status: 500 }
    );
  }
}
