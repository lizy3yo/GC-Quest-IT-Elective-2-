import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import User from '@/models/user';

// Helper function to generate emails
function generateEmail(role: 'teacher' | 'student' | 'parent', firstName: string, lastName: string, studentNumber?: string): string {
  const currentYear = new Date().getFullYear();
  
  if (role === 'teacher') {
    // Format: firstname.lastname@gordoncollege.edu.ph
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    return `${cleanFirst}.${cleanLast}@gordoncollege.edu.ph`;
  } else if (role === 'student') {
    // Format: lastname.NNNNN@gordoncollege.edu.ph
    if (studentNumber && studentNumber.match(/^\d{9}$/)) {
      const last5 = studentNumber.slice(-5);
      const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
      return `${cleanLast}.${last5}@gordoncollege.edu.ph`;
    }
    // Generate new student number
    const sequentialNumber = String(Math.floor(Math.random() * 100000)).padStart(5, '0');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    return `${cleanLast}.${sequentialNumber}@gordoncollege.edu.ph`;
  } else if (role === 'parent') {
    // Format: Flastname.NNNNN@gordoncollege.edu.ph
    const firstLetter = firstName.charAt(0).toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    const last5 = studentNumber ? studentNumber.slice(-5) : '00000';
    return `${firstLetter}${cleanLast}.${last5}@gordoncollege.edu.ph`;
  }
  
  return '';
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    // Get all users
    const teachers = await User.find({ role: 'teacher' }).lean();
    const students = await User.find({ role: 'student' }).lean();

    const emailList = [];

    // Generate teacher emails
    for (const teacher of teachers) {
      const generatedEmail = generateEmail('teacher', teacher.firstName, teacher.lastName);
      emailList.push({
        userId: teacher._id.toString(),
        name: `${teacher.firstName} ${teacher.lastName}`,
        role: 'teacher',
        generatedEmail,
      });
    }

    // Generate student emails
    for (const student of students) {
      const currentYear = new Date().getFullYear();
      const studentNumber = student.username.match(/^\d{9}$/) 
        ? student.username 
        : `${currentYear}${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
      
      const generatedEmail = generateEmail('student', student.firstName, student.lastName, studentNumber);
      emailList.push({
        userId: student._id.toString(),
        name: `${student.firstName} ${student.lastName}`,
        role: 'student',
        studentNumber,
        generatedEmail,
      });

      // Generate parent email for each student
      const parentEmail = generateEmail('parent', student.firstName, student.lastName, studentNumber);
      emailList.push({
        userId: `parent-${student._id.toString()}`,
        name: `Parent of ${student.firstName} ${student.lastName}`,
        role: 'parent',
        studentNumber,
        generatedEmail: parentEmail,
      });
    }

    return NextResponse.json({
      success: true,
      data: { emails: emailList }
    });
  } catch (error) {
    console.error('Error generating emails:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate emails' },
      { status: 500 }
    );
  }
}
