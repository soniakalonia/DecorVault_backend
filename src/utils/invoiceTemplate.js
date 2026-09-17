function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberToWords(amount) {
  const n = Number(amount) || 0;
  if (n === 0) return "Zero";

  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
    "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
    "Sixteen", "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy",
    "Eighty", "Ninety",
  ];

  const numToWords = (num) => {
    if (num < 20) return ones[num];
    if (num < 100)
      return (
        tens[Math.floor(num / 10)] + (num % 10 ? " " + ones[num % 10] : "")
      );
    if (num < 1000)
      return (
        ones[Math.floor(num / 100)] +
        " Hundred" +
        (num % 100 ? " " + numToWords(num % 100) : "")
      );
    if (num < 100000)
      return (
        numToWords(Math.floor(num / 1000)) +
        " Thousand" +
        (num % 1000 ? " " + numToWords(num % 1000) : "")
      );
    if (num < 10000000)
      return (
        numToWords(Math.floor(num / 100000)) +
        " Lakh" +
        (num % 100000 ? " " + numToWords(num % 100000) : "")
      );
    return (
      numToWords(Math.floor(num / 10000000)) +
      " Crore" +
      (num % 10000000 ? " " + numToWords(num % 10000000) : "")
    );
  };

  const rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);

  let words = numToWords(rupees) + " Rupees";
  if (paise > 0) words += " and " + numToWords(paise) + " Paise";
  return words + " Only";
}

