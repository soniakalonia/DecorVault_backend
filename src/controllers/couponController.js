const db = require("../config/db");

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
        maximum_discount || null,
        usage_limit || null,
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
      data: newCoupon[0],
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

const getAllCoupons = async (req, res) => {
  try {
    // Check if table exists
    try {
      const [tableCheck] = await db.execute('SHOW TABLES LIKE "coupons"');
      if (tableCheck.length === 0) {
        // Return empty data if table doesn't exist
        return res.status(200).json({
          success: true,
          message: "No coupons found",
          data: [],
          pagination: {
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
          },
        });
      }
    } catch (tableError) {
      console.error("Table check failed:", tableError);
      // Return empty data
      return res.status(200).json({
        success: true,
        message: "No coupons found",
        data: [],
        pagination: {
          total: 0,
          page: 1,
          limit: 10,
          totalPages: 0,
        },
      });
    }

    const { status, type, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

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

    const query = `
      SELECT *, 
        CASE 
          WHEN end_date < NOW() THEN 'expired'
          ELSE status 
        END as current_status
      FROM coupons${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const countQuery = `SELECT COUNT(*) as total FROM coupons${whereClause}`;

    const [rows] = await db.execute(query, [
      ...params,
      parseInt(limit),
      offset,
    ]);
    const [countResult] = await db.execute(countQuery, params);

    res.status(200).json({
      success: true,
      message: "Coupons retrieved successfully",
      data: rows || [],
      pagination: {
        total: countResult[0]?.total || 0,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil((countResult[0]?.total || 0) / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    // Return empty data instead of error
    res.status(200).json({
      success: true,
      message: "No coupons found",
      data: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      },
    });
  }
};

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
      data: rows[0],
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

    const [result] = await db.execute(
      `
      UPDATE coupons SET 
        code = ?, name = ?, description = ?, type = ?, value = ?, 
        minimum_amount = ?, maximum_discount = ?, usage_limit = ?, 
        user_limit = ?, applicable_to = ?, applicable_ids = ?, 
        start_date = ?, end_date = ?, status = ?
      WHERE id = ?
    `,
      [
        code?.toUpperCase() || existing[0].code,
        name || existing[0].name,
        description || existing[0].description,
        type || existing[0].type,
        value || existing[0].value,
        minimum_amount !== undefined
          ? minimum_amount
          : existing[0].minimum_amount,
        maximum_discount !== undefined
          ? maximum_discount
          : existing[0].maximum_discount,
        usage_limit !== undefined ? usage_limit : existing[0].usage_limit,
        user_limit || existing[0].user_limit,
        applicable_to || existing[0].applicable_to,
        applicable_ids
          ? JSON.stringify(applicable_ids)
          : existing[0].applicable_ids,
        start_date || existing[0].start_date,
        end_date || existing[0].end_date,
        status || existing[0].status,
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
      data: updatedCoupon[0],
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

    // Try to delete usage records if table exists
    try {
      await db.execute("DELETE FROM coupon_usage WHERE coupon_id = ?", [id]);
    } catch (usageError) {}

    const [result] = await db.execute("DELETE FROM coupons WHERE id = ?", [id]);

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

const validateCoupon = async (req, res) => {
  try {
    const { code, cart_total, user_id } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Coupon code is required",
      });
    }

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
      } catch (usageError) {}
    }

    if (cart_total < coupon.minimum_amount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount of ₹${coupon.minimum_amount} required`,
      });
    }

    let discount = 0;
    if (coupon.type === "percentage") {
      discount = (cart_total * coupon.value) / 100;
      if (coupon.maximum_discount && discount > coupon.maximum_discount) {
        discount = coupon.maximum_discount;
      }
    } else if (coupon.type === "fixed") {
      discount = coupon.value;
    } else if (coupon.type === "free_shipping") {
      discount = coupon.value || 0;
    }

    res.status(200).json({
      success: true,
      message: "Coupon is valid",
      data: {
        coupon_id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        discount_amount: discount,
        coupon_details: coupon,
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
    } catch (usageError) {}

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

const getCouponStats = async (req, res) => {
  try {
    // Check if table exists
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
    } catch (tableError) {}

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
        totalDiscountGiven = discountResult[0]?.total || 0;
      }
    } catch (usageError) {}

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
