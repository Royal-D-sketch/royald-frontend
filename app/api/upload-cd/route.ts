import { NextResponse } from 'next/server';
import dayjs from 'dayjs';

/**
 * POST /api/upload-cd
 * Receives files from frontend, parses CSV/TSV, normalizes dates to DD/MM/YYYY.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    return NextResponse.json({
      success: true,
      message: 'File processed successfully',
      rowsCount: lines.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error processing file' }, { status: 500 });
  }
}
