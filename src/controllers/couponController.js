const db = require("../config/db");

/* ============================== CREATE ============================== */

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      name,
      description,
      type,
      value,
      minimum_amount,
      maximum_discount,
      usage_limit,
      user_limit,
      applicable_to,
      applicable_ids,
      start_date,
      end_date,
    } = req.body;

    if (!code || !name || !type || !value || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        message:
          "Code, name, type, value, start_date, and end_date are required",
      });
    }

    // Check if table exists
    try {
      const [tableCheck] = await db.execute('SHOW TABLES LIKE "coupons"');
      if (tableCheck.length === 0) {
        return res.status(500).json({
          success: false,
          message:
            "Coupons table does not exist. Please run database migrations.",
        });
      }
    } catch (tableError) {
      console.error("Table check failed:", tableError);
      return res.status(500).json({
        success: false,
        message: "Database error. Please check if coupons table exists.",
      });
    }

    const [result] = await db.execute(
      `
      INSERT INTO coupons (
        code, name, description, type, value, minimum_amount, maximum_discount,
        usage_limit, user_limit, applicable_to, applicable_ids, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      [
        code.toUpperCase(),
        name,
        description || null,
        type,
        value,
        minimum_amount || 0,
        // 0 or null → NULL (means "no max discount")
        maximum_discount && maximum_discount > 0 ? maximum_discount : null,
        // 0 or null → NULL (means "unlimited usage")
        usage_limit && usage_limit > 0 ? usage_limit : null,
        user_limit || 1,
        applicable_to || "all",
        applicable_ids ? JSON.stringify(applicable_ids) : null,
        start_date,
        end_date,
      ],
    );

    const [newCoupon] = await db.execute("SELECT * FROM coupons WHERE id = ?", [
      result.insertId,
    ]);

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: normalizeCoupon(newCoupon[0]),
    });
  } catch (error) {
    console.error("Error creating coupon:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }
    if (error.code === "ER_NO_SUCH_TABLE") {
      return res.status(500).json({
        success: false,
        message:
          "Coupons table does not exist. Please run database migrations.",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to create coupon",
      error: error.message,
    });
  }
};

/* ============================ READ ALL ============================ */

const getAllCoupons = async (req, res) => {
  try {
    // Check if table exists
    try {
      const [tableCheck] = await db.execute('SHOW TABLES LIKE "coupons"');
      if (tableCheck.length === 0) {
        return res.status(200).json({
          success: true,
          message: "No coupons found",
          data: [],
          pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
        });
      }
    } catch (tableError) {
      console.error("Table check failed:", tableError);
      return res.status(200).json({
        success: true,
        message: "No coupons found",
        data: [],
        pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
      });
    }

    const { status, type } = req.query;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(req.query.limit) || 100));
    const offset = (page - 1) * limit;

    let whereClause = "";
    const params = [];

    if (status) {
      whereClause += " WHERE status = ?";
      params.push(status);
    }

    if (type) {
      whereClause += status ? " AND type = ?" : " WHERE type = ?";
      params.push(type);
    }

    // ✅ FIX: LIMIT/OFFSET must be interpolated, not parameterized.
    // MySQL2's prepared statements silently return 0 rows when ? is used
    // inside LIMIT / OFFSET on many MySQL server versions.
    const query = `
      SELECT *,
        CASE
          WHEN end_date < NOW() THEN 'expired'
          ELSE status
        END as current_status
      FROM coupons${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const countQuery = `SELECT COUNT(*) as total FROM coupons${whereClause}`;

    console.log("[getAllCoupons] SQL:", query.trim());
    console.log("[getAllCoupons] params:", params);

    const [rows] = await db.execute(query, params);
    const [countResult] = await db.execute(countQuery, params);

    console.log("[getAllCoupons] rows returned:", rows.length);

    res.status(200).json({
      success: true,
      message: "Coupons retrieved successfully",
      data: (rows || []).map(normalizeCoupon),
      pagination: {
        total: countResult[0]?.total || 0,
        page,
        limit,
        totalPages: Math.ceil((countResult[0]?.total || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(200).json({
      success: true,
      message: "No coupons found",
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
    });
  }
};

/* ============================ READ ONE ============================ */

const getCouponById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute("SELECT * FROM coupons WHERE id = ?", [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Coupon retrieved successfully",
      data: normalizeCoupon(rows[0]),
    });
  } catch (error) {
    console.error("Error fetching coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupon",
      error: error.message,
    });
  }
};

/* ============================== UPDATE ============================== */

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      name,
      description,
      type,
      value,
      minimum_amount,
      maximum_discount,
      usage_limit,
      user_limit,
      applicable_to,
      applicable_ids,
      start_date,
      end_date,
      status,
    } = req.body;

    const [existing] = await db.execute("SELECT * FROM coupons WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    const current = existing[0];

    await db.execute(
      `
      UPDATE coupons SET
        code = ?, name = ?, description = ?, type = ?, value = ?,
        minimum_amount = ?, maximum_discount = ?, usage_limit = ?,
        user_limit = ?, applicable_to = ?, applicable_ids = ?,
        start_date = ?, end_date = ?, status = ?
      WHERE id = ?
    `,
      [
        code?.toUpperCase() || current.code,
        name || current.name,
        description !== undefined ? description : current.description,
        type || current.type,
        value !== undefined ? value : current.value,
        minimum_amount !== undefined
          ? minimum_amount
          : current.minimum_amount,
        // 0 or null → NULL
        maximum_discount !== undefined && maximum_discount !== null
          ? maximum_discount > 0
            ? maximum_discount
            : null
          : current.maximum_discount,
        usage_limit !== undefined && usage_limit !== null
          ? usage_limit > 0
            ? usage_limit
            : null
          : current.usage_limit,
        user_limit || current.user_limit,
        applicable_to || current.applicable_to,
        applicable_ids
          ? JSON.stringify(applicable_ids)
          : current.applicable_ids,
        start_date || current.start_date,
        end_date || current.end_date,
        status || current.status,
        id,
      ],
    );

    const [updatedCoupon] = await db.execute(
      "SELECT * FROM coupons WHERE id = ?",
      [id],
    );

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
      data: normalizeCoupon(updatedCoupon[0]),
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(400).json({
        success: false,
        message: "Coupon code already exists",
      });
    }
    res.status(500).json({
      success: false,
      message: "Failed to update coupon",
      error: error.message,
    });
  }
};

/* ============================== DELETE ============================== */

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await db.execute("SELECT * FROM coupons WHERE id = ?", [
      id,
    ]);
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    // Cascade-delete usage rows first (if table exists)
    try {
      await db.execute("DELETE FROM coupon_usage WHERE coupon_id = ?", [id]);
    } catch (usageError) {
      console.warn("coupon_usage cleanup skipped:", usageError.message);
    }

    await db.execute("DELETE FROM coupons WHERE id = ?", [id]);

    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete coupon",
      error: error.message,
    });
  }
};

/* ============================= VALIDATE ============================= */

const validateCoupon = async (req, res) => {
  try {
    const { code, cart_total, user_id } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

    const cartTotal = Number(cart_total) || 0;

    const [couponRows] = await db.execute(
      `
      SELECT * FROM coupons
      WHERE code = ? AND status = 'active' AND start_date <= NOW() AND end_date >= NOW()
    `,
      [code.toUpperCase()],
    );

    if (couponRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired coupon code",
      });
    }

    const coupon = couponRows[0];

    // usage_limit stored as NULL = unlimited
    if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit exceeded",
      });
    }

    if (user_id && coupon.user_limit) {
      try {
        const [userUsage] = await db.execute(
          "SELECT COUNT(*) as count FROM coupon_usage WHERE coupon_id = ? AND user_id = ?",
          [coupon.id, user_id],
        );

        if (userUsage[0].count >= coupon.user_limit) {
          return res.status(400).json({
            success: false,
            message: "You have already used this coupon",
          });
        }
      } catch (usageError) {
        console.warn("user-limit check skipped:", usageError.message);
      }
    }

    if (cartTotal < coupon.minimum_amount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimum_amount} required`,
      });
    }

    let discount = 0;
    if (coupon.type === "percentage") {
      discount = (cartTotal * coupon.value) / 100;
      if (coupon.maximum_discount && discount > coupon.maximum_discount) {
        discount = coupon.maximum_discount;
      }
    } else if (coupon.type === "fixed") {
      discount = coupon.value;
    } else if (coupon.type === "free_shipping") {
      discount = coupon.value || 0;
    }

    // Never discount more than the cart total
    if (discount > cartTotal) discount = cartTotal;

    // Round to 2 decimals
    discount = Math.round(discount * 100) / 100;

    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        discount_amount: discount,
        coupon_details: normalizeCoupon(coupon),
      },
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
      error: error.message,
    });
  }
};

/* ============================== APPLY ============================== */

const applyCoupon = async (req, res) => {
  try {
    const { coupon_id, user_id, order_id, discount_amount } = req.body;

    if (!coupon_id || !user_id || !order_id) {
      return res.status(400).json({
        success: false,
        message: "coupon_id, user_id, and order_id are required",
      });
    }

    try {
      await db.execute(
        `
        INSERT INTO coupon_usage (coupon_id, user_id, order_id, discount_amount)
        VALUES (?, ?, ?, ?)
      `,
        [coupon_id, user_id, order_id, discount_amount || 0],
      );
    } catch (usageError) {
      // Only swallow missing-table; anything else is a real failure
      if (usageError.code === "ER_NO_SUCH_TABLE") {
        console.warn(
          "coupon_usage table missing — usage row not recorded, only counter incremented",
        );
      } else {
        throw usageError;
      }
    }

    await db.execute(
      "UPDATE coupons SET used_count = used_count + 1 WHERE id = ?",
      [coupon_id],
    );

    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
    });
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({
      success: false,
      message: "Failed to apply coupon",
      error: error.message,
    });
  }
};

/* ============================== STATS ============================== */

const getCouponStats = async (req, res) => {
  try {
    let totalCoupons = 0,
      activeCoupons = 0,
      expiredCoupons = 0;
    let totalUsage = 0,
      totalDiscountGiven = 0;

    try {
      const [tableCheck] = await db.execute('SHOW TABLES LIKE "coupons"');
      if (tableCheck.length > 0) {
        const [totalResult] = await db.execute(
          "SELECT COUNT(*) as total FROM coupons",
        );
        const [activeResult] = await db.execute(
          'SELECT COUNT(*) as count FROM coupons WHERE status = "active" AND end_date >= NOW()',
        );
        const [expiredResult] = await db.execute(
          "SELECT COUNT(*) as count FROM coupons WHERE end_date < NOW()",
        );

        totalCoupons = totalResult[0]?.total || 0;
        activeCoupons = activeResult[0]?.count || 0;
        expiredCoupons = expiredResult[0]?.count || 0;
      }
    } catch (tableError) {
      console.warn("coupons table check failed:", tableError.message);
    }

    try {
      const [tableCheck] = await db.execute('SHOW TABLES LIKE "coupon_usage"');
      if (tableCheck.length > 0) {
        const [usageResult] = await db.execute(
          "SELECT COUNT(*) as count FROM coupon_usage",
        );
        const [discountResult] = await db.execute(
          "SELECT SUM(discount_amount) as total FROM coupon_usage",
        );
        totalUsage = usageResult[0]?.count || 0;
        totalDiscountGiven = Number(discountResult[0]?.total) || 0;
      }
    } catch (usageError) {
      console.warn("coupon_usage table check failed:", usageError.message);
    }

    res.status(200).json({
      success: true,
      message: "Coupon stats retrieved successfully",
      data: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        totalUsage,
        totalDiscountGiven,
      },
    });
  } catch (error) {
    console.error("Error fetching coupon stats:", error);
    res.status(200).json({
      success: true,
      message: "Coupon stats retrieved successfully",
      data: {
        totalCoupons: 0,
        activeCoupons: 0,
        expiredCoupons: 0,
        totalUsage: 0,
        totalDiscountGiven: 0,
      },
    });
  }
};

/* ============================ HELPERS ============================ */

/**
 * Normalize a raw MySQL coupon row:
 *  - DECIMAL columns → Number
 *  - JSON columns → parsed array/object
 *  - Handles MySQL2 returning Buffer for JSON columns
 */
function normalizeCoupon(row) {
  if (!row) return row;

  let applicableIds = row.applicable_ids;
  if (applicableIds) {
    try {
      if (Buffer.isBuffer(applicableIds)) {
        applicableIds = JSON.parse(applicableIds.toString());
      } else if (typeof applicableIds === "string") {
        applicableIds = JSON.parse(applicableIds);
      }
    } catch (e) {
      applicableIds = [];
    }
  } else {
    applicableIds = [];
  }

  return {
    ...row,
    value: Number(row.value),
    minimum_amount: Number(row.minimum_amount),
    maximum_discount:
      row.maximum_discount !== null && row.maximum_discount !== undefined
        ? Number(row.maximum_discount)
        : null,
    usage_limit:
      row.usage_limit !== null && row.usage_limit !== undefined
        ? Number(row.usage_limit)
        : null,
    used_count: Number(row.used_count),
    user_limit: Number(row.user_limit),
    applicable_ids: applicableIds,
  };
}

/* ============================= EXPORTS ============================= */

module.exports = {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats,
};