const PDFDocument = require("pdfkit");

/**
 * Generate invoice PDF buffer for an order.
 * @param {Object} params
 * @param {Object} params.order - Order row (with formatted dates if any)
 * @param {Array}  params.items - Order items rows
 * @param {Object} params.user  - User row { full_name, email, mobile }
 * @returns {Promise<Buffer>}
 */
function generateInvoicePDF({ order, items, user }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks = [];

      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ─── ENV-BASED CONFIG (nothing hardcoded) ───
      const COMPANY = {
        name: process.env.COMPANY_NAME || "Company",
        address: process.env.COMPANY_ADDRESS || "",
        phone: process.env.COMPANY_PHONE || "",
        email: process.env.COMPANY_EMAIL || "",
        website: process.env.COMPANY_WEBSITE || "",
        gstin: process.env.COMPANY_GSTIN || "",
        state: process.env.COMPANY_STATE || "",
      };
      const INVOICE_PREFIX = process.env.INVOICE_PREFIX || "INV";
      const ACCENT = "#D4AF37";
      const DARK = "#1A1A2E";
      const MUTED = "#7A7A7A";

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;

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
      const invoiceNumber = `${INVOICE_PREFIX}-${String(order.id).padStart(6, "0")}`;

      const formatDate = (d) => {
        if (!d) return "-";
        const date = new Date(d);
        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      };

      const money = (n) =>
        `Rs. ${Number(n || 0).toLocaleString("en-IN", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

      // ─────────────────────────────
      // HEADER
      // ─────────────────────────────
      doc
        .fillColor(ACCENT)
        .fontSize(28)
        .font("Helvetica-Bold")
        .text(COMPANY.name.toUpperCase(), margin, margin);

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(COMPANY.address, margin, margin + 36, { width: 280 })
        .text(`Phone: ${COMPANY.phone}`, margin, doc.y + 2)
        .text(`Email: ${COMPANY.email}`, margin, doc.y + 2)
        .text(`Website: ${COMPANY.website}`, margin, doc.y + 2);

      if (COMPANY.gstin) {
        doc.text(`GSTIN: ${COMPANY.gstin}`, margin, doc.y + 2);
      }

      // Right side — INVOICE title block
      const rightX = pageWidth - margin - 200;
      doc
        .fillColor(DARK)
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("INVOICE", rightX, margin, { width: 200, align: "right" });

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(`Invoice #: ${invoiceNumber}`, rightX, margin + 32, {
          width: 200,
          align: "right",
        })
        .text(`Order #: ${orderNumber}`, rightX, doc.y + 2, {
          width: 200,
          align: "right",
        })
        .text(`Date: ${formatDate(order.created_at)}`, rightX, doc.y + 2, {
          width: 200,
          align: "right",
        });

      const statusText = (order.payment_status || order.status || "").toUpperCase();
      doc
        .fillColor(statusText === "PAID" ? "#0A7A3D" : DARK)
        .font("Helvetica-Bold")
        .text(`Status: ${statusText}`, rightX, doc.y + 2, {
          width: 200,
          align: "right",
        });

      // Divider
      const lineY = doc.y + 20;
      doc
        .strokeColor(ACCENT)
        .lineWidth(2)
        .moveTo(margin, lineY)
        .lineTo(pageWidth - margin, lineY)
        .stroke();

      doc.y = lineY + 16;

      // ─────────────────────────────
      // BILL TO / SHIP TO
      // ─────────────────────────────
      const boxTop = doc.y;
      const boxWidth = (contentWidth - 20) / 2;

      // Billed To
      doc
        .fillColor(DARK)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("BILLED TO", margin, boxTop);

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(user?.full_name || "Customer", margin, boxTop + 16)
        .text(user?.email || "-", margin, doc.y + 2)
        .text(user?.mobile || "-", margin, doc.y + 2);

      // Shipped To
      const shipX = margin + boxWidth + 20;
      doc
        .fillColor(DARK)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("SHIPPED TO", shipX, boxTop);

      const shipLines = [
        address.name || address.full_name || user?.full_name || "",
        address.addressLine1 || address.address_line1 || "",
        address.addressLine2 || address.address_line2 || "",
        [address.city, address.state, address.pincode]
          .filter(Boolean)
          .join(", "),
        address.phone || user?.mobile || "",
      ].filter(Boolean);

      doc
        .fillColor(MUTED)
        .fontSize(9)
        .font("Helvetica")
        .text(shipLines.join("\n"), shipX, boxTop + 16, { width: boxWidth });

      doc.y = Math.max(doc.y, boxTop + 90) + 16;

      // ─────────────────────────────
      // ITEMS TABLE
      // ─────────────────────────────
      const tableTop = doc.y;
      const colX = {
        sn: margin,
        item: margin + 30,
        qty: margin + contentWidth - 220,
        price: margin + contentWidth - 160,
        total: margin + contentWidth - 80,
      };
      const rowHeight = 22;

      // Header row
      doc
        .rect(margin, tableTop, contentWidth, rowHeight)
        .fill(DARK);

      doc
        .fillColor("#FFFFFF")
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("#", colX.sn + 6, tableTop + 7)
        .text("ITEM", colX.item, tableTop + 7)
        .text("QTY", colX.qty, tableTop + 7, { width: 40, align: "center" })
        .text("PRICE", colX.price, tableTop + 7, { width: 70, align: "right" })
        .text("TOTAL", colX.total, tableTop + 7, { width: 80, align: "right" });

      doc.y = tableTop + rowHeight;

      // Rows
      doc.font("Helvetica").fontSize(9).fillColor(DARK);
      let y = doc.y;

      items.forEach((it, idx) => {
        const rowY = y + 6;
        const qty = Number(it.quantity || 0);
        const price = Number(it.price || 0);
        const lineTotal = qty * price;

        // Alternate row bg
        if (idx % 2 === 0) {
          doc.rect(margin, y, contentWidth, rowHeight).fill("#FAFAFA");
          doc.fillColor(DARK);
        }

        doc
          .text(String(idx + 1), colX.sn + 6, rowY, { width: 24 })
          .text(
            (it.product_name || it.name || "Item").substring(0, 60),
            colX.item,
            rowY,
            { width: contentWidth - 260 },
          )
          .text(String(qty), colX.qty, rowY, { width: 40, align: "center" })
          .text(money(price), colX.price, rowY, { width: 70, align: "right" })
          .text(money(lineTotal), colX.total, rowY, { width: 80, align: "right" });

        y += rowHeight;
      });

      doc.y = y + 6;

      // Bottom border of items table
      doc
        .strokeColor("#E8E4E0")
        .lineWidth(1)
        .moveTo(margin, doc.y)
        .lineTo(pageWidth - margin, doc.y)
        .stroke();

      doc.y += 12;

      // ─────────────────────────────
      // TOTALS
      // ─────────────────────────────
      const totalsX = pageWidth - margin - 220;
      const totalsWidth = 220;

      const addTotalRow = (label, value, bold = false, color = DARK) => {
        const rowY = doc.y;
        doc
          .fillColor(MUTED)
          .fontSize(10)
          .font("Helvetica")
          .text(label, totalsX, rowY, { width: 120 });
        doc
          .fillColor(color)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fontSize(bold ? 11 : 10)
          .text(value, totalsX + 120, rowY, {
            width: 100,
            align: "right",
          });
        doc.y = rowY + 16;
      };

      addTotalRow("Subtotal", money(order.subtotal));
      if (Number(order.delivery_charges) > 0)
        addTotalRow("Delivery Charges", money(order.delivery_charges));
      if (Number(order.discount) > 0)
        addTotalRow("Discount", `- ${money(order.discount)}`, false, "#0A7A3D");
      if (Number(order.gst) > 0)
        addTotalRow("GST", money(order.gst));

      // Grand total bar
      doc.y += 4;
      const gtY = doc.y;
      doc.rect(totalsX, gtY, totalsWidth, 26).fill(DARK);
      doc
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("GRAND TOTAL", totalsX + 10, gtY + 8, { width: 130 })
        .text(money(order.total), totalsX + 120, gtY + 8, {
          width: 90,
          align: "right",
        });

      doc.y = gtY + 40;

      // ─────────────────────────────
      // PAYMENT INFO
      // ─────────────────────────────
      doc
        .fillColor(DARK)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("PAYMENT DETAILS", margin, doc.y);

      doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(9)
        .text(`Method: ${order.payment_method || "-"}`, margin, doc.y + 14)
        .text(
          `Payment ID: ${order.payment_id || "-"}`,
          margin,
          doc.y + 2,
        )
        .text(
          `Payment Status: ${(order.payment_status || "-").toUpperCase()}`,
          margin,
          doc.y + 2,
        )
        .text(
          `Order Status: ${(order.status || "-").toUpperCase()}`,
          margin,
          doc.y + 2,
        );

      // ─────────────────────────────
      // FOOTER
      // ─────────────────────────────
      const footerY = pageHeight - 70;
      doc
        .strokeColor("#E8E4E0")
        .lineWidth(1)
        .moveTo(margin, footerY)
        .lineTo(pageWidth - margin, footerY)
        .stroke();

      doc
        .fillColor(MUTED)
        .fontSize(8)
        .font("Helvetica")
        .text(
          "This is a computer-generated invoice. No signature required.",
          margin,
          footerY + 8,
          { width: contentWidth, align: "center" },
        )
        .text(
          `© ${new Date().getFullYear()} ${COMPANY.name}. All rights reserved.`,
          margin,
          footerY + 22,
          { width: contentWidth, align: "center" },
        )
        .text(
          `Support: ${COMPANY.email} | ${COMPANY.phone}`,
          margin,
          footerY + 36,
          { width: contentWidth, align: "center" },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoicePDF };