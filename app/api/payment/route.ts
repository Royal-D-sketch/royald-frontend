import { NextResponse } from 'next/server';
import { IncomingForm } from 'formidable';
import * as fs from 'fs';
import { supabase } from '../../lib/supabase';

export const config = {
  api: {
    bodyParser: false, // use formidable
  },
};

/**
 * POST /api/payment
 * Handles payment submissions (Transfer or Check) from the frontend.
 * Updates the `sales_bills` table in Supabase, inserts a record into
 * `payment_records`, and uploads any attached file to Supabase storage.
 */
export async function POST(request: Request) {
  // Parse multipart/form-data
  const form = new IncomingForm({ multiples: false, keepExtensions: true });
  const { fields, files } = await new Promise<{ fields: any; files: any }>((resolve, reject) => {
    form.parse(request as any, (err, fields, files) => {
      if (err) reject(err);
      else resolve({ fields, files });
    });
  });

  const {
    billNo,
    method,
    amount,
    payDate,
    note,
    checkDate,
    bank,
    checkNo,
  } = fields as Record<string, string>;

  if (!billNo || !method || !amount || !payDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const amtNum = parseFloat(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }

  // Fetch current remaining amount
  const { data: bill, error: fetchErr } = await supabase
    .from('sales_bills')
    .select('remaining_amount, status')
    .eq('bill_no', billNo)
    .single();

  if (fetchErr || !bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const newRemaining = Math.max(0, parseFloat(bill.remaining_amount) - amtNum);
  const newStatus = newRemaining === 0 ? 'Paid' : bill.status;

  // Update the bill
  const { error: updateErr } = await supabase
    .from('sales_bills')
    .update({ remaining_amount: newRemaining, status: newStatus })
    .eq('bill_no', billNo);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update bill' }, { status: 500 });
  }

  // Handle optional file upload (Transfer slip or Check image)
  let fileUrl: string | null = null;
  const uploadedFile = files?.file;
  if (uploadedFile) {
    // Read file buffer
    const filePath = uploadedFile.filepath;
    const fileBuffer = await fs.promises.readFile(filePath);
    const fileName = `${Date.now()}_${uploadedFile.originalFilename}`;
    const { data: storageData, error: storageErr } = await supabase.storage
      .from('payment_attachments')
      .upload(fileName, fileBuffer, {
        contentType: uploadedFile.mimetype,
      });
    if (!storageErr && storageData) {
      const { publicURL } = supabase.storage.from('payment_attachments').getPublicUrl(fileName);
      fileUrl = publicURL;
    }
  }

  // Insert payment record
  const paymentRecord = {
    bill_no: billNo,
    amount: amtNum,
    method,
    pay_date: payDate,
    note: note || null,
    file_url: fileUrl,
    // optional check fields
    check_date: checkDate || null,
    bank: bank || null,
    check_no: checkNo || null,
  };

  const { error: insertErr } = await supabase.from('payment_records').insert(paymentRecord);
  if (insertErr) {
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Payment recorded', remaining_amount: newRemaining });
}
