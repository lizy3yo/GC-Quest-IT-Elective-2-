import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';
import bcrypt from 'bcrypt';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { firstName, lastName, studentNumber } = body;

    // Validate input
    if (!firstName || !lastName || !studentNumber) {
      return NextResponse.json(
        { success: false, error: 'First name, last name, and student number are required' },
        { status: 400 }
      );
    }

    if (studentNumber.length !== 5 || !/^\d+$/.test(studentNumber)) {
      return NextResponse.json(
        { success: false, error: 'Student number must be exactly 5 digits' },
        { status: 400 }
      );
    }

    // Generate email with lastname format
    const currentYear = new Date().getFullYear();
    const fullStudentNumber = `${currentYear}${studentNumber}`;
    // Clean and lowercase the last name for email
    const cleanLastName = lastName.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const email = `${cleanLastName}.${studentNumber}@gordoncollege.edu.ph`;
    const username = fullStudentNumber;

    // Generate password
    const cleanLast = lastName.replace(/[^a-zA-Z]/g, '');
    const lastCapitalized = cleanLast.charAt(0).toUpperCase() + cleanLast.slice(1).toLowerCase();
    const password = `${lastCapitalized}@${studentNumber}`;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }, { studentNumber: fullStudentNumber }] 
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'A user with this email, username, or student number already exists' },
        { status: 409 }
      );
    }

    // Create new student
    const newStudent = new User({
      username,
      email,
      password, // Will be hashed by the pre-save hook
      role: 'student',
      firstName,
      lastName,
      studentNumber: fullStudentNumber,
    });

    await newStudent.save();

    // Generate and send verification email
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryTime = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    
    newStudent.verificationCode = verificationCode;
    newStudent.verificationCodeExpiry = expiryTime;
    newStudent.emailVerified = false;
    await newStudent.save();

    // Send verification email
    const { sendVerificationEmail } = await import('@/lib/email');
    await sendVerificationEmail(email, verificationCode, firstName);

    return NextResponse.json({
      success: true,
      data: {
        id: newStudent._id.toString(),
        name: `${firstName} ${lastName}`,
        email,
        password, // Return plain password for display (only this once)
        studentNumber: fullStudentNumber,
        role: 'student'
      }
    });
  } catch (error) {
    console.error('Error creating student account:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create student account' },
      { status: 500 }
    );
  }
}
