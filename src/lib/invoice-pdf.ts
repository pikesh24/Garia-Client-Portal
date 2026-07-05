import jsPDF from "jspdf";

// Renders the invoice PDF by drawing directly with jsPDF's vector primitives (text/rect/line)
// instead of rasterizing the on-screen DOM via html2canvas. html2canvas 1.4.1 was found to
// mangle text (dropping spaces/periods) for this layout regardless of font, scale, or
// font-load timing — a vector PDF sidesteps that class of bug entirely and produces a
// smaller, crisper, text-selectable file.

const INK = "#2A2E33";
const MUTED = "#8A8F95";
const MUTED_ON_DARK = "#c1c7ce";
const GREEN = "#15BB00";
const WHITE = "#FFFFFF";

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 40;
const CONTENT_W = PAGE_W - MARGIN * 2;

export interface InvoicePdfItem {
  id: number;
  name: string;
  code: string | null;
  description: string;
  hoursLine: string;
  agreement: string | null;
  price: string;
  externals: { name: string; price: string }[];
}

export interface InvoicePdfGroup {
  tag: string;
  label: string;
  tagBg: string;
  tagColor: string;
  items: InvoicePdfItem[];
}

export interface InvoicePdfData {
  invoiceNumber: string;
  status: string;
  statusBg: string;
  statusColor: string;
  issuedDate: string;
  dueDate: string;
  billedToName: string;
  billedToEmail: string;
  projectName: string;
  groups: InvoicePdfGroup[];
  maintenance: { k: string; v: string }[] | null;
  discount: { name: string; pctLabel: string } | null;
  recurringNote: string | null;
  totals: { k: string; v: string }[];
  totalDue: string;
  footerNote: string;
  logoUrl: string;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [parseInt(clean.substring(0, 2), 16), parseInt(clean.substring(2, 4), 16), parseInt(clean.substring(4, 6), 16)];
}

function fill(doc: jsPDF, hex: string) {
  doc.setFillColor(...hexToRgb(hex));
}
function draw(doc: jsPDF, hex: string) {
  doc.setDrawColor(...hexToRgb(hex));
}
function ink(doc: jsPDF, hex: string) {
  doc.setTextColor(...hexToRgb(hex));
}

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

interface Cursor {
  y: number;
}

