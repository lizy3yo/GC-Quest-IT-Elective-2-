/*
 * Copyright 2025 Kharl Ryan M. De Jesus
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//NODE MODULES
import { NextRequest, NextResponse } from 'next/server';

//CUSTOM MODULES
import { connectToDatabase } from '@/lib/mongoose';
import Class from '@/models/class';
import User from '@/models/user';

/**
 * POST /api/teacher_page/class/seed
 * Developer endpoint to seed classes with teachers and students
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = await request.json();
    const { classes } = body;

    if (!classes || !Array.isArray(classes)) {
      return NextResponse.json(
        { error: 'Missing classes array' },
        { status: 400 }
      );
    }

    const results = [];

    for (const classData of classes) {
      const {
        name,
        program,
        yearLevel,
        classcode,
        day,
        time,
        room,
        teacherEmail,
        studentEmails = [],
        maxStudents,
        settings = {}
      } = classData;

      // Validate required fields
      if (!name || !program || !yearLevel || !teacherEmail) {
        results.push({
          error: `Missing required fields for class: ${name || 'Unknown'}`,
          classData
        });
        continue;
      }

      // Find teacher by email
      const teacher = await User.findOne({ 
        email: teacherEmail, 
        role: 'teacher' 
      }).select('_id firstName lastName email').lean() as any;

      if (!teacher) {
        results.push({
          error: `Teacher not found with email: ${teacherEmail}`,
          classData
        });
        continue;
      }

      // Find students by emails
      const students = await User.find({
        email: { $in: studentEmails },
        role: 'student'
      }).select('_id firstName lastName email').lean() as any[];

      if (studentEmails.length > 0 && students.length === 0) {
        results.push({
          warning: `No students found for emails: ${studentEmails.join(', ')}`,
          classData
        });
      }

      // Check if class already exists for this teacher
      const existingClass = await Class.findOne({
        name,
        teacherId: teacher._id.toString()
      });

      if (existingClass) {
        results.push({
          warning: `Class "${name}" already exists for teacher ${teacherEmail}`,
          classId: existingClass._id
        });
        continue;
      }

      // Create new class
      const newClass = new Class({
        name,
        courseYear: `${program[1]} - ${yearLevel}`, // e.g., "BSIT - 3rd Year"
        subject: name, // Use class name as subject
        description: `${name} for ${program[0]} students`,
        teacherId: teacher._id.toString(),
        classCode: `GC${classcode}`, // Prefix with "GC" to meet 6+ char requirement
        maxStudents,
        day, // Schedule day(s)
        time, // Schedule time
        room, // Schedule room
        settings: {
          allowStudentPosts: true,
          moderateStudentPosts: false,
          allowLateSubmissions: true,
          notifyOnNewStudent: true,
          ...settings
        }
      });

      // Add students to class
      for (const student of students) {
        newClass.addStudent(student._id.toString());
      }

      await newClass.save();

      results.push({
        success: true,
        classId: newClass._id,
        className: newClass.name,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        classCode: newClass.classCode,
        studentsAdded: students.length,
        studentDetails: students.map((s: any) => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          email: s.email
        }))
      });
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${classes.length} classes`,
      results
    }, { status: 201 });

  } catch (error) {
    console.error('Error seeding classes:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}