import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import { sendVerificationEmail } from '@/lib/email';

// Generate 6-digit verification code
function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  console.log('\n=== SEND VERIFICATION EMAIL REQUEST ===');
  
  try {
    console.log('1. Connecting to database...');
    await connectToDatabase();
    console.log('✅ Database connected');

    console.log('2. Parsing request body...');
    const body = await request.json();
    const { email } = body;
    console.log('📧 Email from request:', email);

    if (!email) {
      console.log('❌ No email provided');
      return NextResponse.json(
        { success: false, message: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('3. Looking up user in database...');
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log('❌ User not found:', email);
      return NextResponse.json(
        { success: false, message: 'No account found with this email address' },
        { status: 404 }
      );
    }

    console.log('✅ User found:', {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });

    console.log('4. Generating verification code...');
    const verificationCode = generateVerificationCode();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    console.log('✅ Verification code generated:', verificationCode);

    console.log('5. Saving verification code to database...');
    user.verificationCode = verificationCode;
    user.verificationCodeExpiry = expiryTime;
    await user.save();
    console.log('✅ Verification code saved to database');

    console.log('6. Preparing to send email...');
    console.log('   - To:', user.email);
    console.log('   - Code:', verificationCode);
    console.log('   - Name:', user.firstName || 'User');
    console.log('   - EMAIL_USER:', process.env.EMAIL_USER);
    console.log('   - EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***SET***' : 'NOT SET');

    // Send verification email
    try {
      console.log('7. Calling sendVerificationEmail...');
      const emailSent = await sendVerificationEmail(
        user.email,
        verificationCode,
        user.firstName || 'User'
      );

      if (!emailSent) {
        console.error('❌ Email sending returned false');
        return NextResponse.json(
          { success: false, message: 'Failed to send verification email. Please check email configuration.' },
          { status: 500 }
        );
      }

      console.log('✅ Verification email sent successfully!');
    } catch (emailError: any) {
      console.error('❌ Error sending verification email:');
      console.error('   Error message:', emailError.message);
      console.error('   Error code:', emailError.code);
      console.error('   Full error:', emailError);
      return NextResponse.json(
        { success: false, message: `Failed to send verification email: ${emailError.message}` },
        { status: 500 }
      );
    }

    console.log('8. Returning success response');
    console.log('=== END SEND VERIFICATION ===\n');

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: user.email,
        expiresIn: 15 // minutes
      }
    });
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR in send-verification endpoint:');
    console.error('   Error message:', error.message);
    console.error('   Error stack:', error.stack);
    console.error('=== END SEND VERIFICATION (ERROR) ===\n');
    return NextResponse.json(
      { success: false, message: `Internal server error: ${error.message}` },
      { status: 500 }
    );
  }
}
