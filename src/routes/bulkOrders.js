const express = require("express");
const router = express.Router();
const {
  getBulkOrders,
  createBulkOrder,
  updateBulkOrderStatus,
} = require("../controllers/bulkOrderController");

router.get("/", getBulkOrders);
router.post("/", createBulkOrder);
router.put("/:id/status", updateBulkOrderStatus);

module.exports = router;
