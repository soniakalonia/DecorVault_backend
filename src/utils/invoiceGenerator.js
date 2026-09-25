const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const { buildInvoiceHTML } = require("./invoiceTemplate");

// ─── Reuse a single browser instance across calls ───
let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    try {
      const b = await browserPromise;
      if (b.isConnected()) return b;
    } catch {
      /* fall through and relaunch */
    }
  }

  browserPromise = puppeteer.launch({
    headless: true, // ← more stable than "new" on Windows
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", // helps when /dev/shm is small
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--disable-extensions",
    ],
    timeout: 60000,               // ← allow up to 60s to launch
    protocolTimeout: 120000,      // ← allow up to 2min for page ops
  });

  return browserPromise;
}

async function generateInvoicePDF({ order, items, user }) {
  const company = {
    name: process.env.COMPANY_NAME || "Company",
    tagline: process.env.COMPANY_TAGLINE || "",
    address: process.env.COMPANY_ADDRESS || "",
    email: process.env.COMPANY_EMAIL || "",
    phone: process.env.COMPANY_PHONE || "",
    gstin: process.env.COMPANY_GSTIN || "",
    cin: process.env.COMPANY_CIN || "",
    logoUrl: process.env.COMPANY_LOGO_URL || "",
  };

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

  let address = {};
  try {
    address =
      typeof order.address === "string"
        ? JSON.parse(order.address)
        : order.address || {};
  } catch {
    address = {};
  }

  const orderNumber =
    order.order_number || `ORD-${String(order.id).padStart(3, "0")}`;
  const trackingUrl = `${frontendUrl}/order-tracking?orderId=${order.id}`;

  let qrDataUri = "";
  try {
    qrDataUri = await QRCode.toDataURL(trackingUrl, {
      width: 144,
      margin: 1,
      errorCorrectionLevel: "M",
    });
  } catch (e) {
    console.warn("[invoice] QR generation failed:", e.message);
  }

  const invoice = {
    orderNumber,
    orderDate: order.created_at
      ? new Date(order.created_at).toLocaleDateString("en-GB")
      : new Date().toLocaleDateString("en-GB"),
    customerName: user?.full_name || "Customer",
    customerEmail: user?.email || "",
    customerPhone: user?.mobile || "",
    address,
    items: (items || []).map((it) => ({
      name: it.product_name || it.name || "Item",
      quantity: Number(it.quantity || 0),
      price: Number(it.price || 0),
      total: Number(it.quantity || 0) * Number(it.price || 0),
    })),
    subtotal: Number(order.subtotal || 0),
    gst: Number(order.gst || 0),
    deliveryCharges: Number(order.delivery_charges || 0),
    discount: Number(order.discount || 0),
    total: Number(order.total || 0),
    paymentMethod: order.payment_method || "",
    status: order.status || "",
  };

  const html = buildInvoiceHTML({
    invoice,
    company,
    qrDataUri,
    trackingUrl,
  });

  // ─── Retry up to 3 times ───
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let page;
    try {
      const browser = await getBrowser();
      page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
      });

      await page.close();
      return pdfBuffer;
    } catch (err) {
      lastErr = err;
      console.error(
        `[invoice] PDF attempt ${attempt}/3 failed:`,
        err.message,
      );

      // If the browser died, force a relaunch next time
      browserPromise = null;

      if (page) {
        try {
          await page.close();
        } catch {}
      }

      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }

  throw lastErr;
}

module.exports = { generateInvoicePDF };