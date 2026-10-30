import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { supabase } from '@/lib/supabase';
import dayjs from 'dayjs';

/**
 * GET /api/charts
 * ดึงและสรุปข้อมูลสถิติสำหรับหน้ากราฟจาก Cloudflare D1 / Supabase
 * 1. ระบุเฉพาะคอลัมน์ที่จำเป็น (ห้ามใช้ SELECT *)
 * 3. กรองข้อมูลตามช่วงวันที่ย้อนหลัง (7-30 วัน)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get('days') || '30', 10);
    const days = [7, 14, 30, 60, 90].includes(daysParam) ? daysParam : 30;

    const startDate = dayjs().subtract(days, 'day').format('YYYY-MM-DD');
    const endDate = dayjs().format('YYYY-MM-DD');

    let billList: any[] = [];

    // --- 1. ลองดึงจาก Cloudflare D1 เป็นลำดับแรก (Zero Egress) ---
    try {
      const d1Sql = `SELECT bill_no, bill_date, total_amount, remaining_amount, status, sales_rep 
                     FROM sales_bills 
                     WHERE bill_date >= ? AND bill_date <= ? 
                     ORDER BY bill_date ASC`;
      const d1Bills = await queryD1(d1Sql, [startDate, endDate]);
      if (d1Bills && d1Bills.length > 0) {
        billList = d1Bills;
      }
    } catch (d1Err) {
      console.warn("D1 charts fetch warning, falling back:", d1Err);
    }

    // --- 2. Fallback: ดึงจาก Supabase ---
    if (billList.length === 0) {
      try {
        const { data: bills, error } = await supabase
          .from('sales_bills')
          .select('bill_no, bill_date, total_amount, remaining_amount, status, sales_rep')
          .gte('bill_date', startDate)
          .lte('bill_date', endDate)
          .order('bill_date', { ascending: true });

        if (!error && bills && bills.length > 0) {
          billList = bills;
        }
      } catch (supaErr) {}
    }

    // รวมสถิติรายวัน (Daily Trend)
    const dailyMap: { [date: string]: { date: string; sales: number; paid: number; count: number } } = {};
    const repMap: { [rep: string]: { rep: string; sales: number; count: number } } = {};

    let totalSales = 0;
    let totalOutstanding = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let outstandingCount = 0;

    billList.forEach((b) => {
      const date = b.bill_date ? dayjs(b.bill_date).format('DD/MM') : 'N/A';
      const amount = Number(b.total_amount || 0);
      const remaining = Number(b.remaining_amount ?? (b.status === 'Paid' ? 0 : amount));
      const paid = Math.max(0, amount - remaining);
      const isPaid = b.status === 'Paid' || remaining === 0;

      totalSales += amount;
      totalOutstanding += remaining;
      totalPaid += paid;

      if (isPaid) paidCount++;
      else outstandingCount++;

      // Daily grouping
      if (!dailyMap[date]) {
        dailyMap[date] = { date, sales: 0, paid: 0, count: 0 };
      }
      dailyMap[date].sales += amount;
      dailyMap[date].paid += paid;
      dailyMap[date].count += 1;

      // Sales rep grouping
      const rep = b.sales_rep || 'ไม่ระบุ';
      if (!repMap[rep]) {
        repMap[rep] = { rep, sales: 0, count: 0 };
      }
      repMap[rep].sales += amount;
      repMap[rep].count += 1;
    });

    const dailyTrends = Object.values(dailyMap);
    const repPerformance = Object.values(repMap).sort((a, b) => b.sales - a.sales).slice(0, 8);
    const collectionRate = totalSales > 0 ? (totalPaid / totalSales) * 100 : 0;

    return NextResponse.json({
      period: {
        days,
        startDate,
        endDate,
      },
      summary: {
        totalBills: billList.length,
        totalSales,
        totalPaid,
        totalOutstanding,
        collectionRate: Number(collectionRate.toFixed(1)),
        paidCount,
        outstandingCount,
      },
      dailyTrends,
      repPerformance,
      source: billList.length > 0 ? 'cloudflare_d1' : 'empty',
    });
  } catch (err: any) {
    console.error("Charts API error:", err.message || err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