function ensureSpace(doc: jsPDF, cursor: Cursor, needed: number) {
  if (cursor.y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    cursor.y = MARGIN;
  }
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const cursor: Cursor = { y: MARGIN };
  const logoDataUrl = await loadImageDataUrl(data.logoUrl);

  // ---- Header ----
  const headerTop = cursor.y;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", MARGIN, headerTop, 26, 26);
    } catch {
      // best-effort — skip the logo if the image can't be embedded
    }
  }
  ink(doc, INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("GARIA", MARGIN + 34, headerTop + 12);
  doc.text("SOLUTIONS", MARGIN + 34, headerTop + 27);

  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  ink(doc, MUTED);
  doc.text("GARIA SOFTWARE PVT. LTD.", MARGIN, headerTop + 44);
  doc.text("billing@garia.solutions", MARGIN, headerTop + 54);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  ink(doc, INK);
  doc.text("INVOICE", PAGE_W - MARGIN, headerTop + 15, { align: "right" });
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  doc.text(`#${data.invoiceNumber}`, PAGE_W - MARGIN, headerTop + 27, { align: "right" });

  const badgeW = doc.getTextWidth(data.status.toUpperCase()) + 14;
  fill(doc, data.statusBg);
  doc.rect(PAGE_W - MARGIN - badgeW, headerTop + 34, badgeW, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  ink(doc, data.statusColor);
  doc.text(data.status.toUpperCase(), PAGE_W - MARGIN - badgeW / 2, headerTop + 43.5, { align: "center" });

  cursor.y = headerTop + 62;
  draw(doc, INK);
  doc.setLineWidth(2.2);
  doc.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
  cursor.y += 18;

  // ---- Billed To / Project / Dates box ----
  const boxTop = cursor.y;
  const boxH = 70;
  const col1X = MARGIN;
  const col2X = MARGIN + CONTENT_W * 0.4;
  const col3X = MARGIN + CONTENT_W * 0.68;
  draw(doc, INK);
  doc.setLineWidth(1.4);
  doc.rect(MARGIN, boxTop, CONTENT_W, boxH, "S");
  doc.line(col2X, boxTop, col2X, boxTop + boxH);
  doc.line(col3X, boxTop, col3X, boxTop + boxH);

  function labelValue(x: number, label: string, value: string, sub?: string) {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    ink(doc, MUTED);
    doc.text(label, x, boxTop + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    ink(doc, INK);
    doc.text(value, x, boxTop + 32);
    if (sub) {
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      ink(doc, MUTED);
      doc.text(sub, x, boxTop + 44);
    }
  }
  labelValue(col1X + 12, "BILLED TO", data.billedToName, data.billedToEmail);
  labelValue(col2X + 12, "PROJECT", data.projectName);

  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  ink(doc, MUTED);
  doc.text("DATES", col3X + 12, boxTop + 16);
  doc.text("ISSUED", col3X + 12, boxTop + 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ink(doc, INK);
  doc.text(data.issuedDate, col3X + 12, boxTop + 40);
  doc.setFont("courier", "normal");
  doc.setFontSize(7);
  ink(doc, MUTED);
  doc.text("DUE", col3X + 12, boxTop + 52);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  ink(doc, INK);
  doc.text(data.dueDate, col3X + 12, boxTop + 64);

  cursor.y = boxTop + boxH + 14;

  // ---- Line item groups ----
  for (const group of data.groups) {
    ensureSpace(doc, cursor, 40);
    const barTop = cursor.y;
    fill(doc, INK);
    doc.rect(MARGIN, barTop, CONTENT_W, 20, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    const tagW = doc.getTextWidth(group.tag) + 12;
    fill(doc, group.tagBg);
    doc.rect(MARGIN + 8, barTop + 5, tagW, 11, "F");
    ink(doc, group.tagColor);
    doc.text(group.tag, MARGIN + 8 + tagW / 2, barTop + 13, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    ink(doc, WHITE);
    doc.text(group.label, MARGIN + 20 + tagW, barTop + 13.5);

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    ink(doc, MUTED_ON_DARK);
    const countLabel = `${group.items.length} ${group.items.length === 1 ? "FEATURE" : "FEATURES"}`;
    doc.text(countLabel, PAGE_W - MARGIN - 8, barTop + 13, { align: "right" });

    cursor.y = barTop + 20;

    for (const item of group.items) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(item.description, CONTENT_W - 24 - 100);
      const externalLines = item.externals.length;
      const itemH = 20 + descLines.length * 11 + 14 + (externalLines > 0 ? 16 + externalLines * 13 : 0) + 10;
      ensureSpace(doc, cursor, itemH + 4);

      const itemTop = cursor.y;
      draw(doc, INK);
      doc.setLineWidth(1.2);
      doc.rect(MARGIN, itemTop, CONTENT_W, itemH, "S");

      let ty = itemTop + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11.5);
      ink(doc, INK);
      doc.text(item.name, MARGIN + 12, ty);
      const nameW = doc.getTextWidth(item.name);

      if (item.code) {
        doc.setFont("courier", "normal");
        doc.setFontSize(8);
        ink(doc, MUTED);
        doc.text(` · ${item.code}`, MARGIN + 12 + nameW, ty);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      ink(doc, GREEN);
      doc.text(item.price, PAGE_W - MARGIN - 12, ty, { align: "right" });

      ty += 12;
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      ink(doc, MUTED);
      for (const line of descLines) {
        doc.text(line, MARGIN + 12, ty);
        ty += 11;
      }

      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);
      ink(doc, INK);
      doc.text(item.hoursLine, MARGIN + 12, ty);
      if (item.agreement) {
        const hoursW = doc.getTextWidth(item.hoursLine);
        ink(doc, MUTED);
        doc.text(`  (Agreement ${item.agreement})`, MARGIN + 12 + hoursW, ty);
      }
      ty += 14;

      if (item.externals.length > 0) {
        draw(doc, INK);
        doc.setLineWidth(0.6);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(MARGIN + 12, ty - 6, PAGE_W - MARGIN - 12, ty - 6);
        doc.setLineDashPattern([], 0);

        doc.setFont("courier", "normal");
        doc.setFontSize(7);
        ink(doc, MUTED);
        doc.text(`EXTERNAL SERVICES (${item.externals.length}) · RECURRING`, MARGIN + 12, ty);
        ty += 12;
        for (const ext of item.externals) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          ink(doc, INK);
          doc.text(ext.name, MARGIN + 12, ty);
          doc.setFont("courier", "bold");
          doc.text(ext.price, PAGE_W - MARGIN - 12, ty, { align: "right" });
          ty += 13;
        }
      }

      cursor.y = itemTop + itemH;
    }
    cursor.y += 8;
  }

  // ---- Maintenance / Discount / Totals ----
  cursor.y += 6;
  ensureSpace(doc, cursor, 140);
  const bottomTop = cursor.y;
  const leftX = MARGIN;
  const rightX = MARGIN + CONTENT_W / 2 + 10;
  const colW = CONTENT_W / 2 - 10;
  let leftY = bottomTop;
  let rightY = bottomTop;

  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  ink(doc, INK);
  doc.text("MAINTENANCE PROFILE", leftX, leftY);
  leftY += 12;

  if (data.maintenance) {
    for (const row of data.maintenance) {
      doc.setFont("courier", "normal");
      doc.setFontSize(8.5);
      ink(doc, MUTED);
      doc.text(row.k, leftX, leftY);
      doc.setFont("courier", "bold");
      ink(doc, INK);
      doc.text(row.v, leftX + colW, leftY, { align: "right" });
      draw(doc, INK);
      doc.setLineWidth(0.5);
      doc.line(leftX, leftY + 3, leftX + colW, leftY + 3);
      leftY += 13;
    }
  } else {
    doc.setFont("courier", "normal");
    doc.setFontSize(8.5);
    ink(doc, MUTED);
    doc.text("No maintenance cycle on file.", leftX, leftY);
    leftY += 13;
  }

  if (data.discount) {
    leftY += 6;
    draw(doc, INK);
    doc.setLineWidth(1.2);
    doc.rect(leftX, leftY, colW, 34, "S");
    doc.setFont("courier", "bold");
    doc.setFontSize(11);
    ink(doc, GREEN);
    doc.text(data.discount.name, leftX + 10, leftY + 15);
    doc.text(data.discount.pctLabel, leftX + colW - 10, leftY + 15, { align: "right" });
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    ink(doc, MUTED);
    doc.text("Currently active for this project", leftX + 10, leftY + 27);
    leftY += 34;
  }

  if (data.recurringNote) {
    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    ink(doc, MUTED);
    doc.text(data.recurringNote, rightX, rightY);
    rightY += 14;
  }
  for (const row of data.totals) {
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    ink(doc, MUTED);
    doc.text(row.k, rightX, rightY);
    doc.setFont("courier", "bold");
    ink(doc, INK);
    doc.text(row.v, rightX + colW, rightY, { align: "right" });
    rightY += 15;
  }

  rightY += 4;
  fill(doc, INK);
  doc.rect(rightX, rightY, colW, 26, "F");
  doc.setFont("courier", "bold");
  doc.setFontSize(9);
  ink(doc, WHITE);
  doc.text("TOTAL DUE", rightX + 10, rightY + 16.5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(data.totalDue, rightX + colW - 10, rightY + 17.5, { align: "right" });
  rightY += 26;

  cursor.y = Math.max(leftY, rightY) + 16;

  // ---- Footer ----
  ensureSpace(doc, cursor, 30);
  draw(doc, INK);
  doc.setLineWidth(1.2);
  doc.line(MARGIN, cursor.y, PAGE_W - MARGIN, cursor.y);
  cursor.y += 12;
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  ink(doc, MUTED);
  const footerLines = doc.splitTextToSize(data.footerNote, CONTENT_W);
  for (const line of footerLines) {
    doc.text(line, MARGIN, cursor.y);
    cursor.y += 10;
  }

  return doc;
}
