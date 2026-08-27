import { NextRequest, NextResponse } from "next/server";
import { Browser, chromium } from "playwright";

export const runtime = "nodejs";

// A single headless Chromium instance is reused across requests -- launching one per PDF
// download would add several hundred ms and isn't necessary since pages/contexts are already
// isolated per request.
let browserPromise: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ args: ["--no-sandbox"] });
  }
  return browserPromise;
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ detail: "Missing Authorization header" }, { status: 401 });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const browser = await getBrowser();
  // The invoice document is a fixed 794px-wide layout (InvoicePrintDocument's w-[794px], sized
  // to match A4's printable width at 96 CSS px/in). page.pdf() maps CSS pixels straight onto the
  // paper -- it does NOT scale the page's layout viewport to fit the paper size. Leaving the
  // context at Playwright's default viewport (1280px) made the document lay out at 794px inside
  // a wider canvas and print left-aligned on the page, leaving a blank strip on the right.
  const context_ = await browser.newContext({ viewport: { width: 794, height: 1123 } });
  try {
    const page = await context_.newPage();
    await page.addInitScript((t: string) => {
      window.localStorage.setItem("garia_access_token", t);
    }, token);

    const target = new URL(`/print/invoices/${id}`, req.nextUrl.origin);
    await page.goto(target.toString(), { waitUntil: "networkidle" });

    // An expired/invalid token makes the print page's useAuth() bounce to /login instead of
    // ever rendering [data-print-ready] -- fail fast with a clear 401 instead of burning the
    // full waitForSelector timeout on a page that will never show it.
    if (new URL(page.url()).pathname === "/login") {
      return NextResponse.json({ detail: "Session expired" }, { status: 401 });
    }
    await page.waitForSelector("[data-print-ready='true']", { timeout: 15000 });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Garia_Invoice_${id}.pdf"`,
      },
    });
  } catch (err) {
    console.error("PDF render failed", err);
    return NextResponse.json({ detail: "Failed to render invoice PDF" }, { status: 500 });
  } finally {
    await context_.close();
  }
}
