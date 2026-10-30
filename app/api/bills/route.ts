import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/bills
 * ดึงข้อมูลบิลขายจาก Cloudflare D1 (Zero Egress) และ Supabase (Fallback)
 * 1. ระบุเฉพาะคอลัมน์ที่จำเป็น (ห้ามใช้ SELECT *)
 * 3. กรองช่วงเวลาย้อนหลัง (เช่น 7-30 วัน)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const statusParam = searchParams.get('status');
    const limitParam = parseInt(searchParams.get('limit') || '200', 10);

    // คำนวณช่วงวันที่ย้อนหลัง (ค่าเริ่มต้น 30 วัน เพื่อจำกัดขนาดข้อมูล)
    let startFilter = startDateParam || '';
    let endFilter = endDateParam || '';

    if (!startFilter && daysParam) {
      const daysCount = parseInt(daysParam, 10) || 30;
      const d = new Date();
      d.setDate(d.getDate() - daysCount);
      startFilter = d.toISOString().split('T')[0];
    } else if (!startFilter && !daysParam) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startFilter = d.toISOString().split('T')[0];
    }

    // --- 1. ลองดึงจาก Cloudflare D1 เป็นลำดับแรก (Zero Egress ฟรี 100%) ---
    try {
      let d1Sql = `SELECT bill_no, bill_date, customer_name, total_amount, remaining_amount, status, sales_rep, province, created_at 
                   FROM sales_bills 
                   WHERE 1=1 `;
      const params: any[] = [];

      if (startFilter) {
        d1Sql += ` AND bill_date >= ? `;
        params.push(startFilter);
      }
      if (endFilter) {
        d1Sql += ` AND bill_date <= ? `;
        params.push(endFilter);
      }
      if (statusParam && statusParam !== 'all') {
        if (statusParam.toLowerCase() === 'paid') {
          d1Sql += ` AND status = 'Paid' `;
        } else if (statusParam.toLowerCase() === 'outstanding') {
          d1Sql += ` AND (status != 'Paid' OR status IS NULL) `;
        }
      }

      d1Sql += ` ORDER BY bill_date DESC LIMIT ? `;
      params.push(limitParam);

      const d1Bills = await queryD1(d1Sql, params);
      if (d1Bills && d1Bills.length > 0) {
        const formatted = d1Bills.map((b: any) => ({
          BillNo: b.bill_no,
          Date: b.bill_date || b.created_at,
          CustomerName: b.customer_name || 'ลูกค้าทั่วไป',
          TotalAmount: Number(b.total_amount || b.remaining_amount || 0),
          RemainingAmount: Number(b.remaining_amount ?? b.total_amount ?? 0),
          Status: b.status || 'Outstanding',
          SalesRep: b.sales_rep || '-',
          Province: b.province || '-',
        }));
        return NextResponse.json(formatted);
      }
    } catch (d1Err) {
      console.warn("Cloudflare D1 fetch error, falling back to Supabase:", d1Err);
    }

    // --- 2. Fallback: ดึงจาก Supabase (ถ้ามี) ---
    let query = supabase
      .from('sales_bills')
      .select('bill_no, bill_date, customer_name, total_amount, remaining_amount, status, sales_rep, province, created_at');

    if (startFilter) query = query.gte('bill_date', startFilter);
    if (endFilter) query = query.lte('bill_date', endFilter);
    if (statusParam && statusParam !== 'all') {
      if (statusParam.toLowerCase() === 'paid') query = query.eq('status', 'Paid');
      else if (statusParam.toLowerCase() === 'outstanding') query = query.neq('status', 'Paid');
    }

    query = query.order('bill_date', { ascending: false }).limit(limitParam);
    const { data: bills, error } = await query;

    if (!error && bills && bills.length > 0) {
      const formatted = bills.map((b: any) => ({
        BillNo: b.bill_no,
        Date: b.bill_date || b.created_at,
        CustomerName: b.customer_name || 'ลูกค้าทั่วไป',
        TotalAmount: Number(b.total_amount || b.remaining_amount || 0),
        RemainingAmount: Number(b.remaining_amount ?? b.total_amount ?? 0),
        Status: b.status || 'Outstanding',
        SalesRep: b.sales_rep || '-',
        Province: b.province || '-',
      }));
      return NextResponse.json(formatted);
    }
  } catch (err: any) {
    console.error("Bills fetch error:", err.message || err);
  }

  return NextResponse.json([]);
}
