const db = require('../src/config/db');
const fs = require('fs');
const path = require('path');

async function updateSchema() {
  try {
    console.log('🔄 Starting database schema update...');

    // SQL queries to add payment tables
    const queries = [
      // Create payments table
      `CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        user_id INT,
        gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        payment_method VARCHAR(50),
        gateway_order_id VARCHAR(100),
        gateway_payment_id VARCHAR(100),
        gateway_signature VARCHAR(255),
        gateway_response JSON,
        status ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled', 'expired') DEFAULT 'pending',
        paid_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_order_id (order_id),
        INDEX idx_user_id (user_id),
        INDEX idx_gateway_order_id (gateway_order_id),
        INDEX idx_status (status)
      )`,

      // Create transactions table
      `CREATE TABLE IF NOT EXISTS transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT NOT NULL,
        gateway VARCHAR(50) NOT NULL,
        gateway_transaction_id VARCHAR(100),
        type ENUM('payment', 'refund', 'capture', 'authorization') DEFAULT 'payment',
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
        response_data JSON,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
        INDEX idx_payment_id (payment_id),
        INDEX idx_gateway_transaction_id (gateway_transaction_id)
      )`,

      // Create webhook_logs table
      `CREATE TABLE IF NOT EXISTS webhook_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        gateway VARCHAR(50) NOT NULL,
        event_type VARCHAR(100),
        payload JSON,
        status ENUM('received', 'success', 'failed') DEFAULT 'received',
        signature_valid BOOLEAN DEFAULT NULL,
        error_message TEXT,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_gateway (gateway),
        INDEX idx_event_type (event_type),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      )`,

      // Add columns to orders table (check if they exist first)
      `ALTER TABLE orders 
       ADD COLUMN IF NOT EXISTS payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
       ADD COLUMN IF NOT EXISTS payment_id VARCHAR(100),
       ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50),
       ADD COLUMN IF NOT EXISTS confirmed_at DATETIME,
       ADD COLUMN IF NOT EXISTS shipped_at DATETIME,
       ADD COLUMN IF NOT EXISTS delivered_at DATETIME,
       ADD COLUMN IF NOT EXISTS cancelled_at DATETIME`
    ];

    for (const query of queries) {
      try {
        await db.execute(query);
        console.log('✅ Executed:', query.split('\n')[0].substring(0, 60) + '...');
      } catch (error) {
        console.log('⚠️ Query may already exist:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Error updating schema:', error);
  } finally {
    process.exit(0);
  }
}

// Run the update
updateSchema();