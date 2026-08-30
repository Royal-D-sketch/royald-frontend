import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GET /api/bills
 * Returns the stored bills JSON (created by upload‑cd route).
 */
export async function GET() {
  const dataPath = path.join(process.cwd(), 'data', 'bills.json');
  try {
    const raw = await fs.promises.readFile(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: 'No bills found' }, { status: 404 });
  }
}
