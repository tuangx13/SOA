// Order Service — API Gateway
// Nhận request đặt hàng, gọi Inventory + Payment

require(process.env.TRACING_PATH || '../shared/tracing'); // PHẢI ĐẶT TRƯỚC TẤT CẢ

const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());

// CORS — Cho phép dashboard gọi API
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve dashboard static files
const dashboardPath = process.env.DASHBOARD_PATH || path.join(__dirname, '..', 'dashboard');
app.use(express.static(dashboardPath));

const PORT = process.env.PORT || 3001;
const INVENTORY_URL = process.env.INVENTORY_URL || 'http://localhost:3002';
const PAYMENT_URL = process.env.PAYMENT_URL || 'http://localhost:3003';

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

// POST /order — Tạo đơn hàng
app.post('/order', async (req, res) => {
  const { productId, quantity } = req.body;
  const orderId = `ORD-${Date.now()}`;

  console.log(`[Order] Received order: ${orderId}, product: ${productId}, qty: ${quantity}`);

  try {
    // --- Bước 1: Kiểm tra tồn kho ---
    console.log(`[Order] Checking inventory for product: ${productId}`);
    const inventoryResponse = await axios.get(`${INVENTORY_URL}/check/${productId}`);

    // --- Bước 2: Xử lý thanh toán ---
    console.log(`[Order] Processing payment for order: ${orderId}`);
    const paymentResponse = await axios.post(`${PAYMENT_URL}/pay`, {
      orderId,
      productId,
      amount: (quantity || 1) * 100,
    });

    // --- Thành công ---
    console.log(`[Order] ✅ Order ${orderId} completed successfully`);

    res.json({
      status: 'success',
      orderId,
      productId,
      quantity: quantity || 1,
      inventory: inventoryResponse.data,
      payment: paymentResponse.data,
    });

  } catch (error) {
    console.error(`[Order] ❌ Order ${orderId} failed:`, error.response?.data?.error || error.message);

    res.status(error.response?.status || 500).json({
      status: 'failed',
      orderId,
      error: error.response?.data?.error || error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`[Order Service] Running on port ${PORT}`);
});
