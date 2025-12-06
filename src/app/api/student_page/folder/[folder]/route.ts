import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, context: any) {
  const params = await context.params;
  const { folder } = params;
  
  return NextResponse.json({ 
    message: 'Folder route placeholder',
    folder
  });
}
