"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";

interface NavbarProps {
  onOpenUpload?: () => void;
}

export default function Navbar({ onOpenUpload }: NavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const user = session?.user as any;

  const navLinks = [
    {
      href: "/sales-dashboard",
      label: "แดชบอร์ดติดตามบิล",
      icon: "bi-speedometer2",
      badge: "บิล & ลูกหนี้",
    },
    {
      href: "/products",
      label: "แสดงรายการสินค้า",
      icon: "bi-box-seam",
      badge: "แบ่งหน้า 20 รายการ",
    },
    {
      href: "/charts",
      label: "กราฟวิเคราะห์ยอดขาย",
      icon: "bi-graph-up-arrow",
      badge: "สรุป 7-30 วัน",
    },
  ];

  return (
    <header className="mb-4">
      {/* Top Brand Banner */}
      <div className="d-flex flex-wrap justify-content-between align-items-center pb-3 border-bottom gap-2">
        <div>
          <div className="d-flex align-items-center gap-2">
            <span
              className="badge text-white px-2 py-1 fw-bold"
              style={{ backgroundColor: "#15803d", fontSize: "0.85rem" }}
            >
              ROYAL-D
            </span>
            <h2 className="fw-bold mb-0" style={{ color: "#1e3a8a", fontSize: "1.6rem" }}>
              ระบบจัดการและติดตามยอดขายลูกหนี้
            </h2>
          </div>
          <div className="text-muted small mt-1">
            ผู้ใช้งาน: <strong className="text-dark">{user?.name || user?.username || "Admin"}</strong> | 
            ตำแหน่ง: <span className="badge bg-primary ms-1">{user?.job_position || "Admin"}</span>
            <span className="ms-2 badge bg-success-subtle text-success border border-success-subtle">
              <i className="bi bi-cloud-check-fill text-success me-1"></i>Cloudflare D1 (Zero Egress)
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex gap-2">
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="btn btn-primary btn-sm fw-semibold shadow-sm px-3"
            >
              <i className="bi bi-cloud-arrow-up-fill me-1"></i> อัปโหลดบิล (CD / Excel)
            </button>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn btn-outline-danger btn-sm fw-semibold shadow-sm"
          >
            <i className="bi bi-box-arrow-right me-1"></i> ออกจากระบบ
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="mt-3">
        <ul className="nav nav-pills gap-2 bg-white p-2 rounded-3 shadow-sm border">
          {navLinks.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li className="nav-item" key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link d-flex align-items-center gap-2 fw-semibold px-3 py-2 ${
                    isActive
                      ? "active bg-primary text-white shadow-sm"
                      : "text-secondary hover-bg-light"
                  }`}
                  style={{ borderRadius: "8px", transition: "all 0.15s ease" }}
                >
                  <i className={`bi ${item.icon}`}></i>
                  <span>{item.label}</span>
                  <span
                    className={`badge ms-1 small ${
                      isActive ? "bg-white text-primary" : "bg-light text-muted border"
                    }`}
                    style={{ fontSize: "0.7rem", fontWeight: 600 }}
                  >
                    {item.badge}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
