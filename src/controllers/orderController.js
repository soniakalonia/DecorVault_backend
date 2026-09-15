const db = require("../config/db");
const {
  notifyNewOrder,
  createNotification,
} = require("../utils/notificationService");

exports.getAllOrders = async (req, res) => {
  try {
    const [orders] = await db.execute(
      `SELECT o.*, u.full_name, u.email, u.mobile, COUNT(oi.id) as item_count,
       GROUP_CONCAT(p.name SEPARATOR ', ') as product_names,
       GROUP_CONCAT(p.slug SEPARATOR ',') as product_slugs
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       GROUP BY o.id 
       ORDER BY o.created_at DESC`,
    );
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalyticsSummary = async (req, res) => {
  try {
    const [kpiRows] = await db.execute(
      `SELECT 
         COUNT(*) AS total_orders,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS total_revenue,
         COALESCE(AVG(CASE WHEN status != 'cancelled' THEN total ELSE NULL END), 0) AS avg_order_value,
         COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_orders
       FROM orders`,
    );

    const [monthlyRows] = await db.execute(
      `SELECT
         DATE_FORMAT(created_at, '%Y-%m') AS month_key,
         DATE_FORMAT(created_at, '%b') AS month_label,
         COUNT(*) AS orders,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS refunds,
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS revenue
       FROM orders
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 11 MONTH)
       GROUP BY month_key, month_label
       ORDER BY month_key ASC`,
    );

    const [categoryRows] = await db.execute(
      `SELECT
          COALESCE(NULLIF(TRIM(p.category), ''), 'Uncategorized') AS name,
          COALESCE(SUM(oi.quantity * oi.price), 0) AS value
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.status != 'cancelled'
        GROUP BY p.category
        ORDER BY value DESC
        LIMIT 5`,
    );

    const [statusRows] = await db.execute(
      `SELECT
         COALESCE(NULLIF(TRIM(status), ''), 'unknown') AS source,
         COUNT(*) AS visitors
       FROM orders
       GROUP BY source
       ORDER BY visitors DESC`,
    );

    const monthMap = new Map(
      monthlyRows.map((row) => [
        row.month_key,
        {
          month: row.month_label,
          revenue: Number(row.revenue || 0),
          orders: Number(row.orders || 0),
          refunds: Number(row.refunds || 0),
        },
      ]),
    );

    const monthlySalesData = [];
    const now = new Date();
    now.setDate(1);

    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleString("en-US", { month: "short" });

      monthlySalesData.push(
        monthMap.get(monthKey) || {
          month: monthLabel,
          revenue: 0,
          orders: 0,
          refunds: 0,
        },
      );
    }

    const kpi = kpiRows[0] || {};
    const totalOrders = Number(kpi.total_orders || 0);
    const deliveredOrders = Number(kpi.delivered_orders || 0);
    const conversionRate =
      totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0;

    res.json({
      success: true,
      data: {
        kpis: {
          totalRevenue: Number(kpi.total_revenue || 0),
          totalOrders,
          conversionRate: Number(conversionRate.toFixed(1)),
          avgOrderValue: Number(kpi.avg_order_value || 0),
        },
        monthlySalesData,
        categoryData: categoryRows.map((row) => ({
          name: row.name,
          value: Number(row.value || 0),
        })),
        trafficSourceData: statusRows.map((row) => ({
          source: String(row.source || "unknown"),
          visitors: Number(row.visitors || 0),
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching analytics summary:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const [orders] = await db.execute(
      `SELECT o.*, u.full_name, u.email, u.mobile,
       DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i %p') as formatted_created_at,
       DATE_FORMAT(CONVERT_TZ(o.updated_at, '+00:00', '+05:30'), '%d/%m/%Y %h:%i %p') as formatted_updated_at
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ?`,
      [id],
    );

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const [items] = await db.execute(
      `SELECT oi.*, p.id as product_id, p.name, p.slug, p.product_images 
       FROM order_items oi 
       LEFT JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [id],
    );

    res.json({ success: true, order: { ...orders[0], items } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cancel_reason } = req.body;

    const timestampField = {
      confirmed: "confirmed_at",
      shipped: "shipped_at",
      delivered: "delivered_at",
      cancelled: "cancelled_at",
    }[status];

    let query = "UPDATE orders SET status = ?";
    const params = [status];

    if (timestampField) {
      query += `, ${timestampField} = NOW()`;
    }
    if (status === "cancelled" && cancel_reason) {
      query += ", cancel_reason = ?";
      params.push(cancel_reason);
    }
    query += " WHERE id = ?";
    params.push(id);

    const [result] = await db.execute(query, params);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const [order] = await db.execute(
      "SELECT user_id FROM orders WHERE id = ?",
      [id],
    );
    const { notifyOrderStatusChange } = require("../utils/notificationService");
    await notifyOrderStatusChange(id, status, order[0].user_id);

    res.json({ success: true, message: "Order status updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const {
      items,
      address,
      paymentMethod,
      subtotal,
      gst,
      deliveryCharges,
      discount,
      total,
    } = req.body;
    const userId = req.user.id;

    const [result] = await db.execute(
      `INSERT INTO orders (user_id, address, payment_method, subtotal, gst, delivery_charges, discount, total, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        JSON.stringify(address),
        paymentMethod,
        subtotal,
        gst,
        deliveryCharges,
        discount,
        total,
      ],
    );

    const orderId = result.insertId;
    const orderNumber = `ORD-${String(orderId).padStart(3, "0")}`;

    for (const item of items) {
      await db.execute(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_name, product_image, quantity, price, original_price, discount_price) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          item.id,
          item.variant_id || null,
          item.name,
          item.image || item.product_images,
          item.quantity,
          item.price,
          item.original_price || item.price,
          item.discount_price || item.price,
        ],
      );
    }

    const [user] = await db.execute(
      "SELECT full_name FROM users WHERE id = ?",
      [userId],
    );
    await notifyNewOrder(orderNumber, user[0].full_name, total);
    await createNotification({
      user_id: userId,
      type: "order",
      title: "Order Placed Successfully",
      message: `Your order ${orderNumber} has been placed. Total amount: Rs. ${total}.`,
      priority: "medium",
      link: "/user-dashboard/orders",
    });

    res.status(201).json({ success: true, orderId, orderNumber });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const [orders] = await db.execute(
      `SELECT o.id, o.total, o.status, o.created_at,
       COUNT(DISTINCT oi.id) as item_count,
       GROUP_CONCAT(DISTINCT p.name SEPARATOR ', ') as product_names,
       GROUP_CONCAT(DISTINCT p.slug SEPARATOR ',') as product_slugs,
       GROUP_CONCAT(DISTINCT p.product_images SEPARATOR '|||') as product_images
       FROM orders o 
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = ?
       GROUP BY o.id 
       ORDER BY o.created_at DESC`,
      [userId],
    );
    res.json({ success: true, orders });
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserActivity = async (req, res) => {
  try {
    const userId = req.user.id;
    const activities = [];

    const [orders] = await db.execute(
      `SELECT o.id, o.status, o.created_at, GROUP_CONCAT(p.name SEPARATOR ', ') as product_names
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC LIMIT 5`,
      [userId],
    );

    orders.forEach((order) => {
      const orderNum = `ORD-${String(order.id).padStart(3, "0")}`;
      if (order.status === "delivered") {
        activities.push({
          type: "order_delivered",
          icon: "CheckCircleIcon",
          iconColor: "bg-success",
          title: "Order Delivered",
          description: `Order #${orderNum} has been successfully delivered`,
          timestamp: order.created_at,
        });
      } else if (order.status === "shipped") {
        activities.push({
          type: "order_shipped",
          icon: "TruckIcon",
          iconColor: "bg-accent",
          title: "Order Shipped",
          description: `Your order #${orderNum} has been shipped and is on the way`,
          timestamp: order.created_at,
        });
      } else if (order.status === "pending") {
        activities.push({
          type: "order_placed",
          icon: "ShoppingBagIcon",
          iconColor: "bg-primary",
          title: "Order Placed",
          description: `Order #${orderNum} has been placed successfully`,
          timestamp: order.created_at,
        });
      }
    });

    const [wishlist] = await db.execute(
      `SELECT w.created_at, p.name FROM wishlist w
       LEFT JOIN products p ON w.product_id = p.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC LIMIT 3`,
      [userId],
    );

    wishlist.forEach((item) => {
      activities.push({
        type: "wishlist_added",
        icon: "HeartIcon",
        iconColor: "bg-error",
        title: "Added to Wishlist",
        description: `${item.name} added to your wishlist`,
        timestamp: item.created_at,
      });
    });

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, activities: activities.slice(0, 5) });
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getRecommendedProducts = async (req, res) => {
  try {
    const userId = req.user.id;

    const [products] = await db.execute(
      `SELECT DISTINCT p.id, p.name, p.price, p.product_images, p.slug
       FROM products p
       WHERE p.id NOT IN (
         SELECT DISTINCT oi.product_id FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.user_id = ?
       )
       AND p.stock > 0
       AND p.category IN (
         SELECT DISTINCT p2.category FROM products p2
         JOIN order_items oi2 ON p2.id = oi2.product_id
         JOIN orders o2 ON o2.id = oi2.order_id
         WHERE o2.user_id = ?
       )
       ORDER BY RAND()
       LIMIT 3`,
      [userId, userId],
    );

    if (products.length < 3) {
      const [fallbackProducts] = await db.execute(
        `SELECT p.id, p.name, p.price, p.product_images, p.slug
         FROM products p
         WHERE p.stock > 0
         ORDER BY RAND()
         LIMIT ?`,
        [3 - products.length],
      );
      products.push(...fallbackProducts);
    }

    res.json({ success: true, products });
  } catch (error) {
    console.error("Error fetching recommended products:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getOrderInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [orders] = await db.execute(
      `SELECT o.*, u.full_name, u.email, u.mobile,
       DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+05:30'), '%d/%m/%Y') as order_date
       FROM orders o 
       LEFT JOIN users u ON o.user_id = u.id 
       WHERE o.id = ? AND o.user_id = ?`,
      [id, userId],
    );

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const [items] = await db.execute(
      `SELECT oi.*, p.name, p.slug 
       FROM order_items oi 
       LEFT JOIN products p ON oi.product_id = p.id 
       WHERE oi.order_id = ?`,
      [id],
    );

    const order = orders[0];
    let address = {};
    try {
      address =
        typeof order.address === "string"
          ? JSON.parse(order.address)
          : order.address;
    } catch (e) {
      address = {};
    }

    res.json({
      success: true,
      invoice: {
        orderNumber: `ORD-${String(order.id).padStart(3, "0")}`,
        orderDate: order.order_date,
        customerName: order.full_name,
        customerEmail: order.email,
        customerPhone: order.mobile,
        address,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.quantity * item.price,
        })),
        subtotal: order.subtotal,
        gst: order.gst,
        deliveryCharges: order.delivery_charges,
        discount: order.discount,
        total: order.total,
        paymentMethod: order.payment_method,
        status: order.status,
      },
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUserAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const [addresses] = await db.execute(
      "SELECT * FROM addresses WHERE user_id = ?",
      [userId],
    );
    res.json({ success: true, addresses });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const {
      name,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      isDefault,
    } = req.body;
    const userId = req.user.id;

    if (isDefault) {
      await db.execute(
        "UPDATE addresses SET is_default = 0 WHERE user_id = ?",
        [userId],
      );
    }

    const [result] = await db.execute(
      `INSERT INTO addresses (user_id, name, phone, address_line1, address_line2, city, state, pincode, is_default) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        name,
        phone,
        addressLine1,
        addressLine2,
        city,
        state,
        pincode,
        isDefault ? 1 : 0,
      ],
    );

    res.status(201).json({ success: true, addressId: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const userId = req.user.id;

    await db.execute("UPDATE addresses SET is_default = 0 WHERE user_id = ?", [
      userId,
    ]);
    await db.execute(
      "UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?",
      [addressId, userId],
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateOrderPaymentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, payment_id, payment_method } = req.body;

    const [orders] = await db.execute("SELECT * FROM orders WHERE id = ?", [
      id,
    ]);
    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    await db.execute(
      `UPDATE orders SET 
        payment_status = ?, 
        payment_id = ?, 
        payment_method = ?,
        confirmed_at = IF(? = 'paid', NOW(), confirmed_at)
       WHERE id = ?`,
      [payment_status, payment_id, payment_method, payment_status, id],
    );

    if (payment_status === "paid") {
      await db.execute(
        `UPDATE orders SET status = 'confirmed' WHERE id = ? AND status = 'pending'`,
        [id],
      );
    }

    res.json({ success: true, message: "Order payment status updated" });
  } catch (error) {
    console.error("Error updating order payment status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===================== CANCEL ORDER =====================

exports.cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, note } = req.body;
    const userId = req.user.id;

    const [orders] = await db.execute(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [id, userId],
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission to cancel it",
      });
    }

    const order = orders[0];

    if (!["pending", "confirmed"].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled. Current status: ${order.status}`,
      });
    }

    const orderDate = new Date(order.created_at);
    const now = new Date();
    const hoursDiff = (now - orderDate) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return res.status(400).json({
        success: false,
        message:
          "Order can only be cancelled within 24 hours of placing the order",
      });
    }

    // ✅ FIXED: Removed cancel_note column (since it doesn't exist)
    await db.execute(
      `UPDATE orders SET 
        status = 'cancelled', 
        cancelled_at = NOW(),
        cancel_reason = ?
       WHERE id = ?`,
      [reason, id],
    );

    const isPrepaid = ["Prepaid", "prepaid", "online", "Online"].includes(
      order.payment_method,
    );
    let refundInitiated = false;

    if (isPrepaid) {
      try {
        await db.execute(
          `INSERT INTO refunds (order_id, amount, status, initiated_at) 
           VALUES (?, ?, 'pending', NOW())`,
          [id, order.total],
        );
        refundInitiated = true;
      } catch (e) {}
    }

    try {
      const { createNotification } = require("../utils/notificationService");
      await createNotification({
        user_id: userId,
        type: "order",
        title: "Order Cancelled",
        message: `Your order #ORD-${String(id).padStart(3, "0")} has been cancelled. ${isPrepaid ? "Refund will be processed within 3-5 business days." : ""}`,
        priority: "high",
        link: `/user-dashboard/orders`,
      });
    } catch (e) {}

    res.json({
      success: true,
      message: "Order cancelled successfully",
      refundInitiated: refundInitiated,
    });
  } catch (error) {
    console.error("Error cancelling order:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===================== REPORT ISSUE =====================

exports.reportIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.id;

    const [orders] = await db.execute(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?",
      [id, userId],
    );

    if (orders.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found or you do not have permission",
      });
    }

    let fileUrl = null;
    if (req.file) {
      fileUrl = `/uploads/reports/${req.file.filename}`;
    }

    await db.execute(
      `INSERT INTO order_reports (
        order_id, user_id, issue_type, description, file_url, status, created_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
      [id, userId, reason, description, fileUrl],
    );

    const { createNotification } = require("../utils/notificationService");

    await createNotification({
      user_id: userId,
      type: "support",
      title: "Issue Reported",
      message:
        "Your issue has been reported successfully. Our team will contact you within 24 hours.",
      priority: "high",
      link: `/user-dashboard/orders`,
    });

    const [admins] = await db.execute(
      'SELECT id FROM users WHERE role = "admin"',
    );

    for (const admin of admins) {
      await createNotification({
        user_id: admin.id,
        type: "support",
        title: "New Issue Reported",
        message: `User has reported an issue on order #ORD-${String(id).padStart(3, "0")}. Reason: ${reason}`,
        priority: "high",
        link: `/admin-dashboard/orders/${id}`,
      });
    }

    res.json({
      success: true,
      message:
        "Issue reported successfully. Our team will contact you within 24 hours.",
    });
  } catch (error) {
    console.error("Error reporting issue:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ===================== GET ORDER STATUS =====================

exports.getOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [orders] = await db.execute(
      `SELECT o.*, 
        CASE 
          WHEN o.payment_method IN ('Prepaid', 'prepaid', 'online', 'Online') AND o.status = 'cancelled' 
          THEN 'Refund Initiated' 
          ELSE NULL 
        END as refund_status,
        TIMESTAMPDIFF(HOUR, o.created_at, NOW()) as hours_since_order
       FROM orders o 
       WHERE o.id = ? AND o.user_id = ?`,
      [id, userId],
    );

    if (orders.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const [refunds] = await db.execute(
      "SELECT * FROM refunds WHERE order_id = ?",
      [id],
    );

    res.json({
      success: true,
      order: orders[0],
      refund: refunds.length > 0 ? refunds[0] : null,
      canCancel:
        ["pending", "confirmed"].includes(orders[0].status) &&
        orders[0].hours_since_order <= 24,
    });
  } catch (error) {
    console.error("Error getting order status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
// ===================== INVOICE PDF =====================

/**
 * Builds the invoice data for a given order id and returns:
 * { order, items, user, orderNumber }
 */
async function buildInvoiceData(orderId) {
  const [orders] = await db.execute(
    `SELECT o.*, u.full_name, u.email, u.mobile
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     WHERE o.id = ?`,
    [orderId],
  );

  if (orders.length === 0) return null;

  const order = orders[0];
  order.order_number = `ORD-${String(order.id).padStart(3, "0")}`;

  const [items] = await db.execute(
    `SELECT oi.*, p.name AS product_name, p.slug
     FROM order_items oi
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = ?`,
    [orderId],
  );

  const user = {
    full_name: order.full_name,
    email: order.email,
    mobile: order.mobile,
  };

  return { order, items, user, orderNumber: order.order_number };
}

/**
 * Streams the invoice PDF directly to the browser (for download button).
 */
exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Ownership check
    const [rows] = await db.execute(
      "SELECT user_id FROM orders WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    // Allow if owner OR admin
    if (rows[0].user_id !== userId && req.user.role !== "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const data = await buildInvoiceData(id);
    if (!data) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const { generateInvoicePDF } = require("../utils/invoiceGenerator");
    const pdfBuffer = await generateInvoicePDF(data);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Invoice-${data.orderNumber}.pdf"`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    return res.end(pdfBuffer);
  } catch (error) {
    console.error("Download invoice error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Generates PDF and emails it to the customer.
 * Called from payment success flows (Razorpay / PayU / Setu).
 * Safe to call multiple times — will only email if order not already emailed.
 * (If you want to force-email every call, remove the idempotency check.)
 */
exports.sendInvoiceAfterSuccess = async (orderId) => {
  try {
    if (!orderId) return;

    const data = await buildInvoiceData(orderId);
    if (!data) {
      console.warn(`[invoice] Order ${orderId} not found, skipping invoice`);
      return;
    }

    const { order, items, user, orderNumber } = data;

    if (!user?.email) {
      console.warn(`[invoice] No email for order ${orderId}, skipping`);
      return;
    }

    const { generateInvoicePDF } = require("../utils/invoiceGenerator");
    const { sendInvoiceEmail } = require("../utils/emailService");

    const pdfBuffer = await generateInvoicePDF({ order, items, user });

    await sendInvoiceEmail({
      to: user.email,
      customerName: user.full_name,
      orderNumber,
      orderId: order.id,
      pdfBuffer,
    });

    console.log(`✅ Invoice emailed for order ${orderNumber} → ${user.email}`);
  } catch (err) {
    // Never throw — this is a side-effect, not the main flow
    console.error("❌ sendInvoiceAfterSuccess failed:", err.message);
  }
};