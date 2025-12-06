import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongoose';
import { Summary } from '@/models/summary';
import { InternalSummaryGenerator } from '@/lib/ai/internal-summary-generator';
import { logger } from '@/lib/winston';
import { logActivity } from '@/lib/activity';

// File processing utilities
async function extractTextFromFile(file: File): Promise<string> {
  const fileType = file.type;
  const fileName = file.name.toLowerCase();
  
  // Handle text files
  if (fileType === 'text/plain' || fileName.endsWith('.txt') || fileName.endsWith('.md')) {
    return await file.text();
  }
  
  // Handle PDF files
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      logger.info('Attempting to extract text from PDF');
      const pdfParse = (await import('pdf-parse')).default;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const pdfData = await pdfParse(buffer);
      
      if (pdfData.text && pdfData.text.trim().length > 0) {
        logger.info('Successfully extracted text from PDF', { 
          contentLength: pdfData.text.length,
          pages: pdfData.numpages
        });
        return pdfData.text;
      }
      throw new Error('No text content found in PDF');
    } catch (error) {
      logger.error('PDF extraction failed:', error);
      throw new Error('Failed to extract text from PDF. The PDF may be image-based or corrupted.');
    }
  }
  
  // Handle Word documents
  if (fileType === 'application/msword' || 
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
    try {
      logger.info('Attempting to extract text from Word document');
      const mammoth = (await import('mammoth')).default;
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const result = await mammoth.extractRawText({ buffer });
      
      if (result.value && result.value.trim().length > 0) {
        logger.info('Successfully extracted text from Word document', { 
          contentLength: result.value.length
        });
        return result.value;
      }
      throw new Error('No text content found in Word document');
    } catch (error) {
      logger.error('Word document extraction failed:', error);
      throw new Error('Failed to extract text from Word document. The file may be corrupted.');
    }
  }
  
  // Handle PowerPoint files  
  if (fileType === 'application/vnd.ms-powerpoint' ||
      fileType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) {
    try {
      logger.info('Attempting to extract text from PowerPoint');
      
      if (fileName.endsWith('.pptx')) {
        // Use adm-zip to extract text from PPTX
        const AdmZip = (await import('adm-zip')).default;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const zip = new AdmZip(buffer);
        const zipEntries = zip.getEntries();
        
        let extractedText = '';
        zipEntries.forEach((entry: any) => {
          if (entry.entryName.match(/ppt\/slides\/slide\d+\.xml/)) {
            const content = entry.getData().toString('utf8');
            const matches = content.match(/<a:t>([^<]+)<\/a:t>/g);
            if (matches) {
              matches.forEach((match: string) => {
                const text = match.replace(/<\/?a:t>/g, '');
                extractedText += text + ' ';
              });
            }
          }
        });
        
        if (extractedText.trim().length > 0) {
          logger.info('Successfully extracted text from PowerPoint', { 
            contentLength: extractedText.length
          });
          return extractedText.trim();
        }
        throw new Error('No text content found in PowerPoint');
      } else {
        // Old .ppt format not supported
        throw new Error('Old PowerPoint format (.ppt) not supported. Please use .pptx or convert to PDF');
      }
    } catch (error) {
      logger.error('PowerPoint extraction failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to extract text from PowerPoint');
    }
  }
  
  throw new Error(`Unsupported file type. Supported formats: PDF (.pdf), Word (.doc, .docx), PowerPoint (.pptx), Text (.txt, .md)`);
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const subject = formData.get('subject') as string;
    const summaryType = (formData.get('summaryType') as string) || 'detailed';
    const maxLength = parseInt((formData.get('maxLength') as string) || '300');
    const isPublic = formData.get('isPublic') === 'true';

    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'File is required' 
      }, { status: 400 });
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ 
        success: false, 
        error: 'File too large. Maximum size is 10MB' 
      }, { status: 400 });
    }

    logger.info('Processing file for summary generation', {
      userId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      summaryType,
      subject
    });

    // Extract text from file
    let content: string;
    try {
      content = await extractTextFromFile(file);
    } catch (error) {
      logger.error('File processing failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: file.name,
        fileType: file.type
      });
      
      return NextResponse.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process file' 
      }, { status: 400 });
    }

    if (!content || content.trim().length < 100) {
      return NextResponse.json({ 
        success: false, 
        error: 'File content must be at least 100 characters long' 
      }, { status: 400 });
    }

    if (content.length > 100000) {
      return NextResponse.json({ 
        success: false, 
        error: 'File content too long. Please limit to 100,000 characters' 
      }, { status: 400 });
    }

    // Generate summary using AI
    const generator = new InternalSummaryGenerator();
    const result = await generator.generateSummary({
      content: content.trim(),
      title: title?.trim() || file.name,
      subject: subject?.trim(),
      summaryType: summaryType as any,
      maxLength
    });

    // Save to database
    const summaryDoc = new Summary({
      userId,
      title: result.summary.title,
      content: result.summary.content,
      keyPoints: result.summary.keyPoints,
      mainTopics: result.summary.mainTopics,
      wordCount: result.summary.wordCount,
      readingTime: result.summary.readingTime,
      difficulty: result.summary.difficulty,
      subject: result.summary.subject,
      summaryType: result.summary.summaryType,
      tags: result.summary.tags,
      confidence: result.summary.confidence,
      originalWordCount: result.originalWordCount,
      compressionRatio: result.compressionRatio,
      sourceType: 'file',
      sourceFileName: file.name,
      isPublic: isPublic
    });

    const savedSummary = await summaryDoc.save();

    logger.info('Summary generated from file and saved successfully', {
      summaryId: savedSummary._id,
      userId,
      fileName: file.name,
      wordCount: result.summary.wordCount,
      compressionRatio: result.compressionRatio
    });

    // Log activity
    await logActivity({
      userId: String(userId),
      type: 'summary.generate',
      action: 'generated from file',
      meta: {
        summaryId: String(savedSummary._id),
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        fileName: file.name,
        subject: savedSummary.subject
      },
      progress: 100
    });

    return NextResponse.json({
      success: true,
      message: 'Summary generated successfully from file!',
      summary: {
        id: savedSummary._id,
        title: savedSummary.title,
        wordCount: savedSummary.wordCount,
        compressionRatio: savedSummary.compressionRatio,
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        sourceFileName: file.name
      }
    });

  } catch (error) {
    logger.error('File summary generation failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate summary from file'
    }, { status: 500 });
  }
}