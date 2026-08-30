"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import dayjs from "dayjs";
import PaymentModal from "../../components/PaymentModal";
import toast, { Toaster } from "react-hot-toast";

type Bill = {
  BillNo: string;
  Date: string;
  CustomerName: string;
  TotalAmount: string | number;
};

export default function SalesDashboard() {
  const { data: session } = useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const fetchBills = async () => {
    try {
      const res = await fetch("/api/bills");
      if (!res.ok) throw new Error("Failed to fetch bills");
      const data = await res.json();
      setBills(data);
    } catch (err) {
      toast.error("ไม่สามารถดึงข้อมูลบิลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, []);

  const openModal = (billNo: string) => {
    setSelectedBill(billNo);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedBill(null);
  };

  const handleSuccess = () => {
    fetchBills();
    closeModal();
  };

  const userObj = session?.user as any;

  return (
    <div className="container py-4">
      <Toaster position="top-right" />

      {/* Header Bar with User Info & Logout */}
      <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom">
        <div>
          <h2 className="fw-bold mb-1" style={{ color: "#1e3a8a" }}>
            <i className="bi bi-receipt-cutoff me-2"></i>ระบบติดตามบิลขายและการ์ดลูกหนี้
          </h2>
          <div className="text-muted small">
            ผู้ใช้งาน: <strong className="text-dark">{userObj?.name || userObj?.username || "ผู้ใช้ระบบ"}</strong> | 
            ตำแหน่ง: <span className="badge bg-primary ms-1">{userObj?.job_position || "SalesRep"}</span> | 
            สิทธิ์ดาวน์โหลด: <span className={`badge ${userObj?.can_download ? 'bg-success' : 'bg-secondary'} ms-1`}>{userObj?.can_download ? 'อนุญาต' : 'ไม่อนุญาต'}</span>
          </div>
        </div>
        <div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn btn-outline-danger btn-sm fw-semibold shadow-sm"
          >
            <i className="bi bi-box-arrow-right me-1"></i> ออกจากระบบ (Logout)
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">กำลังโหลดข้อมูลบิล...</p>
        </div>
      ) : (
        <div className="card shadow-sm border-0">
          <div className="card-header bg-white py-3">
            <h5 className="mb-0 fw-bold text-dark">
              <i className="bi bi-list-columns-reverse me-2 text-primary"></i>
              รายการบิลขาย (Sales Bills)
            </h5>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th className="py-3">เลขที่บิล</th>
                  <th className="py-3">วันที่ (DD/MM/YYYY)</th>
                  <th className="py-3">ชื่อลูกค้า</th>
                  <th className="py-3 text-end">จำนวนเงิน (บาท)</th>
                  <th className="py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-muted">
                      ไม่พบข้อมูลบิลขายในระบบ
                    </td>
                  </tr>
                ) : (
                  bills.map((b) => (
                    <tr key={b.BillNo}>
                      <td className="fw-semibold text-primary">{b.BillNo}</td>
                      <td>{dayjs(b.Date).format("DD/MM/YYYY")}</td>
                      <td>{b.CustomerName}</td>
                      <td className="text-end fw-bold">
                        {Number(b.TotalAmount || 0).toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="text-center">
                        <button
                          className="btn btn-sm btn-success fw-semibold px-3 shadow-sm"
                          onClick={() => openModal(b.BillNo)}
                        >
                          <i className="bi bi-cash-stack me-1"></i> บันทึกรับชำระเงิน
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

      {showModal && selectedBill && (
        <PaymentModal
          billNo={selectedBill}
          onClose={closeModal}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
