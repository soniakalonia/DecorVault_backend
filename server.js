const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const db = require('./src/config/db');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Basic Route
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to Decor Vault Backend API' });
});

// Unauthorized endpoint
app.get('/unauthorized', (req, res) => {
    res.status(401).json({ message: 'Unauthorized access' });
});

// Routes
const authRoutes = require('./src/routes/authRoutes');
const protectedRoutes = require('./src/routes/protectedRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const bulkOrderRoutes = require('./src/routes/bulkOrders');
const contactRoutes = require('./src/routes/contact');
const publicRoutes = require('./src/routes/publicRoutes');
const blogRoutes = require('./src/routes/blogRoutes');
const orderRoutes = require('./src/routes/orderRoutes');
const bulkProductRoutes = require('./src/routes/bulkProductRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const webhookRoutes = require('./src/routes/webhookRoutes');
const setuRoutes = require('./src/routes/setuRoutes');
const payuRoutes = require('./src/routes/payuRoutes');   // ✅ ADD

app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bulk-orders', bulkOrderRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api', publicRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bulk-products', bulkProductRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/payment/setu', setuRoutes);

// ─── PayU routes ─────────────────────────────────────
// Frontend-facing endpoints (initiate/verify/status)
app.use('/api/payment/payu', payuRoutes);
// PayU server redirect endpoints (surl/furl) — PayU POSTs to these
app.use('/api/payu', payuRoutes);

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});