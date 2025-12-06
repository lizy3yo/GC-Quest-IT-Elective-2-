import { NextRequest, NextResponse } from 'next/server';
import { PracticeTestGenerator } from '@/lib/ai/practice-test-generator';
import FlashcardModel from '@/models/flashcard';
import { Summary } from '@/models/summary';
import { connectToDatabase } from '@/lib/mongoose';
import { logger } from '@/lib/winston';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds timeout for AI generation
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Check if this is form data (file upload) or JSON
    const contentType = req.headers.get('content-type') || '';
    const isFormData = contentType.includes('multipart/form-data');
    
    let body: any;
    let uploadedFile: File | null = null;
    
    if (isFormData) {
      const formData = await req.formData();
      uploadedFile = formData.get('file') as File;
      
      // Extract other fields from formData
      body = {
        userId: formData.get('userId') as string,
        source: 'upload',
        maxQuestions: parseInt(formData.get('maxQuestions') as string || '20'),
        includeMultipleChoice: formData.get('includeMultipleChoice') === 'true',
        includeWritten: formData.get('includeWritten') === 'true',
        difficulty: formData.get('difficulty') as string || 'medium',
        timeLimit: parseInt(formData.get('timeLimit') as string || '30'),
        title: formData.get('title') as string,
        subject: formData.get('subject') as string
      };
    } else {
      body = await req.json();
    }
    
    const {
      userId,
      source, // 'flashcards', 'summaries', 'mixed', 'paste', 'upload'
      flashcardIds,
      summaryIds,
      pastedText,
      uploadedText,
      maxQuestions = 20,
      includeMultipleChoice = true,
      includeWritten = true,
      difficulty = 'medium',
      timeLimit = 30,
      title,
      subject
    } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    logger.info('Practice test generation request', {
      userId,
      source,
      flashcardCount: flashcardIds?.length || 0,
      hasText: !!(pastedText || uploadedText)
    });

    // Gather content based on source
    let content = '';
    let testTitle = title;
    let inheritedSubject = '';

    if (source === 'flashcards' && flashcardIds && flashcardIds.length > 0) {
      await connectToDatabase();
      
      const flashcards = await FlashcardModel.find({
        _id: { $in: flashcardIds },
        user: new Types.ObjectId(userId)
      }).lean();

      if (!flashcards || flashcards.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No flashcards found' },
          { status: 404 }
        );
      }

      // Inherit subject from the first flashcard (or most common subject if multiple)
      if (flashcards.length === 1) {
        inheritedSubject = flashcards[0].subject || '';
      } else {
        // Find the most common subject among selected flashcards
        const subjectCounts = flashcards.reduce((acc: any, fc: any) => {
          const subj = fc.subject || 'Uncategorized';
          acc[subj] = (acc[subj] || 0) + 1;
          return acc;
        }, {});
        
        inheritedSubject = Object.entries(subjectCounts)
          .sort((a: any, b: any) => b[1] - a[1])[0][0];
      }

      // Convert flashcards to content
      content = flashcards.map((fc: any) => {
        const cards = fc.cards || [];
        const cardsText = cards.map((c: any) => 
          `Q: ${c.question}\nA: ${c.answer}`
        ).join('\n\n');
        
        return `# ${fc.title}\n${fc.description || ''}\n\n${cardsText}`;
      }).join('\n\n---\n\n');

      if (!testTitle) {
        testTitle = flashcards.length === 1 
          ? `${flashcards[0].title} - Practice Test`
          : `Combined Practice Test`;
      }

      logger.info('Loaded flashcard content', {
        flashcardCount: flashcards.length,
        contentLength: content.length,
        inheritedSubject
      });

    } else if (source === 'paste' && pastedText) {
      content = pastedText;
      if (!testTitle) {
        testTitle = 'Practice Test from Text';
      }

    } else if (source === 'upload' && (uploadedText || uploadedFile)) {
      // Handle file upload
      if (uploadedFile) {
        const allowedTypes = [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'text/plain'
        ];
        
        if (!allowedTypes.includes(uploadedFile.type)) {
          return NextResponse.json(
            { success: false, error: 'Unsupported file type. Please upload PDF, DOCX, DOC, or TXT files.' },
            { status: 400 }
          );
        }
        
        // Validate file size (10MB limit)
        const maxFileSize = 10 * 1024 * 1024;
        if (uploadedFile.size > maxFileSize) {
          return NextResponse.json(
            { success: false, error: 'File too large. Maximum size is 10MB.' },
            { status: 400 }
          );
        }
        
        logger.info('Processing uploaded file for practice test', {
          fileName: uploadedFile.name,
          fileSize: uploadedFile.size,
          fileType: uploadedFile.type
        });
        
        // Extract text based on file type
        if (uploadedFile.type === 'text/plain') {
          const arrayBuffer = await uploadedFile.arrayBuffer();
          content = Buffer.from(arrayBuffer).toString('utf-8');
        } else if (uploadedFile.type === 'application/pdf') {
          try {
            const pdfParse = (await import('pdf-parse')).default;
            const arrayBuffer = await uploadedFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const pdfData = await pdfParse(buffer);
            content = pdfData.text;
            logger.info('Successfully extracted text from PDF', {
              pages: pdfData.numpages,
              contentLength: content.length
            });
          } catch (error) {
            logger.error('PDF parsing failed', { error });
            return NextResponse.json(
              { success: false, error: 'Failed to extract text from PDF. Please ensure it contains readable text.' },
              { status: 400 }
            );
          }
        } else if (uploadedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || uploadedFile.type === 'application/msword') {
          try {
            const mammoth = (await import('mammoth')).default;
            const arrayBuffer = await uploadedFile.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await mammoth.extractRawText({ buffer });
            content = result.value;
            logger.info('Successfully extracted text from DOCX/DOC', {
              contentLength: content.length
            });
          } catch (error) {
            logger.error('DOCX/DOC parsing failed', { error });
            return NextResponse.json(
              { success: false, error: 'Failed to extract text from Word file.' },
              { status: 400 }
            );
          }
        }
        
        if (!testTitle) {
          testTitle = `${uploadedFile.name} - Practice Test`;
        }
      } else {
        content = uploadedText;
        if (!testTitle) {
          testTitle = 'Practice Test from Upload';
        }
      }

    } else if (source === 'summaries' && body.summaryIds && body.summaryIds.length > 0) {
      // Handle summaries source
      await connectToDatabase();
      
      const summaries = await Summary.find({
        _id: { $in: body.summaryIds },
        userId: new Types.ObjectId(userId)
      }).lean();

      if (!summaries || summaries.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No summaries found' },
          { status: 404 }
        );
      }

      // Inherit subject from the first summary (or most common subject if multiple)
      if (summaries.length === 1) {
        inheritedSubject = (summaries[0] as any).subject || '';
      } else {
        const subjectCounts = summaries.reduce((acc: any, s: any) => {
          const subj = s.subject || 'Uncategorized';
          acc[subj] = (acc[subj] || 0) + 1;
          return acc;
        }, {});
        
        inheritedSubject = Object.entries(subjectCounts)
          .sort((a: any, b: any) => b[1] - a[1])[0][0];
      }

      // Convert summaries to content
      content = summaries.map((s: any) => {
        return `# ${s.title}\n\n${s.content || ''}`;
      }).join('\n\n---\n\n');

      if (!testTitle) {
        testTitle = summaries.length === 1 
          ? `${(summaries[0] as any).title} - Practice Test`
          : `Combined Practice Test`;
      }

      logger.info('Loaded summary content', {
        summaryCount: summaries.length,
        contentLength: content.length,
        inheritedSubject
      });

    } else if (source === 'mixed' && (body.flashcardIds?.length > 0 || body.summaryIds?.length > 0 || body.uploadedFilesData?.length > 0)) {
      // Handle mixed source (flashcards, summaries, and/or files)
      await connectToDatabase();
      
      let flashcardContent = '';
      let summaryContent = '';
      let fileContent = '';
      const allSubjects: string[] = [];

      // Process flashcards if provided
      if (body.flashcardIds && body.flashcardIds.length > 0) {
        const flashcards = await FlashcardModel.find({
          _id: { $in: body.flashcardIds },
          user: new Types.ObjectId(userId)
        }).lean();

        if (flashcards && flashcards.length > 0) {
          flashcards.forEach((fc: any) => {
            if (fc.subject) allSubjects.push(fc.subject);
          });

          flashcardContent = flashcards.map((fc: any) => {
            const cards = fc.cards || [];
            const cardsText = cards.map((c: any) => 
              `Q: ${c.question}\nA: ${c.answer}`
            ).join('\n\n');
            
            return `# ${fc.title}\n${fc.description || ''}\n\n${cardsText}`;
          }).join('\n\n---\n\n');
        }
      }

      // Process summaries if provided
      if (body.summaryIds && body.summaryIds.length > 0) {
        const summaries = await Summary.find({
          _id: { $in: body.summaryIds },
          userId: new Types.ObjectId(userId)
        }).lean();

        if (summaries && summaries.length > 0) {
          summaries.forEach((s: any) => {
            if (s.subject) allSubjects.push(s.subject);
          });

          summaryContent = summaries.map((s: any) => {
            return `# ${s.title}\n\n${s.content || ''}`;
          }).join('\n\n---\n\n');
        }
      }

      // Process uploaded files if provided (base64 data from sessionStorage)
      if (body.uploadedFilesData && body.uploadedFilesData.length > 0) {
        const fileContents: string[] = [];
        
        for (const fileData of body.uploadedFilesData) {
          try {
            // Extract base64 content (remove data URL prefix)
            const base64Content = fileData.data.split(',')[1];
            const buffer = Buffer.from(base64Content, 'base64');
            
            let extractedText = '';
            
            if (fileData.type === 'text/plain') {
              extractedText = buffer.toString('utf-8');
            } else if (fileData.type === 'application/pdf') {
              try {
                const pdfParse = (await import('pdf-parse')).default;
                const pdfData = await pdfParse(buffer);
                extractedText = pdfData.text;
              } catch (e) {
                logger.error('PDF parsing failed for mixed source', { fileName: fileData.name, error: e });
              }
            } else if (fileData.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileData.type === 'application/msword') {
              try {
                const mammoth = (await import('mammoth')).default;
                const result = await mammoth.extractRawText({ buffer });
                extractedText = result.value;
              } catch (e) {
                logger.error('DOCX parsing failed for mixed source', { fileName: fileData.name, error: e });
              }
            }
            
            if (extractedText.trim()) {
              fileContents.push(`# ${fileData.name}\n\n${extractedText}`);
            }
          } catch (e) {
            logger.error('Error processing file in mixed source', { fileName: fileData.name, error: e });
          }
        }
        
        if (fileContents.length > 0) {
          fileContent = fileContents.join('\n\n---\n\n');
        }
      }

      // Combine all content
      const contentParts = [flashcardContent, summaryContent, fileContent].filter(c => c.trim());
      content = contentParts.join('\n\n---\n\n');

      if (!content) {
        return NextResponse.json(
          { success: false, error: 'No valid content found from selected items' },
          { status: 404 }
        );
      }

      // Find most common subject
      if (allSubjects.length > 0) {
        const subjectCounts = allSubjects.reduce((acc: any, subj: string) => {
          acc[subj] = (acc[subj] || 0) + 1;
          return acc;
        }, {});
        
        inheritedSubject = Object.entries(subjectCounts)
          .sort((a: any, b: any) => b[1] - a[1])[0][0];
      }

      if (!testTitle) {
        testTitle = 'Combined Practice Test';
      }

      logger.info('Loaded mixed content', {
        flashcardCount: body.flashcardIds?.length || 0,
        summaryCount: body.summaryIds?.length || 0,
        contentLength: content.length,
        inheritedSubject
      });

    } else {
      return NextResponse.json(
        { success: false, error: 'No content provided for test generation' },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.trim().length < 100) {
      return NextResponse.json(
        { success: false, error: 'Content is too short. Please provide at least 100 characters of study material.' },
        { status: 400 }
      );
    }

    // Generate practice test using AI
    const generator = new PracticeTestGenerator();
    const startTime = Date.now();

    const result = await generator.generatePracticeTest({
      content,
      title: testTitle,
      maxQuestions,
      includeMultipleChoice,
      includeWritten,
      difficulty,
      timeLimit
    });

    // Override subject with inherited subject from flashcards if available
    // Or use the subject provided from upload/paste
    if (inheritedSubject) {
      result.subject = inheritedSubject;
    } else if (subject) {
      result.subject = subject;
    }

    const processingTime = Date.now() - startTime;

    logger.info('Practice test generated successfully', {
      userId,
      processingTime,
      multipleChoiceCount: result.multipleChoiceQuestions.length,
      writtenCount: result.writtenQuestions.length,
      totalPoints: result.totalPoints,
      subject: result.subject
    });

    return NextResponse.json({
      success: true,
      practiceTest: result,
      metadata: {
        processingTime,
        source,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Practice test generation error:', {
      error: error.message,
      stack: error.stack
    });

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate practice test. Please try again.'
      },
      { status: 500 }
    );
  }
}
