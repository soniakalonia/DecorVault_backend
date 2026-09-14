// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${timestamp}-${random}`;
};

// Format amount to paise
const toPaise = (amount) => {
  return Math.round(amount * 100);
};

// Format amount from paise
const fromPaise = (amount) => {
  return Number((amount / 100).toFixed(2));
};

// Validate currency
const isValidCurrency = (currency) => {
  const validCurrencies = ["INR", "USD", "EUR", "GBP"];
  return validCurrencies.includes(currency.toUpperCase());
};

// Mask sensitive data
const maskSensitiveData = (data) => {
  if (!data) return data;

  const masked = { ...data };
  if (masked.card) {
    masked.card = "****" + masked.card.slice(-4);
  }
  if (masked.upi_id) {
    const parts = masked.upi_id.split("@");
    if (parts.length === 2) {
      masked.upi_id = parts[0].slice(0, 3) + "***@" + parts[1];
    }
  }
  return masked;
};

// Get payment status label
const getPaymentStatusLabel = (status) => {
  const labels = {
    pending: "Pending",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
    cancelled: "Cancelled",
    expired: "Expired",
  };
  return labels[status] || status;
};

// Get payment status color
const getPaymentStatusColor = (status) => {
  const colors = {
    pending: "#FFA500",
    paid: "#4CAF50",
    failed: "#FF4444",
    refunded: "#FF9800",
    cancelled: "#9E9E9E",
    expired: "#607D8B",
  };
  return colors[status] || "#000000";
};

// Validate payment amount
const validateAmount = (amount) => {
  if (!amount || amount <= 0) {
    return { valid: false, message: "Amount must be greater than 0" };
  }
  if (amount > 1000000) {
    return { valid: false, message: "Amount cannot exceed 10,00,000" };
  }
  return { valid: true };
};

// Generate transaction ID
const generateTransactionId = () => {
  return `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
};

// Get payment method display name
const getPaymentMethodDisplayName = (method) => {
  const methods = {
    card: "Credit/Debit Card",
    upi: "UPI",
    netbanking: "Net Banking",
    wallet: "Wallet",
    emi: "EMI",
    bank_transfer: "Bank Transfer",
  };
  return methods[method] || method;
};

const formatPayUAmount = (amount) => Number(amount).toFixed(2);

const mapPayUStatus = (status) => {
  const s = String(status).toLowerCase();
  if (s === "success") return "paid";
  if (s === "failure" || s === "failed") return "failed";
  if (s === "pending" || s === "in progress") return "pending";
  if (s === "refunded") return "refunded";
  return "pending";
};

module.exports = {
  generateOrderNumber,
  toPaise,
  fromPaise,
  isValidCurrency,
  maskSensitiveData,
  getPaymentStatusLabel,
  getPaymentStatusColor,
  validateAmount,
  generateTransactionId,
  getPaymentMethodDisplayName,
  formatPayUAmount,
  mapPayUStatus,
};
