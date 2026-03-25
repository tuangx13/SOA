// Payment Service — Xử lý thanh toán
// Simulate latency cho P002

require(process.env.TRACING_PATH || '../shared/tracing'); // PHẢI ĐẶT TRƯỚC TẤT CẢ

const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3003;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'payment-service' });
});

// POST /pay — Xử lý thanh toán
app.post('/pay', async (req, res) => {
  const { orderId, productId, amount } = req.body;
  const transactionId = `TXN-${Date.now()}`;

  console.log(`[Payment] Processing payment: order=${orderId}, product=${productId}, amount=$${amount}`);

  // 🐌 Simulate latency cho productId P002
  if (productId === 'P002') {
    console.log(`[Payment] ⚠️ Product ${productId} → Simulating slow payment gateway (2 seconds)...`);
    await new Promise(resolve => setTimeout(resolve, 2000)); // 2 giây delay
  } else {
    // Normal processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // ✅ Thanh toán thành công
  console.log(`[Payment] ✅ Payment completed: ${transactionId}`);

  res.json({
    status: 'completed',
    transactionId,
    orderId,
    productId,
    amount,
    processedAt: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[Payment Service] Running on port ${PORT}`);
});
