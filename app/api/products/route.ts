import { NextResponse } from 'next/server';
import { queryD1 } from '@/lib/d1';
import { supabase } from '@/lib/supabase';
import masterProducts from '@/lib/products_master.json';

/**
 * GET /api/products
 * ดึงรายการสินค้าแบบแบ่งหน้า 20 รายการจาก Cloudflare D1 / Supabase
 * 1. ระบุเฉพาะคอลัมน์ที่จำเป็น (ห้ามใช้ SELECT *)
 * 2. แบ่งหน้าแสดงผลทีละ 20 รายการด้วยคำสั่ง LIMIT/OFFSET หรือ .range()
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = 20; // 20 รายการต่อหน้าตามข้อกำหนด
    const search = (searchParams.get('search') || '').trim();

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // --- 1. ลองดึงจาก Cloudflare D1 เป็นลำดับแรก (Zero Egress) ---
    try {
      let countSql = `SELECT COUNT(*) as total FROM sales_bill_items WHERE 1=1 `;
      let dataSql = `SELECT id, product_code, product_name, unit, price, qty, amount 
                     FROM sales_bill_items 
                     WHERE 1=1 `;
      const params: any[] = [];

      if (search) {
        const searchPattern = `%${search}%`;
        countSql += ` AND (product_name LIKE ? OR product_code LIKE ?) `;
        dataSql += ` AND (product_name LIKE ? OR product_code LIKE ?) `;
        params.push(searchPattern, searchPattern);
      }

      dataSql += ` ORDER BY id ASC LIMIT ? OFFSET ? `;
      const dataParams = [...params, pageSize, from];

      const countResult = await queryD1<{ total: number }>(countSql, params);
      const totalCount = countResult[0]?.total || 0;

      if (totalCount > 0) {
        const items = await queryD1(dataSql, dataParams);
        return NextResponse.json({
          data: items,
          page,
          pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          source: 'cloudflare_d1',
        });
      }
    } catch (d1Err) {
      console.warn("D1 products fetch warning, falling back:", d1Err);
    }

    // --- 2. Fallback: ดึงจาก Supabase ด้วย .range() ---
    try {
      let query = supabase
        .from('sales_bill_items')
        .select('id, product_code, product_name, unit, price, qty, amount', { count: 'exact' });

      if (search) {
        query = query.or(`product_name.ilike.%${search}%,product_code.ilike.%${search}%`);
      }

      query = query.order('id', { ascending: true }).range(from, to);
      const { data: items, count, error } = await query;

      if (!error && items && items.length > 0) {
        const totalCount = count || items.length;
        return NextResponse.json({
          data: items,
          page,
          pageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageSize),
          source: 'supabase',
        });
      }
    } catch (supaErr) {}

    // --- 3. Fallback: ข้อมูล Master Products แค็ตตาล็อก ---
    let filteredMaster: any[] = masterProducts;
    if (search) {
      const q = search.toLowerCase();
      filteredMaster = filteredMaster.filter(
        (p: any) =>
          p.product_name.toLowerCase().includes(q) ||
          p.product_code.toLowerCase().includes(q)
      );
    }

    const totalCount = filteredMaster.length;
    const paginatedItems = filteredMaster.slice(from, to + 1);

    return NextResponse.json({
      data: paginatedItems,
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      source: 'master_catalog',
    });
  } catch (err: any) {
    console.error("Products API error:", err.message || err);
    return NextResponse.json({
      data: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      error: err.message,
    }, { status: 500 });
  }
}
