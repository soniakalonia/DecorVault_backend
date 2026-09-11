const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  try {
    let token = req.header("Authorization") || req.header("authorization");
    if (token) token = token.replace("Bearer ", "");

    if (!token && req.cookies) token = req.cookies.auth_token;

    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    req.user = decoded.user;
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    res.status(401).json({ message: "Token is not valid" });
  }
};

// Middleware to check if user has required role
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
};

// Combined middleware for authentication and authorization
exports.requireRole = (role) => {
  return [exports.authenticate, exports.authorize(role)];
};

// Middleware to check if user is admin
exports.isAdmin = [exports.authenticate, exports.authorize("admin")];

// Middleware to check if user is authenticated (any role)
exports.isAuthenticated = exports.authenticate;
