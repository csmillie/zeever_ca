import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3034';

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Fix #12: Only forward expected fields
  const { question } = body;
  if (!question || typeof question !== 'string') {
    return NextResponse.json(
      { answer: 'Please provide a question.', sources: [], query_class: 'error', model_used: 'none' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${API_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: question.slice(0, 2000) }),
    });

    if (response.status === 429) {
      return NextResponse.json(
        { answer: 'Too many requests. Please wait a moment and try again.', sources: [], query_class: 'error', model_used: 'none' },
        { status: 429 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { answer: 'The backend service is not available. Please try again later.', sources: [], query_class: 'error', model_used: 'none' },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { answer: 'Unable to connect to the backend service.', sources: [], query_class: 'error', model_used: 'none' },
      { status: 502 }
    );
  }
}
