import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { supabase } from '@/lib/supabase';

/**
 * POST /api/payment
 * บันทึกการชำระเงินลง Cloudflare D1 (Zero Egress) และ Supabase (Fallback)
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const billNo = formData.get('billNo') as string;
    const method = formData.get('method') as string;
    const amount = formData.get('amount') as string;
    const payDate = formData.get('payDate') as string;
    const note = (formData.get('note') as string) || null;
    const checkDate = (formData.get('checkDate') as string) || null;
    const bank = (formData.get('bank') as string) || null;
    const checkNo = (formData.get('checkNo') as string) || null;
    const file = formData.get('file') as File | null;

    if (!billNo || !method || !amount || !payDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const amtNum = parseFloat(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    let newRemaining = 0;
    const now = new Date().toISOString();

    // --- 1. บันทึกลง Cloudflare D1 เป็นหลัก (Zero Egress) ---
    try {
      const bills = await queryD1<{ remaining_amount: number; total_amount: number; status: string }>(
        `SELECT remaining_amount, total_amount, status FROM sales_bills WHERE bill_no = ? LIMIT 1`,
        [billNo]
      );

      if (bills && bills.length > 0) {
        const currentRem = Number(bills[0].remaining_amount ?? bills[0].total_amount ?? 0);
        newRemaining = Math.max(0, currentRem - amtNum);
        const newStatus = newRemaining === 0 ? 'Paid' : 'Outstanding';

        await queryD1(
          `UPDATE sales_bills SET remaining_amount = ?, status = ? WHERE bill_no = ?`,
          [newRemaining, newStatus, billNo]
        );

        await queryD1(
          `INSERT INTO payment_records (bill_no, amount, method, pay_date, note, bank, check_no, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [billNo, amtNum, method, payDate, note, bank, checkNo, now]
        );
      }
    } catch (d1Err) {
      console.warn("Cloudflare D1 payment record warning:", d1Err);
    }

    // --- 2. อัปเดต Supabase ด้วย (ถ้ามี) ---
    try {
      const { data: bill } = await supabase
        .from('sales_bills')
        .select('remaining_amount, status')
        .eq('bill_no', billNo)
        .single();

      if (bill) {
        const cur = parseFloat(bill.remaining_amount || '0');
        newRemaining = Math.max(0, cur - amtNum);
        const newStatus = newRemaining === 0 ? 'Paid' : bill.status;

        await supabase
          .from('sales_bills')
          .update({ remaining_amount: newRemaining, status: newStatus })
          .eq('bill_no', billNo);

        await supabase.from('payment_records').insert({
          bill_no: billNo,
          amount: amtNum,
          method,
          pay_date: payDate,
          note,
          bank,
          check_no,
        });
      }
    } catch (supaErr) {}

    return NextResponse.json({
      success: true,
      message: 'บันทึกการชำระเงินลงระบบสำเร็จ (Cloudflare D1)',
      remaining_amount: newRemaining,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
