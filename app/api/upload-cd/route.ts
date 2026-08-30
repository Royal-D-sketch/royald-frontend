import { NextResponse } from 'next/server';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import dayjs from 'dayjs';

export const config = {
  api: {
    bodyParser: false,
  },
};

/** POST /api/upload-cd */
export async function POST(request: Request) {
  const form = new IncomingForm({ multiples: true, keepExtensions: true });
  const { files } = await new Promise<{ files: any }>((resolve, reject) => {
    form.parse(request as any, (err, _, files) => {
      if (err) reject(err);
      else resolve({ files });
    });
  });
  const uploaded = files?.file;
  if (!uploaded) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
  const fileArray = Array.isArray(uploaded) ? uploaded : [uploaded];
  const allRecords: any[] = [];
  for (const file of fileArray) {
    const raw = await fs.promises.readFile(file.filepath, 'utf-8');
    const records = parse(raw, { columns: true, skip_empty_lines: true });
    const normalised = records.map((rec: any) => {
      for (const key of Object.keys(rec)) {
        if (key.toLowerCase().includes('date')) {
          const d = dayjs(rec[key], ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY', 'DD-MM-YYYY', 'MM-DD-YYYY']);
          if (d.isValid()) rec[key] = d.format('DD/MM/YYYY');
        }
      }
      return rec;
    });
    allRecords.push(...normalised);
  }
  const batchSize = 500;
  const dataDir = path.join(process.cwd(), 'data');
  await fs.promises.mkdir(dataDir, { recursive: true });
  const storePath = path.join(dataDir, 'bills.json');
  let existing: any[] = [];
  try { existing = JSON.parse(await fs.promises.readFile(storePath, 'utf-8')); } catch (_) {}
  for (let i = 0; i < allRecords.length; i += batchSize) {
    existing.push(...allRecords.slice(i, i + batchSize));
    await fs.promises.writeFile(storePath, JSON.stringify(existing, null, 2));
  }
  return NextResponse.json({ message: 'Processed', records: allRecords.length });
}
