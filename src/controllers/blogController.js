const db = require("../config/db");

// Get all blogs
exports.getAllBlogs = async (req, res) => {
  try {
    const { status } = req.query;
    let query =
      "SELECT b.*, u.full_name as author FROM blogs b LEFT JOIN users u ON b.author_id = u.id";
    const params = [];

    if (status) {
      query += " WHERE b.status = ?";
      params.push(status);
    }

    query += " ORDER BY b.created_at DESC";
    const [blogs] = await db.query(query, params);
    res.json({ blogs });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single blog by slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const [blogs] = await db.query(
      "SELECT b.*, u.full_name as author FROM blogs b LEFT JOIN users u ON b.author_id = u.id WHERE b.slug = ?",
      [slug],
    );

    if (blogs.length === 0) {
      return res.status(404).json({ message: "Blog not found" });
    }

    await db.query("UPDATE blogs SET views = views + 1 WHERE id = ?", [
      blogs[0].id,
    ]);
    res.json({ blog: blogs[0] });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get single blog by id
exports.getBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const [blogs] = await db.query(
      "SELECT b.*, u.full_name as author FROM blogs b LEFT JOIN users u ON b.author_id = u.id WHERE b.id = ?",
      [id],
    );

    if (blogs.length === 0) {
      return res.status(404).json({ message: "Blog not found" });
    }

    await db.query("UPDATE blogs SET views = views + 1 WHERE id = ?", [id]);
    res.json({ blog: blogs[0] });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Create blog
exports.createBlog = async (req, res) => {
  try {
    const { title, excerpt, content, category, status, image } = req.body;
    const authorId = req.user.id;

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const [result] = await db.query(
      "INSERT INTO blogs (title, slug, excerpt, content, category, image, author_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        title,
        slug,
        excerpt,
        content,
        category,
        image,
        authorId,
        status || "draft",
      ],
    );

    res
      .status(201)
      .json({ message: "Blog created successfully", blogId: result.insertId });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, excerpt, content, category, status, image } = req.body;

    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push("title = ?", "slug = ?");
      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      params.push(title, slug);
    }
    if (excerpt !== undefined) {
      updates.push("excerpt = ?");
      params.push(excerpt);
    }
    if (content !== undefined) {
      updates.push("content = ?");
      params.push(content);
    }
    if (category !== undefined) {
      updates.push("category = ?");
      params.push(category);
    }
    if (status !== undefined) {
      updates.push("status = ?");
      params.push(status);
    }
    if (image !== undefined) {
      updates.push("image = ?");
      params.push(image);
    }

    params.push(id);
    await db.query(
      `UPDATE blogs SET ${updates.join(", ")} WHERE id = ?`,
      params,
    );

    res.json({ message: "Blog updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete blog
exports.deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM blogs WHERE id = ?", [id]);
    res.json({ message: "Blog deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
