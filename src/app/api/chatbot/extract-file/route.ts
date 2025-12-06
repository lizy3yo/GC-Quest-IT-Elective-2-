import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/winston';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    logger.info('Extracting text from file', {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size
    });

    let textContent = '';

    if (file.type === 'application/pdf') {
      // Extract text from PDF
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const pdfData = await pdfParse(buffer);
        textContent = pdfData.text;

        logger.info('Successfully extracted text from PDF', {
          contentLength: textContent.length,
          pages: pdfData.numpages
        });
      } catch (error) {
        logger.error('PDF extraction failed:', error);
        return NextResponse.json(
          { error: 'Failed to extract text from PDF. Please ensure it contains readable text.' },
          { status: 400 }
        );
      }
    } else if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/msword'
    ) {
      // Extract text from Word document
      try {
        const mammoth = (await import('mammoth')).default;
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const result = await mammoth.extractRawText({ buffer });
        textContent = result.value;

        logger.info('Successfully extracted text from Word document', {
          contentLength: textContent.length
        });
      } catch (error) {
        logger.error('Word document extraction failed:', error);
        return NextResponse.json(
          { error: 'Failed to extract text from Word document.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      );
    }

    if (!textContent || textContent.trim().length < 100) {
      return NextResponse.json(
        { error: 'File content is too short or could not be extracted' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      content: textContent,
      length: textContent.length
    });

  } catch (error) {
    logger.error('File extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract file content' },
      { status: 500 }
    );
  }
}
