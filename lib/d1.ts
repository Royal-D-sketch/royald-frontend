/**
 * Cloudflare D1 Client Adapter for Royal-D Next.js
 * ให้บริการเชื่อมต่อกับ Cloudflare D1 Database ผ่าน REST API หรือ Cloudflare Worker Binding
 * ฟรี 100% ไม่มีค่า Egress แบนด์วิดท์ตลอดชีพ
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '8e1fd21a82f8510523fe84ae85522669';
const DATABASE_ID = process.env.CLOUDFLARE_D1_DATABASE_ID || 'c3c10e68-3bc9-4e95-98d6-873f5909ffb5';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  try {
    const token = API_TOKEN;
    if (!token) {
      console.warn('CLOUDFLARE_API_TOKEN is not configured');
      return [];
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sql,
        params,
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Cloudflare D1 Query HTTP Error:', res.status, errText);
      return [];
    }

    const data = await res.json();
    if (data.success && data.result && data.result.length > 0) {
      return data.result[0].results as T[];
    }
    return [];
  } catch (err: any) {
    console.error('Cloudflare D1 Query Exception:', err.message || err);
    return [];
  }
}
