import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

export async function POST(request: NextRequest) {
  console.log('\n=== RESET PASSWORD REQUEST ===');
  
  try {
    await connectToDatabase();

    const body = await request.json();
    const { email, code, newPassword } = body;
    
    console.log('Request data:', { 
      email, 
      code: code ? '***' : 'missing', 
      newPassword: newPassword ? '***' : 'missing' 
    });

    if (!email || !code || !newPassword) {
      console.log('❌ Missing required fields');
      return NextResponse.json(
        { success: false, message: 'Email, reset code, and new password are required' },
        { status: 400 }
      );
    }

    // Validate password strength
    console.log('Validating password strength...');
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      console.log('❌ Password does not meet requirements');
      return NextResponse.json(
        { 
          success: false, 
          message: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one symbol (@$!%*?&)' 
        },
        { status: 400 }
      );
    }
    console.log('✅ Password meets requirements');

    // Find user by email
    console.log('Looking up user...');
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found');
      return NextResponse.json(
        { success: false, message: 'Invalid reset code or email' },
        { status: 400 }
      );
    }
    console.log('✅ User found:', user.email);

    // Check if reset code exists
    if (!user.resetPasswordCode) {
      console.log('❌ No reset code found in database');
      return NextResponse.json(
        { success: false, message: 'No password reset request found. Please request a new reset code.' },
        { status: 400 }
      );
    }

    // Check if code has expired
    if (user.resetPasswordExpiry && user.resetPasswordExpiry < new Date()) {
      console.log('❌ Reset code has expired');
      return NextResponse.json(
        { success: false, message: 'Reset code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Verify the code
    console.log('Verifying reset code...');
    console.log('Provided code:', code);
    console.log('Stored code:', user.resetPasswordCode);
    
    if (user.resetPasswordCode !== code) {
      console.log('❌ Invalid reset code');
      return NextResponse.json(
        { success: false, message: 'Invalid reset code' },
        { status: 400 }
      );
    }
    console.log('✅ Reset code verified');

    // Update password and clear reset code
    console.log('Updating password...');
    user.password = newPassword; // Will be hashed by pre-save hook
    user.resetPasswordCode = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();
    console.log('✅ Password updated successfully');
    console.log('=== END RESET PASSWORD ===\n');

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
      data: {
        email: user.email
      }
    });
  } catch (error: any) {
    console.error('❌ Error resetting password:', error.message);
    console.log('=== END RESET PASSWORD (ERROR) ===\n');
    return NextResponse.json(
      { success: false, message: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
