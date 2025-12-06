import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import bcrypt from 'bcrypt';
import { verifyToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token) as any;

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Find user first to check role
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user is coordinator
    if (user.role !== 'coordinator') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Coordinator access only' },
        { status: 403 }
      );
    }

    const { currentPassword, newPassword } = await request.json();

    // Validate input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    // Validate new password strength
    // Must contain: at least one uppercase, one lowercase, one number, one symbol, and be at least 8 characters
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    
    if (!passwordRegex.test(newPassword)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, one number, and one symbol (@$!%*?&)' 
        },
        { status: 400 }
      );
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Update password (the pre-save hook in the User model will hash it automatically)
    user.password = newPassword;
    await user.save();

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    );
  }
}
