const db = require("../config/db");

const createNotification = async ({
  user_id = null,
  type,
  title,
  message,
  link = null,
  priority = "medium",
}) => {
  try {
    await db.execute(
      "INSERT INTO notifications (user_id, type, title, message, link, priority) VALUES (?, ?, ?, ?, ?, ?)",
      [user_id, type, title, message, link, priority],
    );
  } catch (error) {
    console.error("Failed to create notification:", error);
  }
};

const notifyLowStock = async (productName, stockQuantity) => {
  await createNotification({
    type: "inventory",
    title: "Low Stock Alert",
    message: `${productName} is running low on stock. Current quantity: ${stockQuantity}`,
    priority: stockQuantity === 0 ? "critical" : "high",
    link: "/admin-dashboard/inventory",
  });
};

const notifyNewOrder = async (orderId, customerName, total) => {
  await createNotification({
    type: "order",
    title: "New Order Received",
    message: `New order #${orderId} from ${customerName}. Total: Rs. ${total}`,
    priority: "medium",
    link: `/admin-dashboard/orders`,
  });
};

const notifyOrderStatusChange = async (orderId, status, userId = null) => {
  const orderNum = orderId.toString().includes("VMR")
    ? orderId
    : `VMR-${String(orderId).padStart(3, "0")}`;
  await createNotification({
    user_id: userId,
    type: "order",
    title: "Order Status Updated",
    message: `Order ${orderNum} status changed to ${status}`,
    priority: "medium",
    link: `/user-dashboard/orders`,
  });
};

module.exports = {
  createNotification,
  notifyLowStock,
  notifyNewOrder,
  notifyOrderStatusChange,
};
