"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import dayjs from "dayjs";
import PaymentModal from "../../components/PaymentModal";
import Navbar from "../../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

type Bill = {
  BillNo: string;
  Date: string;
  CustomerName: string;
  TotalAmount: number;
  RemainingAmount: number;
  Status: string;
  SalesRep: string;
  Province: string;
};

export default function SalesDashboard() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Search & Status Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // 3. Date Range Filter (ค่าเริ่มต้นย้อนหลัง 30 วัน เพื่อลด Supabase Egress)
  const [daysFilter, setDaysFilter] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showCustomDate, setShowCustomDate] = useState(false);

  // ป้องกัน race condition ในการ Fetch ข้อมูล
  const fetchCountRef = useRef(0);

  // 4. ฟังก์ชันดึงข้อมูลที่ออกแบบมาเพื่อป้องกัน Infinite Loop อย่างรัดกุม
  const fetchBills = useCallback(async (days: string, start?: string, end?: string) => {
    const currentFetchId = ++fetchCountRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (days === "custom" && start && end) {
        params.append("startDate", start);
        params.append("endDate", end);
      } else if (days !== "all") {
        params.append("days", days || "30");
      }

      const res = await fetch(`/api/bills?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch bills");

      const data = await res.json();
      // อัปเดตเฉพาะเมื่อคำขอเป็นครั้งล่าสุด เพื่อป้องกัน race condition
      if (currentFetchId === fetchCountRef.current) {
        setBills(data);
      }
    } catch (err) {
      if (currentFetchId === fetchCountRef.current) {
        toast.error("ไม่สามารถดึงข้อมูลบิลได้");
      }
    } finally {
      if (currentFetchId === fetchCountRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 4. ตรวจสอบความถูกต้องของ useEffect ให้ใช้เฉพาะ Primitive Dependencies ป้องกัน Infinite Loop
  useEffect(() => {
    if (daysFilter === "custom") {
      if (customStart && customEnd) {
        fetchBills("custom", customStart, customEnd);
      }
    } else {
      fetchBills(daysFilter);
    }
  }, [daysFilter, customStart, customEnd, fetchBills]);

  const openModal = (billNo: string) => {
    setSelectedBill(billNo);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBill(null);
  };

  const handleSuccess = () => {
    fetchBills(daysFilter, customStart, customEnd);
    closeModal();
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("กรุณาเลือกไฟล์เพื่ออัปโหลด");
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", uploadFile);

    try {
      const res = await fetch("/api/upload-cd", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "อัปโหลดและนำเข้าบิลสำเร็จ");
        setShowUploadModal(false);
        setUploadFile(null);
        fetchBills(daysFilter, customStart, customEnd);
      } else {
        toast.error(data.error || "เกิดข้อผิดพลาดในการอัปโหลด");
      }
    } catch (err) {
      toast.error("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์อัปโหลดได้");
    } finally {
      setUploading(false);
    }
  };

  // Filter bills on client side for fast text search
  const filteredBills = bills.filter((b) => {
    const matchSearch =
      b.BillNo.toLowerCase().includes(search.toLowerCase()) ||
      b.CustomerName.toLowerCase().includes(search.toLowerCase()) ||
      (b.SalesRep && b.SalesRep.toLowerCase().includes(search.toLowerCase())) ||
      (b.Province && b.Province.toLowerCase().includes(search.toLowerCase()));

    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "outstanding" && b.Status !== "Paid") ||
      (statusFilter === "paid" && b.Status === "Paid");

    return matchSearch && matchStatus;
  });

  const totalAmountSum = filteredBills.reduce((acc, cur) => acc + Number(cur.TotalAmount || 0), 0);
  const remainingSum = filteredBills.reduce((acc, cur) => acc + Number(cur.RemainingAmount || 0), 0);
  const paidSum = Math.max(0, totalAmountSum - remainingSum);

  return (
    <div className="container py-4">
      <Toaster position="top-right" />

      {/* Shared Unified Navbar */}
      <Navbar onOpenUpload={() => setShowUploadModal(true)} />

      {/* 3. Date Range Filter Toolbar for Supabase Egress Optimization */}
      <div className="card shadow-sm border-0 mb-4 bg-light">
        <div className="card-body p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold text-dark small">
                <i className="bi bi-calendar3 me-1 text-primary"></i>กรองช่วงวันที่ (ลด Egress):
              </span>
              <div className="btn-group btn-group-sm">
                {[
                  { key: "7", label: "7 วันล่าสุด" },
                  { key: "14", label: "14 วัน" },
                  { key: "30", label: "30 วัน (แนะนำ)" },
                  { key: "60", label: "60 วัน" },
                  { key: "all", label: "ทั้งหมด" },
                  { key: "custom", label: "กำหนดเอง" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`btn btn-sm ${
                      daysFilter === item.key ? "btn-primary fw-bold" : "btn-outline-secondary"
                    }`}
                    onClick={() => {
                      setDaysFilter(item.key);
                      setShowCustomDate(item.key === "custom");
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-muted small">
              <i className="bi bi-info-circle me-1 text-info"></i>
              {daysFilter === "all"
                ? "กำลังดึงข้อมูลทั้งหมด"
                : daysFilter === "custom"
                ? "กรองตามช่วงวันที่ระบุ"
                : `ดึงเฉพาะบิลย้อนหลัง ${daysFilter} วัน (ประหยัดแบนด์วิดท์)`}
            </div>
          </div>

          {/* Custom Date Inputs */}
          {showCustomDate && (
            <div className="row g-2 mt-2 pt-2 border-top">
              <div className="col-auto">
                <label className="form-label small mb-0 fw-semibold">ตั้งแต่วันที่:</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="col-auto">
                <label className="form-label small mb-0 fw-semibold">ถึงวันที่:</label>
                <input
                  type="date"
                  className="form-control form-control-sm"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-primary text-white p-3 h-100">
            <div className="small text-white-50">จำนวนบิลขาย ({daysFilter !== "all" ? `${daysFilter} วัน` : "ทั้งหมด"})</div>
            <h3 className="fw-bold mb-0">{filteredBills.length.toLocaleString()} บิล</h3>
            <div className="small text-white-50 mt-1">คัดเฉพาะคอลัมน์ที่แสดง</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-info text-dark p-3 h-100">
            <div className="small text-muted">ยอดขายรวม</div>
            <h3 className="fw-bold mb-0">฿{totalAmountSum.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-muted mt-1">มูลค่ารวมในรอบนี้</div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-success text-white p-3 h-100">
            <div className="small text-white-50">ยอดชำระแล้ว</div>
            <h3 className="fw-bold mb-0">฿{paidSum.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-white-50 mt-1">
              {totalAmountSum > 0 ? `${((paidSum / totalAmountSum) * 100).toFixed(1)}% ของยอดรวม` : "-"}
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm border-0 bg-warning text-dark p-3 h-100">
            <div className="small text-muted">ยอดค้างชำระ</div>
            <h3 className="fw-bold mb-0 text-danger">฿{remainingSum.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</h3>
            <div className="small text-muted mt-1">ต้องติดตามเก็บเงิน</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card shadow-sm border-0 mb-4">
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-md-6">
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="ค้นหาเลขที่บิล, ชื่อลูกค้า, จังหวัด, หรือผู้แทนขาย..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-6 text-md-end">
              <div className="btn-group">
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === "all" ? "btn-dark" : "btn-outline-secondary"}`}
                  onClick={() => setStatusFilter("all")}
                >
                  ทั้งหมด ({bills.length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === "outstanding" ? "btn-danger" : "btn-outline-danger"}`}
                  onClick={() => setStatusFilter("outstanding")}
                >
                  ค้างชำระ ({bills.filter(b => b.Status !== "Paid").length})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${statusFilter === "paid" ? "btn-success" : "btn-outline-success"}`}
                  onClick={() => setStatusFilter("paid")}
                >
                  ชำระครบแล้ว ({bills.filter(b => b.Status === "Paid").length})
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">กำลังดึงข้อมูลบิลขาย (กรองช่วงวันที่ {daysFilter} วัน)...</p>
        </div>
      ) : (
        <div className="card shadow-sm border-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-3">เลขที่บิล</th>
                  <th className="py-3">วันที่ (DD/MM/YYYY)</th>
                  <th className="py-3">ชื่อลูกค้า</th>
                  <th className="py-3">จังหวัด</th>
                  <th className="py-3">ผู้แทนขาย</th>
                  <th className="py-3 text-end">ยอดรวม (บาท)</th>
                  <th className="py-3 text-end">คงเหลือ (บาท)</th>
                  <th className="py-3 text-center">สถานะ</th>
                  <th className="py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredBills.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
                      ไม่พบข้อมูลบิลขายในช่วงวันที่เลือก ({daysFilter !== "all" ? `${daysFilter} วันย้อนหลัง` : "ทั้งหมด"})<br />
                      <button
                        onClick={() => setShowUploadModal(true)}
                        className="btn btn-outline-primary btn-sm mt-3"
                      >
                        <i className="bi bi-upload me-1"></i> คลิกที่นี่เพื่ออัปโหลดไฟล์บิลขาย
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredBills.map((b) => (
                    <tr key={b.BillNo}>
                      <td className="fw-semibold text-primary">{b.BillNo}</td>
                      <td>{b.Date ? dayjs(b.Date).format("DD/MM/YYYY") : "-"}</td>
                      <td className="fw-medium">{b.CustomerName}</td>
                      <td><span className="text-secondary small">{b.Province || "-"}</span></td>
                      <td><span className="badge bg-light text-dark border">{b.SalesRep || "-"}</span></td>
                      <td className="text-end">
                        {Number(b.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end fw-bold text-danger">
                        {Number(b.RemainingAmount || b.TotalAmount || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-center">
                        {b.Status === "Paid" ? (
                          <span className="badge bg-success">ชำระแล้ว</span>
                        ) : (
                          <span className="badge bg-warning text-dark">ค้างชำระ</span>
                        )}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-success fw-semibold px-3 shadow-sm"
                          onClick={() => openModal(b.BillNo)}
                        >
                          <i className="bi bi-cash-stack me-1"></i> รับชำระเงิน
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showModal && selectedBill && (
        <PaymentModal
          billNo={selectedBill}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="modal fade show" style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-cloud-arrow-up-fill me-2"></i> อัปโหลดไฟล์บิลขาย (CD Organizer / CSV)
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowUploadModal(false)}></button>
              </div>
              <form onSubmit={handleUploadSubmit}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label fw-bold text-muted small">เลือกไฟล์บิลขาย (.csv / .txt)</label>
                    <input
                      type="file"
                      className="form-control form-control-lg"
                      accept=".csv,.txt"
                      required
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                    <div className="form-text small mt-2">
                      รองรับไฟล์ส่งออกจากโปรแกรม CD Organizer โดยระบบจะล็อกรูปแบบวันที่ DD/MM/YYYY อัตโนมัติ
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                    ยกเลิก
                  </button>
                  <button type="submit" disabled={uploading} className="btn btn-primary fw-bold px-4">
                    {uploading ? "กำลังนำเข้าข้อมูล..." : "เริ่มอัปโหลด"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
