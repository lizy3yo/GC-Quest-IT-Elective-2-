import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const hasApiKey = !!process.env.GOOGLE_AI_API_KEY_Chatbot;
    
    return NextResponse.json({
      status: 'ok',
      chatbot: {
        configured: hasApiKey,
        apiKeyLength: process.env.GOOGLE_AI_API_KEY_Chatbot?.length || 0
      }
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
