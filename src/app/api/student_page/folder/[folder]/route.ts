import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ folder: string }> }
) {
  const { folder } = await params;
  
  return NextResponse.json({ 
    message: 'Folder route placeholder',
    folder
  });
}