function buildInvoiceHTML({ invoice, company, qrDataUri, trackingUrl }) {
  const rupee = "&#8377;";
  const fmt = (v) =>
    Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "0.00";
  const safe = escapeHtml;

  const address = invoice.address || {};
  const addressLine1 = address.addressLine1 || address.address_line1 || "";
  const addressLine2 = address.addressLine2 || address.address_line2 || "";
  const city = address.city || "";
  const state = address.state || "";
  const pincode = address.pincode || "";

  const addressPrimary = [addressLine1, addressLine2]
    .filter(Boolean)
    .join(", ");
  const addressSecondary = [city, state].filter(Boolean).join(", ");
  const addressFull = [addressPrimary, addressSecondary]
    .filter(Boolean)
    .join(", ");
  const addressWithPin = addressFull
    ? `${addressFull}${pincode ? ` - ${pincode}` : ""}`
    : pincode || "N/A";

  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const subtotal = Number(invoice.subtotal || 0);
  const gst = Number(invoice.gst || 0);
  const deliveryCharges = Number(invoice.deliveryCharges || 0);
  const discount = Number(invoice.discount || 0);
  const total = Number(invoice.total || 0);
  const orderDate =
    invoice.orderDate || new Date().toLocaleDateString("en-GB");

  const fallbackRow =
    '<tr><td class="table-cell" colspan="4" style="text-align:center;">No items found</td></tr>';

  const itemRows =
    items.length > 0
      ? items
          .map((item) => {
            const qty = Number(item.quantity || 0);
            const price = Number(item.price || 0);
            const lineTotal = Number(item.total || qty * price || 0);
            return `
        <tr>
          <td class="table-cell">
            <div class="item-name">${safe(item.name) || "Product"}</div>
          </td>
          <td class="table-cell" style="text-align:center;">${qty}</td>
          <td class="table-cell" style="text-align:right;">${rupee}${fmt(price)}</td>
          <td class="table-cell" style="text-align:right;">${rupee}${fmt(lineTotal)}</td>
        </tr>
      `;
          })
          .join("")
      : fallbackRow;

  const logoBlock = company.logoUrl
    ? `<img class="company-logo" src="${safe(company.logoUrl)}" alt="${safe(company.name)}" />`
    : "";

  const gstLine = company.gstin
    ? `<div class="company-details-item"><strong>GSTIN:</strong><span>${safe(company.gstin)}</span></div>`
    : "";

  const cinLine = company.cin
    ? `<div class="company-details-item"><strong>CIN:</strong><span>${safe(company.cin)}</span></div>`
    : "";

  const discountRow =
    discount > 0
      ? `<div class="summary-row"><span>Discount</span><span>-${rupee}${fmt(discount)}</span></div>`
      : "";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Invoice - ${safe(invoice.orderNumber)}</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: Arial, Helvetica, sans-serif;
        font-size: 12px; line-height: 1.4;
        background: #fff; color: #1a1a1a;
      }
      .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; }
      .section { border-bottom: 1px solid #e8e4e0; padding: 12px 24px; }
      .section:last-child { border-bottom: none; }
      .invoice-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 16px 24px; border-bottom: 3px solid #1a1a2e; background: #fafafa;
      }
      .header-left { display: flex; align-items: center; gap: 16px; }
      .company-logo {
        width: 70px; height: 70px; object-fit: contain;
        border: 1px solid #e8e4e0; padding: 4px; border-radius: 4px;
      }
      .company-name {
        font-size: 24px; font-weight: 700; color: #1a1a2e; letter-spacing: 1px;
      }
      .company-tagline { font-size: 11px; color: #666; margin-top: 2px; }
      .header-right { text-align: right; }
      .invoice-title {
        font-size: 20px; font-weight: 700; color: #1a1a2e; letter-spacing: 2px;
      }
      .flex {
        display: flex; justify-content: space-between;
        align-items: flex-start; gap: 20px;
      }
      .muted { color: #666; font-size: 11px; }
      .right { text-align: right; }
      .qr-container {
        display: flex; flex-direction: column; align-items: center; gap: 4px;
      }
      .qr {
        border: 1px solid #ddd; padding: 4px;
        width: 72px; height: 72px; background: #fff;
      }
      .qr-label { font-size: 9px; color: #666; text-align: center; }
      .company-details {
        display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
        font-size: 11px; color: #444; padding: 8px 0;
      }
      .company-details-item { display: flex; gap: 4px; }
      .company-details-item strong {
        font-weight: 600; color: #1a1a2e; min-width: 60px;
      }
      .address-grid {
        display: grid; grid-template-columns: 1fr 1fr;
        border-top: 1px solid #e8e4e0;
      }
      .address-block {
        padding: 12px 24px; border-right: 1px solid #e8e4e0;
      }
      .address-block:last-child { border-right: none; }
      .address-title {
        font-weight: 700; margin-bottom: 6px; font-size: 13px; color: #1a1a2e;
      }
      table { width: 100%; border-collapse: collapse; }
      th, td {
        border: 1px solid #ddd; padding: 8px 10px; vertical-align: middle;
      }
      th {
        background: #f5f5f5; text-align: left;
        font-weight: 600; font-size: 11px; color: #1a1a2e;
      }
      .table-cell { font-size: 11px; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .item-name { font-weight: 600; color: #1a1a2e; }
      .summary { max-width: 320px; margin-left: auto; padding: 4px 0; }
      .summary-row {
        display: flex; justify-content: space-between;
        padding: 5px 0; font-size: 12px;
      }
      .summary-row.total {
        font-weight: 700; border-top: 2px solid #1a1a2e;
        padding-top: 8px; margin-top: 5px;
        font-size: 14px; color: #1a1a2e;
      }
      .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; font-size: 11px; }
      .signature { text-align: right; }
      .signature-line {
        border-top: 1px solid #1a1a2e; margin-top: 30px;
        padding-top: 4px; font-weight: 600;
      }
      .thank-you {
        text-align: center; font-size: 14px; font-weight: 600;
        color: #1a1a2e; padding: 12px 0 4px 0; letter-spacing: 1px;
      }
      .bill-header {
        text-align: center; font-size: 16px; font-weight: 700;
        color: #1a1a2e; padding: 8px 0;
        border-bottom: 2px dashed #1a1a2e; margin-bottom: 12px;
      }
      .bill-footer {
        text-align: center; font-size: 10px; color: #666;
        padding-top: 8px; border-top: 2px dashed #1a1a2e; margin-top: 12px;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="invoice-header">
        <div class="header-left">
          ${logoBlock}
          <div>
            <div class="company-name">${safe(company.name)}</div>
            <div class="company-tagline">${safe(company.tagline)}</div>
          </div>
        </div>
        <div class="header-right">
          <div class="invoice-title">TAX INVOICE</div>
          <div style="font-size:10px;color:#666;margin-top:4px;">GST Invoice</div>
        </div>
      </div>

      <div class="section" style="background:#fafafa;border-bottom:2px solid #e8e4e0;">
        <div class="company-details">
          <div class="company-details-item"><strong>Address:</strong><span>${safe(company.address)}</span></div>
          <div class="company-details-item"><strong>Email:</strong><span>${safe(company.email)}</span></div>
          <div class="company-details-item"><strong>Phone:</strong><span>${safe(company.phone)}</span></div>
          ${gstLine}
          ${cinLine}
        </div>
      </div>

      <div class="section flex">
        <div>
          <div><strong>Order Number:</strong> ${safe(invoice.orderNumber)}</div>
          <div><strong>Order Date:</strong> ${safe(orderDate)}</div>
          <div><strong>Payment Method:</strong> ${safe(invoice.paymentMethod) || "N/A"}</div>
          <div><strong>Order Status:</strong> ${safe(invoice.status) || "N/A"}</div>
          <div style="margin-top:4px;font-size:10px;color:#666;">
            <strong>Invoice Date:</strong> ${safe(orderDate)}
          </div>
        </div>
        ${
          qrDataUri
            ? `<div class="right qr-container">
                 <img class="qr" src="${qrDataUri}" alt="Invoice QR" />
                 <div class="qr-label">Scan to view order</div>
               </div>`
            : ""
        }
      </div>

      <div class="address-grid">
        <div class="address-block">
          <div class="address-title">Billed To</div>
          <div>${safe(invoice.customerName) || "Customer"}</div>
          <div class="muted">${safe(addressWithPin)}</div>
          <div class="muted">Email: ${safe(invoice.customerEmail) || "N/A"}</div>
          <div class="muted">Phone: ${safe(invoice.customerPhone) || "N/A"}</div>
        </div>
        <div class="address-block">
          <div class="address-title">Shipped To</div>
          <div>${safe(invoice.customerName) || "Customer"}</div>
          <div class="muted">${safe(addressWithPin)}</div>
          <div class="muted">Phone: ${safe(invoice.customerPhone) || "N/A"}</div>
        </div>
      </div>

      <div class="section" style="padding: 0;">
        <div class="bill-header">ORDER ITEMS</div>
        <table>
          <thead>
            <tr>
              <th style="width:45%;">Item</th>
              <th style="width:15%;text-align:center;">Qty</th>
              <th style="width:20%;text-align:right;">Price</th>
              <th style="width:20%;text-align:right;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div class="bill-footer">Thank you for your purchase!</div>
      </div>

      <div class="section">
        <div class="summary">
          <div class="summary-row"><span>Subtotal</span><span>${rupee}${fmt(subtotal)}</span></div>
          <div class="summary-row"><span>GST (18%)</span><span>${rupee}${fmt(gst)}</span></div>
          <div class="summary-row"><span>Delivery Charges</span><span>${rupee}${fmt(deliveryCharges)}</span></div>
          ${discountRow}
          <div class="summary-row total"><span>Grand Total</span><span>${rupee}${fmt(total)}</span></div>
        </div>
        <div style="text-align:right;margin-top:8px;font-size:10px;color:#666;">
          Amount in Words: ${numberToWords(total)}
        </div>
      </div>

      <div class="section footer">
        <div>
          <div><strong>Returns Policy:</strong> Returns accepted within 7 days of delivery with original packaging and invoice.</div>
          <div class="muted" style="margin-top:4px;">For warranty and support, please retain this invoice.</div>
        </div>
        <div class="signature">
          <div><strong>FOR ${safe(company.name)}</strong></div>
          <div class="signature-line">Authorized Signatory</div>
        </div>
      </div>

      <div class="section" style="border-bottom: none;">
        <div class="thank-you">Thank you for shopping with ${safe(company.name)}!</div>
        <div style="text-align:center;font-size:10px;color:#999;margin-top:4px;">
          This is a system generated invoice and does not require a physical signature.
        </div>
      </div>
    </div>
  </body>
</html>`;
}

module.exports = { buildInvoiceHTML, numberToWords };