import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { firstName, lastName } = body;

    // Validate input
    if (!firstName || !lastName) {
      return NextResponse.json(
        { success: false, error: 'First name and last name are required' },
        { status: 400 }
      );
    }

    // Generate email with firstname.lastname format
    const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const last = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const email = `${first}.${last}@gordoncollege.edu.ph`;
    const username = `${first}.${last}`;

    // Generate password
    const cleanLast = lastName.replace(/[^a-zA-Z]/g, '');
    const lastCapitalized = cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase();
    const password = `${lastCapitalized}@1234`;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email or username already exists' },
        { status: 409 }
      );
    }

    // Create new teacher
    const newTeacher = new User({
      username,
      email,
      password, // Will be hashed by the pre-save hook
      role: 'teacher',
      firstName,
      lastName,
    });

    await newTeacher.save();

    // Generate and send verification email
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    newTeacher.verificationCode = verificationCode;
    newTeacher.verificationCodeExpiry = expiryTime;
    newTeacher.emailVerified = false;
    await newTeacher.save();

    // Send verification email (import at top of file)
    const { sendVerificationEmail } = await import('@/lib/email');
    await sendVerificationEmail(email, verificationCode, firstName);

    return NextResponse.json({
      success: true,
      data: {
        id: newTeacher._id.toString(),
        name: `${firstName} ${lastName}`,
        email,
        password, // Return plain password for display (only this once)
        role: 'teacher'
      }
    });
  } catch (error) {
    console.error('Error creating teacher account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create teacher account' },
      { status: 500 }
    );
  }
}
