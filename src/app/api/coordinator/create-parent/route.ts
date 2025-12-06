import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { firstName, lastName, studentId } = body;

    // Validate input
    if (!firstName || !lastName || !studentId) {
      return NextResponse.json(
        { success: false, error: 'First name, last name, and student selection are required' },
        { status: 400 }
      );
    }

    // Get student to retrieve their student number
    const student = await User.findById(studentId);
    if (!student || student.role !== 'student') {
      return NextResponse.json(
        { success: false, error: 'Invalid student selected' },
        { status: 400 }
      );
    }

    if (!student.studentNumber) {
      return NextResponse.json(
        { success: false, error: 'Selected student does not have a student number' },
        { status: 400 }
      );
    }

    // Generate email with first letter of first name + lastname format
    const last5 = student.studentNumber.slice(-5);
    const firstLetter = firstName.charAt(0).toLowerCase().replace(/[^a-z]/g, '');
    const lastNameClean = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const email = `${firstLetter}${lastNameClean}.${last5}@gordoncollege.edu.ph`;
    const username = `${firstLetter}${lastNameClean}${last5}`;

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

    // Create new parent
    const newParent = new User({
      username,
      email,
      password, // Will be hashed by the pre-save hook
      role: 'parent',
      firstName,
      lastName,
      linkedStudentId: studentId,
    });

    await newParent.save();

    // Generate and send verification email
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    newParent.verificationCode = verificationCode;
    newParent.verificationCodeExpiry = expiryTime;
    newParent.emailVerified = false;
    await newParent.save();

    // Send verification email
    const { sendVerificationEmail } = await import('@/lib/email');
    await sendVerificationEmail(email, verificationCode, firstName);

    return NextResponse.json({
      success: true,
      data: {
        id: newParent._id.toString(),
        name: `${firstName} ${lastName}`,
        email,
        password, // Return plain password for display (only this once)
        role: 'parent',
        linkedStudent: {
          id: student._id.toString(),
          name: `${student.firstName} ${student.lastName}`,
          studentNumber: student.studentNumber
        }
      }
    });
  } catch (error) {
    console.error('Error creating parent account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create parent account' },
      { status: 500 }
    );
  }
}
