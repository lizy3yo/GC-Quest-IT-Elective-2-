import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { Summary } from '@/models/summary';
import { InternalSummaryGenerator } from '@/lib/ai/internal-summary-generator';
import Class, { IClass, IResource, IClassStudent } from '@/models/class';
import User from '@/models/user';
import { Types } from 'mongoose';
import { logActivity } from '@/lib/activity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({
        success: false,
        error: 'Valid user ID is required'
      }, { status: 400 });
    }

    const body = await request.json();
    const { 
      classId,
      resourceId,
      title, 
      summaryType = 'detailed',
      maxLength = 350,
      isPublic = false
    } = body;

    if (!classId || !resourceId) {
      return NextResponse.json({
        success: false,
        error: 'Class ID and Resource ID are required'
      }, { status: 400 });
    }

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    // Find the class and verify student access
    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      return NextResponse.json({
        success: false,
        error: 'Class not found'
      }, { status: 404 });
    }

    // Check if user is enrolled in the class
    const isEnrolled = classDoc.students.some(
      (student: IClassStudent) => student.studentId === userId && student.status === 'active'
    );

    if (!isEnrolled) {
      return NextResponse.json({
        success: false,
        error: 'You are not enrolled in this class'
      }, { status: 403 });
    }

    // Find the specific resource
    const resource = classDoc.resources.find((res: IResource) => res.id === resourceId);
    if (!resource) {
      return NextResponse.json({
        success: false,
        error: 'Resource not found in class'
      }, { status: 404 });
    }

    // Check if resource has a valid URL
    if (!resource.url) {
      return NextResponse.json({
        success: false,
        error: 'Resource file is not accessible'
      }, { status: 400 });
    }

    logger.info('Starting class file summary generation', {
      userId,
      classId,
      resourceId,
      resourceName: resource.name,
      resourceType: resource.type
    });

    // Extract text content from the resource
    let textContent: string = '';

    // Check if it's a text file that we can process directly
    if (resource.type && (resource.type.includes('text') || resource.type.includes('txt'))) {
      try {
        const response = await fetch(resource.url);
        if (response.ok) {
          textContent = await response.text();
          logger.info('Successfully extracted text from class text file', { 
            contentLength: textContent.length 
          });
        }
      } catch (error) {
        logger.error('Failed to extract text from class text file', { error });
      }
    } else if (resource.type && (resource.type.includes('pdf') || resource.type.includes('application/pdf'))) {
      // For PDF files, try to extract text directly
      try {
        logger.info('Attempting to extract text from class PDF file');
        
        // Import pdf-parse
        const pdfParse = (await import('pdf-parse')).default;
        
        // Fetch the PDF file
        const response = await fetch(resource.url);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Parse PDF
          const pdfData = await pdfParse(buffer);
          textContent = pdfData.text;
          
          logger.info('Successfully extracted text from class PDF', { 
            contentLength: textContent.length,
            pages: pdfData.numpages
          });
        }
      } catch (error) {
        logger.error('Failed to extract text from class PDF file', { error });
      }
    }

    // Validate text content
    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json({
        success: false,
        error: 'Could not extract sufficient text content from class file',
        details: `The class file "${resource.name}" could not be processed to extract meaningful content for summary generation. Please ensure the file contains readable text content.`
      }, { status: 400 });
    }

    // Generate summary using AI
    const generator = new InternalSummaryGenerator();
    const result = await generator.generateSummary({
      content: textContent.trim(),
      title: title?.trim() || `${resource.name} - ${classDoc.name}`,
      subject: classDoc.subject,
      summaryType: summaryType as any,
      maxLength
    });

    logger.info('AI generation successful for class file summary', {
      resourceName: resource.name,
      wordCount: result.summary.wordCount,
      compressionRatio: result.compressionRatio
    });

    // Save to database - use custom title if provided, otherwise use AI-generated title
    const finalTitle = title?.trim() || result.summary.title || `${resource.name} - ${classDoc.name}`;
    const summaryDoc = new Summary({
      userId,
      title: finalTitle,
      content: result.summary.content,
      keyPoints: result.summary.keyPoints,
      mainTopics: result.summary.mainTopics,
      wordCount: result.summary.wordCount,
      readingTime: result.summary.readingTime,
      difficulty: result.summary.difficulty,
      subject: result.summary.subject || classDoc.subject,
      summaryType: result.summary.summaryType,
      tags: [
        ...result.summary.tags,
        'class-file',
        classDoc.subject.toLowerCase(),
        classDoc.name.toLowerCase().replace(/\s+/g, '-')
      ],
      confidence: result.summary.confidence,
      originalWordCount: result.originalWordCount,
      compressionRatio: result.compressionRatio,
      sourceType: 'class-file',
      sourceFileName: resource.name,
      isPublic: isPublic,
      metadata: {
        classId: classDoc._id.toString(),
        className: classDoc.name,
        resourceId: resource.id,
        resourceName: resource.name
      }
    });

    const savedSummary = await summaryDoc.save();

    logger.info('Class file summary generation completed', {
      userId,
      classId,
      resourceId,
      summaryId: savedSummary._id,
      wordCount: result.summary.wordCount
    });

    // Log activity
    await logActivity({
      userId: String(userId),
      type: 'summary.generate',
      action: 'generated from class file',
      meta: {
        summaryId: String(savedSummary._id),
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        className: classDoc.name,
        resourceName: resource.name,
        subject: savedSummary.subject
      },
      progress: 100
    });

    return NextResponse.json({
      success: true,
      message: `Successfully generated summary from ${resource.name}`,
      summary: {
        id: savedSummary._id.toString(),
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        compressionRatio: savedSummary.compressionRatio,
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        sourceClass: {
          id: classDoc._id,
          name: classDoc.name,
          subject: classDoc.subject
        },
        sourceResource: {
          id: resource.id,
          name: resource.name,
          type: resource.type
        }
      }
    });

  } catch (error) {
    logger.error('Class file summary generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate summary from class file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
