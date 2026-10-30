"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "../../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

type ChartSummary = {
  totalBills: number;
  totalSales: number;
  totalPaid: number;
  totalOutstanding: number;
  collectionRate: number;
  paidCount: number;
  outstandingCount: number;
};

type DailyTrend = {
  date: string;
  sales: number;
  paid: number;
  count: number;
};

type RepPerformance = {
  rep: string;
  sales: number;
  count: number;
};

export default function ChartsPage() {
  // 3. กรองข้อมูลด้วยวันที่ ดึงเฉพาะข้อมูลย้อนหลัง 7-30 วัน เพื่อประหยัด Supabase Egress
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);

  const [summary, setSummary] = useState<ChartSummary>({
    totalBills: 0,
    totalSales: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    collectionRate: 0,
    paidCount: 0,
    outstandingCount: 0,
  });

  const [dailyTrends, setDailyTrends] = useState<DailyTrend[]>([]);
  const [repPerformance, setRepPerformance] = useState<RepPerformance[]>([]);
  const [periodInfo, setPeriodInfo] = useState({ days: 30, startDate: "", endDate: "" });

  // ป้องกัน Race Condition และ Infinite Loops
  const reqIdRef = useRef(0);

  // 4. ฟังก์ชันดึงข้อมูลที่มี Dependency ที่ชัดเจน ป้องกันการเกิด Infinite Loop
  const fetchChartData = useCallback(async (selectedDays: number) => {
    const currentId = ++reqIdRef.current;
    setLoading(true);

    try {
      const res = await fetch(`/api/charts?days=${selectedDays}`);
      if (!res.ok) throw new Error("Failed to load chart data");

      const resData = await res.json();

      if (currentId === reqIdRef.current) {
        setSummary(resData.summary || {
          totalBills: 0,
          totalSales: 0,
          totalPaid: 0,
          totalOutstanding: 0,
          collectionRate: 0,
          paidCount: 0,
          outstandingCount: 0,
        });
        setDailyTrends(resData.dailyTrends || []);
        setRepPerformance(resData.repPerformance || []);
        setPeriodInfo(resData.period || { days: selectedDays, startDate: "", endDate: "" });
      }
    } catch (err) {
      if (currentId === reqIdRef.current) {
        toast.error("ไม่สามารถโหลดข้อมูลสถิติกราฟได้");
      }
    } finally {
      if (currentId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 4. useEffect ใช้เฉพาะ Primitive Dependency (days) เท่านั้น ป้องกัน Infinite Loop
  useEffect(() => {
    fetchChartData(days);
  }, [days, fetchChartData]);

  // หาค่ายอดขายสูงสุดในแต่ละวัน เพื่อปรับ Scale ความสูงของกราฟแท่ง
  const maxDailySales = Math.max(...dailyTrends.map((d) => d.sales), 1000);
  const maxRepSales = Math.max(...repPerformance.map((r) => r.sales), 1000);

  return (
    <div className="container py-4">
      <Toaster position="top-right" />

      {/* Shared Unified Navbar */}
      <Navbar />

      {/* Page Title & Optimization Note */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 pb-2 gap-2">
        <div>
          <h3 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-graph-up-arrow text-primary"></i>กราฟและรายงานวิเคราะห์ยอดขาย (Analytics)
          </h3>
          <div className="text-muted small mt-1">
            ระบุเฉพาะคอลัมน์ที่จำเป็น และกรองข้อมูลเฉพาะช่วงวันที่ย้อนหลัง (7-30 วัน) เพื่อลดการใช้ Egress แบนด์วิดท์
          </div>
        </div>

        {/* 3. Date Filter Toolbar (7-30 วัน) */}
        <div className="d-flex align-items-center gap-2 bg-white p-2 rounded-3 shadow-sm border">
          <span className="small fw-bold text-secondary">
            <i className="bi bi-clock-history me-1 text-primary"></i>ช่วงเวลาย้อนหลัง:
          </span>
          <div className="btn-group btn-group-sm">
            {[
              { val: 7, label: "7 วันล่าสุด (ลด Egress สูงสุด)" },
              { val: 14, label: "14 วัน" },
              { val: 30, label: "30 วัน (แนะนำ)" },
              { val: 60, label: "60 วัน" },
            ].map((item) => (
              <button
                key={item.val}
                type="button"
                className={`btn btn-sm ${
                  days === item.val ? "btn-primary fw-bold" : "btn-outline-secondary"
                }`}
                onClick={() => setDays(item.val)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-primary text-white p-3 h-100">
            <div className="small text-white-50">ยอดขายรวม ({days} วัน)</div>
            <h3 className="fw-bold mb-0">฿{summary.totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-white-50 mt-1">ทั้งหมด {summary.totalBills.toLocaleString()} บิล</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-success text-white p-3 h-100">
            <div className="small text-white-50">ยอดชำระแล้ว (Paid)</div>
            <h3 className="fw-bold mb-0">฿{summary.totalPaid.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-white-50 mt-1">{summary.paidCount.toLocaleString()} บิลที่ปิดยอดแล้ว</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-warning text-dark p-3 h-100">
            <div className="small text-muted">ยอดค้างชำระ (Outstanding)</div>
            <h3 className="fw-bold mb-0 text-danger">฿{summary.totalOutstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-muted mt-1">{summary.outstandingCount.toLocaleString()} บิลรอติดตาม</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-dark text-white p-3 h-100">
            <div className="small text-white-50">อัตราการเก็บเงิน (Collection Rate)</div>
            <h3 className="fw-bold mb-0 text-info">{summary.collectionRate}%</h3>
            <div className="small text-white-50 mt-1">เป้าหมายมาตรฐาน {">"} 80%</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">กำลังประมวลผลกราฟวิเคราะห์ย้อนหลัง {days} วัน...</p>
        </div>
      ) : (
        <div className="row g-4 mb-4">
          {/* Chart 1: Daily Sales & Collections Bar Chart */}
          <div className="col-lg-8">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3 d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="fw-bold text-dark mb-0">
                    <i className="bi bi-bar-chart-line text-primary me-2"></i>
                    แนวโน้มยอดขายและการชำระเงินรายวัน ({days} วันล่าสุด)
                  </h6>
                  <span className="text-muted small">
                    {periodInfo.startDate} ถึง {periodInfo.endDate}
                  </span>
                </div>
                <div className="d-flex align-items-center gap-3 small">
                  <span><span className="badge bg-primary me-1">■</span> ยอดขาย</span>
                  <span><span className="badge bg-success me-1">■</span> เงินที่เก็บได้</span>
                </div>
              </div>
              <div className="card-body p-4">
                {dailyTrends.length === 0 ? (
                  <div className="text-center py-5 text-muted">ไม่มีข้อมูลบิลขายในช่วง {days} วันที่เลือก</div>
                ) : (
                  <div style={{ height: "300px" }} className="d-flex align-items-end gap-2 pt-4">
                    {dailyTrends.map((d, idx) => {
                      const salesHeight = Math.max(10, Math.round((d.sales / maxDailySales) * 220));
                      const paidHeight = Math.max(5, Math.round((d.paid / maxDailySales) * 220));

                      return (
                        <div
                          key={idx}
                          className="flex-fill d-flex flex-column align-items-center h-100 justify-content-end"
                          title={`วันที่ ${d.date}\nยอดขาย: ฿${d.sales.toLocaleString()}\nเก็บได้: ฿${d.paid.toLocaleString()}\nจำนวน: ${d.count} บิล`}
                        >
                          <div className="d-flex align-items-end gap-1 w-100 justify-content-center">
                            {/* Sales Bar */}
                            <div
                              style={{
                                height: `${salesHeight}px`,
                                width: "42%",
                                backgroundColor: "#3b82f6",
                                borderRadius: "4px 4px 0 0",
                                transition: "height 0.3s ease",
                              }}
                            />
                            {/* Paid Bar */}
                            <div
                              style={{
                                height: `${paidHeight}px`,
                                width: "42%",
                                backgroundColor: "#22c55e",
                                borderRadius: "4px 4px 0 0",
                                transition: "height 0.3s ease",
                              }}
                            />
                          </div>
                          <span
                            className="text-muted mt-2 small text-truncate text-center"
                            style={{ fontSize: "0.68rem", width: "100%" }}
                          >
                            {d.date}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart 2: Debt Status Ratio & Collection Rate Gauge */}
          <div className="col-lg-4">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-header bg-white py-3">
                <h6 className="fw-bold text-dark mb-0">
                  <i className="bi bi-pie-chart text-success me-2"></i>
                  สัดส่วนการชำระเงิน vs หนี้ค้างชำระ
                </h6>
              </div>
              <div className="card-body p-4 text-center">
                {/* Progress bar visual */}
                <div className="mb-4">
                  <div className="d-flex justify-content-between small text-muted mb-1">
                    <span>จัดเก็บสำเร็จ</span>
                    <strong className="text-success">{summary.collectionRate}%</strong>
                  </div>
                  <div className="progress" style={{ height: "18px", borderRadius: "10px" }}>
                    <div
                      className="progress-bar bg-success"
                      role="progressbar"
                      style={{ width: `${summary.collectionRate}%` }}
                    />
                    <div
                      className="progress-bar bg-warning"
                      role="progressbar"
                      style={{ width: `${100 - summary.collectionRate}%` }}
                    />
                  </div>
                </div>

                <div className="list-group list-group-flush text-start small">
                  <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                    <div>
                      <span className="badge bg-success me-2">●</span>
                      <strong>ชำระเรียบร้อย (Paid)</strong>
                      <div className="text-muted small ps-3">{summary.paidCount.toLocaleString()} บิล</div>
                    </div>
                    <span className="fw-bold text-success">
                      ฿{summary.totalPaid.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3">
                    <div>
                      <span className="badge bg-warning text-dark me-2">●</span>
                      <strong>ค้างชำระ (Outstanding)</strong>
                      <div className="text-muted small ps-3">{summary.outstandingCount.toLocaleString()} บิล</div>
                    </div>
                    <span className="fw-bold text-danger">
                      ฿{summary.totalOutstanding.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="list-group-item d-flex justify-content-between align-items-center px-0 py-3 bg-light rounded mt-2 px-2">
                    <div>
                      <strong>ยอดรวมทั้งหมด ({days} วัน)</strong>
                    </div>
                    <span className="fw-bold text-dark">
                      ฿{summary.totalSales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart 3: Top Sales Reps Ranking */}
          <div className="col-12">
            <div className="card shadow-sm border-0">
              <div className="card-header bg-white py-3">
                <h6 className="fw-bold text-dark mb-0">
                  <i className="bi bi-trophy text-warning me-2"></i>
                  อันดับยอดขายแยกตามผู้แทนขาย (Top Sales Representatives ในรอบ {days} วัน)
                </h6>
              </div>
              <div className="card-body p-4">
                {repPerformance.length === 0 ? (
                  <div className="text-center py-4 text-muted">ไม่มีข้อมูลผู้แทนขายในช่วงนี้</div>
                ) : (
                  <div className="row g-3">
                    {repPerformance.map((item, index) => {
                      const percent = Math.min(100, Math.round((item.sales / maxRepSales) * 100));
                      return (
                        <div key={item.rep} className="col-md-6">
                          <div className="p-3 border rounded bg-light">
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <span className="fw-semibold text-dark">
                                #{index + 1} {item.rep}
                              </span>
                              <span className="fw-bold text-primary">
                                ฿{item.sales.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div className="d-flex justify-content-between small text-muted mb-1">
                              <span>จำนวนบิลขาย</span>
                              <span>{item.count} บิล</span>
                            </div>
                            <div className="progress" style={{ height: "8px", borderRadius: "4px" }}>
                              <div
                                className="progress-bar bg-primary"
                                role="progressbar"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
