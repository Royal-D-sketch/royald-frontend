"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Navbar from "../../components/Navbar";
import toast, { Toaster } from "react-hot-toast";

type Product = {
  id: number;
  product_code: string;
  product_name: string;
  unit: string;
  price: number;
  qty: number;
  amount: number;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // 2. Pagination state (แบ่งหน้าทีละ 20 รายการด้วย .range())
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Search filter
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ป้องกัน race condition และ infinite loops
  const requestIdRef = useRef(0);

  // Debounce search input (350ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // รีเซ็ตกลับไปหน้า 1 เมื่อพิมพ์ค้นหาใหม่
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 4. ฟังก์ชันดึงข้อมูลสินค้าที่ควบคุม Dependencies อย่างรัดกุม ป้องกัน Infinite Loop
  const fetchProducts = useCallback(async (targetPage: number, search: string) => {
    const currentId = ++requestIdRef.current;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        page: targetPage.toString(),
        search: search || "",
      });

      const res = await fetch(`/api/products?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch products");

      const resData = await res.json();

      // ตรวจสอบว่าเป็นผลลัพธ์จาก Request ล่าสุดเพื่อป้องกัน Race Conditions
      if (currentId === requestIdRef.current) {
        setProducts(resData.data || []);
        setTotal(resData.total || 0);
        setTotalPages(resData.totalPages || 1);
      }
    } catch (err: any) {
      if (currentId === requestIdRef.current) {
        toast.error("ไม่สามารถดึงข้อมูลรายการสินค้าได้");
      }
    } finally {
      if (currentId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // 4. useEffect สำหรับดึงข้อมูล ใช้เฉพาะ Primitive Dependencies (page, debouncedSearch)
  useEffect(() => {
    fetchProducts(page, debouncedSearch);
  }, [page, debouncedSearch, fetchProducts]);

  // คำนวณช่วงรายการที่กำลังแสดง
  const startItemIndex = total > 0 ? (page - 1) * pageSize + 1 : 0;
  const endItemIndex = Math.min(page * pageSize, total);

  // สร้างรายการปุ่มตัวเลขหน้า
  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisible = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      buttons.push(
        <button
          key={p}
          type="button"
          className={`btn btn-sm ${page === p ? "btn-primary fw-bold px-3" : "btn-outline-secondary px-3"}`}
          onClick={() => setPage(p)}
        >
          {p}
        </button>
      );
    }
    return buttons;
  };

  return (
    <div className="container py-4">
      <Toaster position="top-right" />

      {/* Shared Unified Navbar */}
      <Navbar />

      {/* Page Title & Optimization Highlight */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 gap-2">
        <div>
          <h3 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
            <i className="bi bi-box-seam text-primary"></i>แค็ตตาล็อกและรายการสินค้า (Products)
          </h3>
          <div className="text-muted small mt-1">
            แบ่งหน้าแสดงผลทีละ <strong>{pageSize} รายการ</strong> ด้วยคำสั่ง <code>.range()</code> ของ Supabase 
            และเลือกเฉพาะคอลัมน์ที่จำเป็น เพื่อลดการใช้ Egress แบนด์วิดท์
          </div>
        </div>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2 fw-medium">
            <i className="bi bi-lightning-charge me-1"></i>.range({(page - 1) * pageSize}, {page * pageSize - 1}) Active
          </span>
        </div>
      </div>

      {/* Search and Summary Control Bar */}
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
                  placeholder="ค้นหารหัสสินค้า หรือ ชื่อสินค้า..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setSearchTerm("")}
                  >
                    ล้างคำค้น
                  </button>
                )}
              </div>
            </div>

            <div className="col-md-6 text-md-end text-muted small">
              แสดงรายการที่ <strong className="text-dark">{startItemIndex.toLocaleString()}</strong> -{" "}
              <strong className="text-dark">{endItemIndex.toLocaleString()}</strong> จากทั้งหมด{" "}
              <strong className="text-primary">{total.toLocaleString()}</strong> รายการ (หน้า {page} / {totalPages})
            </div>
          </div>
        </div>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
          <p className="mt-2 text-muted">กำลังดึงรายการสินค้าหน้า {page} (ทีละ {pageSize} รายการ)...</p>
        </div>
      ) : (
        <div className="card shadow-sm border-0 mb-4">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: "70px" }} className="py-3 text-center">#</th>
                  <th style={{ width: "160px" }} className="py-3">รหัสสินค้า</th>
                  <th className="py-3">ชื่อสินค้า / รายละเอียด</th>
                  <th style={{ width: "120px" }} className="py-3 text-center">หน่วยนับ</th>
                  <th style={{ width: "140px" }} className="py-3 text-end">ราคาต่อหน่วย</th>
                  <th style={{ width: "130px" }} className="py-3 text-end">จำนวน</th>
                  <th style={{ width: "150px" }} className="py-3 text-end">มูลค่ารวม</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-1 d-block mb-2 text-secondary"></i>
                      ไม่พบรายการสินค้าตรงกับเงื่อนไขที่ค้นหา<br />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="btn btn-outline-primary btn-sm mt-3"
                        >
                          ล้างการค้นหา
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  products.map((item, index) => (
                    <tr key={item.id || item.product_code || index}>
                      <td className="text-center text-muted small">
                        {startItemIndex + index}
                      </td>
                      <td className="fw-semibold text-primary">
                        <span className="badge bg-light text-primary border">
                          {item.product_code}
                        </span>
                      </td>
                      <td className="fw-medium text-dark">
                        {item.product_name}
                      </td>
                      <td className="text-center">
                        <span className="badge bg-secondary-subtle text-secondary px-2 py-1">
                          {item.unit || "ชิ้น"}
                        </span>
                      </td>
                      <td className="text-end">
                        ฿{Number(item.price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-end fw-semibold text-secondary">
                        {Number(item.qty || 0).toLocaleString()}
                      </td>
                      <td className="text-end fw-bold text-success">
                        ฿{Number(item.amount || item.price * (item.qty || 1) || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Pagination Navigation Bar (20 รายการต่อหน้า) */}
      {totalPages > 1 && (
        <div className="card shadow-sm border-0 p-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div className="text-muted small">
              แสดงหน้า <strong>{page}</strong> จากทั้งหมด <strong>{totalPages}</strong> หน้า (หน้าละ {pageSize} รายการ)
            </div>

            <div className="btn-toolbar" role="toolbar">
              <div className="btn-group me-2" role="group">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                  title="หน้าแรก"
                >
                  <i className="bi bi-chevron-double-left"></i>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page <= 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                  title="ก่อนหน้า"
                >
                  <i className="bi bi-chevron-left"></i> ก่อนหน้า
                </button>
              </div>

              <div className="btn-group me-2" role="group">
                {renderPaginationButtons()}
              </div>

              <div className="btn-group" role="group">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                  title="ถัดไป"
                >
                  ถัดไป <i className="bi bi-chevron-right"></i>
                </button>
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(totalPages)}
                  title="หน้าสุดท้าย"
                >
                  <i className="bi bi-chevron-double-right"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
