import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  try {
    console.log('🧪 Testing Google AI API...');
    
    const apiKey = process.env.GOOGLE_AI_API_KEY_Chatbot;
    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length);
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'API key not configured'
      }, { status: 500 });
    }

    console.log('Initializing Google AI...');
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log('Getting model...');
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });
    
    console.log('Generating test content...');
    const result = await model.generateContent('Say "Hello, GC Quest!" in one sentence.');
    const response = await result.response;
    const text = response.text();
    
    console.log('✅ Success! Response:', text);
    
    return NextResponse.json({
      success: true,
      response: text,
      model: 'gemini-2.0-flash-exp'
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error?.constructor?.name,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
    }, { status: 500 });
  }
}
