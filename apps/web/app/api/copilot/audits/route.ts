import { env } from '@arbitrage/config';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '100';

    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/api/v1/copilot/audits?limit=${limit}`, {
      next: { revalidate: 0 } // Bypass Next.js fetch caching
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Backend responded with status ${res.status}: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Next.js Proxy Get Audits Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey = process.env.API_KEY || 'UIozJjvuF5EQ1YNZ2mLwiHO8fx0tDBCbd6TGMren';

    const res = await fetch(`${env.NEXT_PUBLIC_BACKEND_URL}/api/v1/copilot/audits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Backend responded with status ${res.status}: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Next.js Proxy Save Audit Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
