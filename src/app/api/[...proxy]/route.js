import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:5000';

async function proxyRequest(request, { params }) {
  const path = (await params).proxy?.join('/') || '';
  const url = new URL(request.url);
  const queryString = url.search;
  const targetUrl = `${BACKEND_URL}/api/${path}${queryString}`;

  const cookieStore = await cookies();
  const token = cookieStore.get('ikmbToken')?.value;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (!['host', 'connection', 'content-length', 'cookie'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const body = await request.arrayBuffer();
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: body.byteLength > 0 ? body : undefined,
    });

    const responseBody = await response.arrayBuffer();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error) {
    console.error('API proxy error:', error);
    return NextResponse.json({ message: 'Gagal menyambung ke pelayan.' }, { status: 502 });
  }
}

export async function GET(request, context) {
  return proxyRequest(request, context);
}

export async function POST(request, context) {
  return proxyRequest(request, context);
}

export async function PUT(request, context) {
  return proxyRequest(request, context);
}

export async function PATCH(request, context) {
  return proxyRequest(request, context);
}

export async function DELETE(request, context) {
  return proxyRequest(request, context);
}
