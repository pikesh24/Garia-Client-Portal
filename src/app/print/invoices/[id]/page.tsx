"use client";

import { useParams } from "next/navigation";
import { useInvoiceDetail } from "@/lib/useInvoiceDetail";
import { InvoicePrintDocument } from "@/components/invoice/InvoicePrintDocument";

// Rendered only by the headless-Chromium PDF route (src/app/api/pdf/invoice/[id]/route.ts) --
// no app chrome (sidebar/nav), just the exact invoice document. The route sets
// garia_access_token in localStorage before navigating here (mirroring how the SPA itself
// authenticates), then waits for [data-print-ready] before calling page.pdf().
export default function PrintInvoicePage() {
  const params = useParams<{ id: string }>();
  const { invoice, detail, billedToName, billedToEmail, projectName, loading, error } = useInvoiceDetail(params.id);

  if (error) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Failed to load invoice: {error}</div>;
  }
  if (loading || !invoice) {
    return <div style={{ padding: 40, fontFamily: "sans-serif" }}>Loading…</div>;
  }

  return (
    <div data-print-ready="true">
      <InvoicePrintDocument
        invoice={invoice}
        detail={detail}
        billedToName={billedToName}
        billedToEmail={billedToEmail}
        projectName={projectName}
      />
    </div>
  );
}
