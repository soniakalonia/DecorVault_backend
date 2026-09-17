const puppeteer = require("puppeteer");
const QRCode = require("qrcode");
const { buildInvoiceHTML } = require("./invoiceTemplate");

/**
 * Generate invoice PDF buffer using Puppeteer + shared HTML template.
 *
 * @param {Object} params
 * @param {Object} params.order   - order row
 * @param {Array}  params.items   - order items
 * @param {Object} params.user    - { full_name, email, mobile }
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generateInvoicePDF({ order, items, user }) {
  // ─── Company details from ENV ───
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

  // ─── Parsed address ───
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

  // ─── QR code as data URI ───
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

  // ─── Build invoice object for template ───
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

  // ─── Render HTML ───
  const html = buildInvoiceHTML({
    invoice,
    company,
    qrDataUri,
    trackingUrl,
  });

  // ─── Puppeteer → PDF ───
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { generateInvoicePDF };