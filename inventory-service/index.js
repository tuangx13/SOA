// Inventory Service — Kiểm tra tồn kho
// Simulate lỗi và trả tồn kho

require(process.env.TRACING_PATH || '../shared/tracing'); // PHẢI ĐẶT TRƯỚC TẤT CẢ

const express = require('express');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;

// Mock database tồn kho
const inventory = {
  'P001': { name: 'Laptop Dell XPS 15', stock: 50, price: 1500 },
  'P002': { name: 'iPhone 15 Pro Max', stock: 30, price: 1200 },
  'P003': { name: 'AirPods Pro', stock: 100, price: 250 },
  // P999 sẽ KHÔNG có trong inventory → simulate lỗi
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

// GET /check/:productId — Kiểm tra tồn kho
app.get('/check/:productId', async (req, res) => {
  const { productId } = req.params;

  console.log(`[Inventory] Checking stock for product: ${productId}`);

  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 50));

  const product = inventory[productId];

  if (!product) {
    // ❌ Sản phẩm không tồn tại hoặc hết hàng
    console.error(`[Inventory] ❌ Product ${productId} NOT FOUND (out of stock)`);

    return res.status(500).json({
      available: false,
      error: `Product ${productId} out of stock`,
      productId,
    });
  }

  // ✅ Sản phẩm có hàng
  console.log(`[Inventory] ✅ Product ${productId}: ${product.name}, stock: ${product.stock}`);

  res.json({
    available: true,
    productId,
    name: product.name,
    stock: product.stock,
    price: product.price,
  });
});

app.listen(PORT, () => {
  console.log(`[Inventory Service] Running on port ${PORT}`);
});
