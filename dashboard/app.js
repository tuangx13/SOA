// ========== Dashboard App Logic ==========
const API_BASE = 'http://localhost:3001';

// ========== SYSTEM STATUS CHECK ==========
/**
 * @function checkSystem
 * @description Kiểm tra health check của Order Service
 *              - Gọi GET /health endpoint
 *              - Update status dot color:
 *                - Green (✓ OK): Services running
 *                - Red (✗ ERROR): Network error or services down
 *              - Chạy lặp lại mỗi 10 giây
 */
async function checkSystem() {
  const dot = document.getElementById('systemStatus');
  try {
    const res = await fetch(`${API_BASE}/health`);
    // Green if success, red if any error
    dot.style.background = res.ok ? 'var(--green)' : 'var(--red)';
  } catch {
    // Network error - services not reachable
    dot.style.background = 'var(--red)';
  }
}

// Initial health check
checkSystem();

// Periodic health check every 10 seconds (still filtered by Sampler, but keeps status accurate)
setInterval(checkSystem, 10000);

// ========== ARCHITECTURE ANIMATION ==========
/**
 * @function resetNodes
 * @description Reset UI elements trước khi chạy scenario mới
 *              - Xóa animation classes từ architecture diagram
 *              - Reset status text về 'idle'
 *              - Chuẩn bị cho scenario tiếp theo
 */
function resetNodes() {
  // Remove all animation classes
  document.querySelectorAll('.arch-node').forEach(n => {
    n.classList.remove('active', 'error', 'slow');
  });

  // Reset status text to idle
  ['orderStatus', 'inventoryStatus', 'paymentStatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = 'idle';
      el.style.color = 'var(--text3)';
    }
  });
}

/**
 * @function animateNode
 * @description Animate một service node với delay
 *              - Thêm visual animation (addClass active/error/slow)
 *              - Update status text và color
 *
 * @param {string} id - Element ID (nodeClient, nodeOrder, nodeInventory, nodePayment, nodeJaeger)
 * @param {string} status - Status text (sending, processing, ✓ OK, ✗ ERROR, ⚠ slow, tracing)
 * @param {string} color - CSS color variable (--accent, --green, --red, --yellow, --blue)
 * @param {number} delay - Delay in ms before updating
 *
 * @example
 * await animateNode('nodeOrder', 'processing', 'var(--accent)', 400);
 * // After 400ms, nodeOrder will show "processing" in accent color
 */
function animateNode(id, status, color, delay) {
  return new Promise(resolve => {
    setTimeout(() => {
      const node = document.getElementById(id);
      const statusEl = document.getElementById(id.replace('node', '').toLowerCase() + 'Status');

      // Add active class to node
      if (node) {
        node.classList.add('active');
        if (status === 'error') node.classList.add('error');
        if (status === 'slow') node.classList.add('slow');
      }

      // Update status text and color
      if (statusEl) {
        statusEl.textContent = status;
        statusEl.style.color = color;
      }
      resolve();
    }, delay);
  });
}

// ========== SCENARIO RUNNER ==========
/**
 * Flag để tránh chạy đồng thời 2 scenario (prevent race conditions)
 */
let isRunning = false;

/**
 * @function runScenario
 * @description Chạy một kịch bản demo duy nhất:
 *              - P001 (Happy Path): Thành công thông thường
 *              - P999 (Error): Lỗi inventory (sản phẩm không tồn tại)
 *              - P002 (Slow): Bottleneck - Payment service chậm (2 giây)
 *
 * @param {string} productId - ID của sản phẩm (P001, P999, P002)
 * @param {number} quantity - Số lượng muốn đặt
 *
 * @flow
 * 1. Kiểm tra flag isRunning (nếu đang chạy thì return)
 * 2. Reset UI (xóa animation, kết quả cũ)
 * 3. Hiển thị animation kiến trúc:
 *    - Client: 'sending' (0ms delay)
 *    - Order: 'processing' (400ms delay)
 *    - Inventory/Payment: Update trạng thái dựa vào kết quả
 * 4. POST /order API → Order Service
 * 5. Nhận response từ Order Service (chứa inventory + payment data)
 * 6. Render kết quả:
 *    - Timeline visualization (span bars)
 *    - Response cards (chi tiết)
 *    - Explanation (hướng dẫn Jaeger)
 * 7. Set isRunning = false để cho phép scenario tiếp theo
 */
async function runScenario(productId, quantity) {
  // Prevent concurrent scenarios
  if (isRunning) return;
  isRunning = true;
  resetNodes();

  const resultsSection = document.getElementById('resultsSection');
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Clear previous results
  document.getElementById('timeline').innerHTML = '<div class="loading"></div> Đang gửi request...';
  document.getElementById('responseCards').innerHTML = '';
  document.getElementById('rawJson').textContent = '';
  document.getElementById('explanation').innerHTML = '';

  // Animate architecture - show client and order service activity
  await animateNode('nodeClient', 'sending', 'var(--accent)', 0);
  await animateNode('nodeOrder', 'processing', 'var(--accent)', 400);

  const startTime = Date.now();
  try {
    // Step 1: Send POST /order to Order Service
    // Order Service will orchestrate:
    // - GET /check/:productId to Inventory Service
    // - POST /pay to Payment Service (if inventory OK)
    const res = await fetch(`${API_BASE}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, quantity })
    });
    const data = await res.json();
    const totalMs = Date.now() - startTime; // Total end-to-end time

    // Step 2: Update UI based on response status
    if (res.ok) {
      // Success scenarios (P001, P002)
      await animateNode('nodeInventory', '✓ OK', 'var(--green)', 0);
      if (productId === 'P002') {
        // P002: Slow payment (bottleneck scenario)
        await animateNode('nodePayment', '⚠ slow', 'var(--yellow)', 300);
        document.getElementById('nodePayment').classList.add('slow');
      } else {
        // P001: Normal payment
        await animateNode('nodePayment', '✓ OK', 'var(--green)', 300);
      }
      // Show Jaeger hint
      await animateNode('nodeJaeger', 'tracing', 'var(--yellow)', 500);
    } else {
      // Error scenario (P999)
      // Inventory service returned 500 (product not found)
      await animateNode('nodeInventory', '✗ ERROR', 'var(--red)', 0);
      document.getElementById('nodeInventory').classList.add('error');
      // Payment service was not called (early failure)
    }

    // Step 3: Render results, timeline, and explanation
    renderResults(productId, data, res.status, totalMs);
  } catch (err) {
    // Network error (e.g., services not running)
    document.getElementById('timeline').innerHTML = `<div style="color:var(--red)">❌ Lỗi kết nối: ${err.message}. Kiểm tra docker-compose đang chạy.</div>`;
  }
  isRunning = false;
}

/**
 * @function runConcurrent
 * @description Chạy 3 scenarios đồng thời (concurrent) để demo:
 *              - Context isolation (mỗi request có Trace ID riêng)
 *              - Distributed tracing across concurrent requests
 *              - Comparing different scenarios side-by-side
 *
 * @scenarios
 * - Request #1: P001 (Happy Path - thành công nhanh)
 * - Request #2: P999 (Error - inventory failure)
 * - Request #3: P002 (Slow - payment bottleneck ~2s)
 *
 * @flow
 * 1. Create 3 fetch promises để gửi 3 requests đồng thời
 * 2. Promise.allSettled() - đợi tất cả requests hoàn thành
 *    (bất kể success hay fail)
 * 3. Collect kết quả từ tất cả 3 requests
 * 4. Render 3 results side-by-side
 * 5. Hướng dẫn compare traces trên Jaeger UI
 *
 * @key_point
 * - Dù 3 requests gửi đồng thời
 * - Mỗi request sẽ có Trace ID riêng biệt (không bị lẫn lộn)
 * - Có thể compare trên Jaeger để thấy sự khác biệt
 */
async function runConcurrent() {
  // Prevent concurrent scenarios
  if (isRunning) return;
  isRunning = true;
  resetNodes();

  const resultsSection = document.getElementById('resultsSection');
  resultsSection.style.display = 'block';
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Clear previous results
  document.getElementById('timeline').innerHTML = '<div class="loading"></div> Đang gửi 3 request đồng thời...';
  document.getElementById('responseCards').innerHTML = '';
  document.getElementById('rawJson').textContent = '';
  document.getElementById('explanation').innerHTML = '';

  // Animate Order Service handling 3 requests concurrently
  await animateNode('nodeOrder', 'processing x3', 'var(--blue)', 200);

  // Define 3 test products (scenarios)
  const products = [
    { id: 'P001', qty: 1 }, // Happy path
    { id: 'P999', qty: 1 }, // Error scenario
    { id: 'P002', qty: 1 }  // Slow scenario
  ];
  const startTime = Date.now();

  try {
    // Step 1: Send 3 requests simultaneously
    // Promise.allSettled() - wait for all promises to settle
    // (don't reject on first error)
    const results = await Promise.allSettled(
      products.map(p =>
        fetch(`${API_BASE}/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: p.id, quantity: p.qty })
        }).then(async r => ({
          status: r.status,
          data: await r.json(),
          productId: p.id
        }))
      )
    );
    const totalMs = Date.now() - startTime; // Total time for all 3 requests

    // Step 2: Render all 3 results
    renderConcurrentResults(results, totalMs);

    // Show Jaeger hint
    await animateNode('nodeJaeger', 'tracing x3', 'var(--yellow)', 300);
  } catch (err) {
    // Network error
    document.getElementById('timeline').innerHTML = `<div style="color:var(--red)">❌ Lỗi: ${err.message}</div>`;
  }
  isRunning = false;
}

// ========== RENDER RESULTS ==========
/**
 * @function renderResults
 * @description Render kết quả của một scenario duy nhất
 *              - Timeline visualization (spans)
 *              - Response cards (data details)
 *              - Raw JSON
 *              - Explanation & Jaeger hint
 *
 * @param {string} productId - Product ID (P001, P999, P002)
 * @param {Object} data - Response data from Order Service
 * @param {number} httpStatus - HTTP status code
 * @param {number} totalMs - Total end-to-end time in milliseconds
 *
 * @logic
 * 1. Check nếu là error scenario (P999, httpStatus >= 400)
 * 2. Build timeline visualization:
 *    - Success paths: order → inventory (80ms) → payment (100ms or 2100ms)
 *    - Error paths: order → inventory (error, stops early)
 * 3. Create response cards (HTTP Status, Order ID, ...
 *    - Different layout for success vs error
 * 4. Display raw JSON response
 * 5. Show scenario-specific explanation
 */
function renderResults(productId, data, httpStatus, totalMs) {
  const isError = httpStatus >= 400;
  const isSlow = productId === 'P002';

  // Step 1: Build timeline visualization
  // Timeline shows nested spans: [parent order][child inventory][child payment]
  const spans = [];
  if (!isError) {
    // Success scenarios: P001 (normal) and P002 (slow)
    const invDur = 80; // Inventory always takes ~80ms
    const payDur = isSlow ? 2100 : 150; // Payment: 100ms normal (+ overhead) or 2000ms slow + 100ms overhead
    const total = invDur + payDur + 50; // 50ms order overhead

    // Order Service span (parent - total time)
    spans.push({
      label: 'order-service POST /order',
      left: 0,
      width: 100,
      dur: totalMs,
      cls: 'ok'
    });

    // Inventory Service span (child - ~15-20% of total time)
    spans.push({
      label: 'inventory-service GET /check',
      left: 3,
      width: Math.round(invDur / total * 90),
      dur: invDur,
      cls: 'ok'
    });

    // Payment Service span (child - ~80% for P002, ~20% for P001)
    spans.push({
      label: 'payment-service POST /pay',
      left: 3 + Math.round(invDur / total * 90) + 2,
      width: Math.round(payDur / total * 90),
      dur: payDur,
      cls: isSlow ? 'slow' : 'ok' // Red (slow) for P002
    });
  } else {
    // Error scenario: P999
    // Order calls Inventory which fails
    // Payment is not called (early failure)
    spans.push({
      label: 'order-service POST /order',
      left: 0,
      width: 100,
      dur: totalMs,
      cls: 'error'
    });

    spans.push({
      label: 'inventory-service GET /check',
      left: 3,
      width: 30,
      dur: 80,
      cls: 'error'
    });
    // Payment span not shown (not called)
  }

  // Draw timeline bars (CSS visualization)
  const timelineEl = document.getElementById('timeline');
  timelineEl.innerHTML = spans
    .map(
      s => `
    <div class="span-bar">
      <div class="span-label">${s.label}</div>
      <div class="span-track">
        <div class="span-fill ${s.cls}" style="left:${s.left}%;width:${s.width}%">${s.dur}ms</div>
      </div>
      <div class="span-dur">${s.dur}ms</div>
    </div>
  `
    )
    .join('');

  // Step 2: Build response cards
  // Show key information from API response
  const cards = [];
  cards.push(rc('HTTP Status', `${httpStatus} ${isError ? 'Error' : 'OK'}`, isError ? 'err' : 'ok'));
  if (data.orderId) cards.push(rc('Order ID', data.orderId, 'ok'));
  if (data.productId) cards.push(rc('Product ID', data.productId, isError ? 'err' : 'ok'));
  if (data.quantity) cards.push(rc('Quantity', data.quantity, 'ok'));
  if (data.error) cards.push(rc('Error', data.error, 'err'));
  if (data.inventory) {
    // Inventory response data
    cards.push(
      rc(
        'Inventory',
        `${data.inventory.name} — Stock: ${data.inventory.stock} — $${data.inventory.price}`,
        'ok'
      )
    );
  }
  if (data.payment) {
    // Payment response data
    cards.push(
      rc(
        'Payment',
        `${data.payment.transactionId} — ${data.payment.status} — $${data.payment.amount}`,
        isSlow ? 'warn' : 'ok'
      )
    );
  }
  document.getElementById('responseCards').innerHTML = cards.join('');

  // Step 3: Display raw JSON
  document.getElementById('rawJson').textContent = JSON.stringify(data, null, 2);

  // Step 4: Show explanation specific to scenario
  renderExplanation(productId, isError, isSlow, totalMs);
}

/**
 * @function renderConcurrentResults
 * @description Render kết quả của 3 scenarios chạy đồng thời
 *              - Show 3 requests side-by-side
 *              - Compare results, timing, and status
 *              - Explain context isolation (separate Trace IDs)
 *
 * @param {Array<PromiseSettledResult>} results - Array of 3 settled promises
 *        Each result: { status, value: { status, data, productId } }
 * @param {number} totalMs - Total time for all 3 concurrent requests
 *
 * @key_insights
 * 1. Timeline bars show 3 requests ran nearly simultaneously
 * 2. Each request is independent (different Trace ID in Jaeger)
 * 3. P001: ~200ms (fast)
 * 4. P999: ~100ms (quick error)
 * 5. P002: ~2100ms (slow - blocks others in this visualization but runs parallel)
 * 6. Total time ≈ max(request_times) due to concurrency
 *
 * @usage_in_jaeger
 * - Go to Jaeger UI
 * - Select "order-service"
 * - Find Traces
 * - You'll see 3 traces with different:
 *   - Trace IDs (completely different)
 *   - Durations (P001 is fast, P002 is slow)
 *   - Statuses (P001/P002 success, P999 error)
 * - Use "Compare" to see side-by-side difference
 */
function renderConcurrentResults(results, totalMs) {
  const timelineEl = document.getElementById('timeline');
  const cardsEl = document.getElementById('responseCards');
  const rawEl = document.getElementById('rawJson');

  // Build timeline and cards HTML
  let tHtml = '', cHtml = '';
  const allData = [];

  // Process each of the 3 results
  results.forEach((r, i) => {
    // Extract data from resolved promise
    const d = r.status === 'fulfilled' ? r.value : null;
    if (!d) return;

    // Determine status class (ok/error/slow)
    const ok = d.status < 400;
    const cls = !ok ? 'error' : d.productId === 'P002' ? 'slow' : 'ok';
    const label = `Request #${i + 1} [${d.productId}]`;

    // Position on timeline (staggered)
    const left = i * 5;
    const width = d.productId === 'P002' ? 85 : ok ? 40 : 25;

    // Timeline bar HTML
    tHtml += `<div class="span-bar"><div class="span-label">${label}</div><div class="span-track"><div class="span-fill ${cls}" style="left:${left}%;width:${width}%">${d.status}</div></div><div class="span-dur">${d.status}</div></div>`;

    // Response card HTML
    cHtml += rc(
      label,
      `Status: ${d.status} — ${ok ? d.data.orderId || '' : d.data.error || 'error'}`,
      ok ? (d.productId === 'P002' ? 'warn' : 'ok') : 'err'
    );

    // Collect data
    allData.push(d.data);
  });

  // Render all 3 results
  timelineEl.innerHTML = tHtml;
  cardsEl.innerHTML = cHtml;
  rawEl.textContent = JSON.stringify(allData, null, 2);

  // Show explanation about concurrent context isolation
  document.getElementById('explanation').innerHTML = `
    <div class="step step-ok"><strong>🔄 Concurrent Demo</strong> — 3 requests gửi đồng thời trong ${totalMs}ms</div>
    <div class="step"><strong>Kết quả:</strong> Mỗi request tạo 1 Trace riêng với Trace ID khác nhau.</div>
    <div class="step"><strong>P001:</strong> ✅ Thành công nhanh | <strong>P999:</strong> ❌ Inventory Error | <strong>P002:</strong> ⚠️ Chậm ~2s</div>
    <div class="step step-ok"><strong>Context Propagation:</strong> Dù chạy đồng thời, Trace ID không bị lẫn → mỗi trace độc lập</div>
    <div class="jaeger-hint">➡️ Mở Jaeger UI → Chọn "order-service" → Find Traces → Thấy 3 traces riêng biệt. So sánh (Compare) để thấy sự khác biệt.</div>
  `;
}

function rc(title, body, cls) {
  return `<div class="resp-card ${cls}"><div class="resp-title">${title}</div><div class="resp-body"><span>${body}</span></div></div>`;
}

/**
 * @function renderExplanation
 * @description Render scenario-specific explanation:
 *              - Giải thích cho từng productId (P001, P999, P002)
 *              - Hướng dẫn cách xem traces trên Jaeger
 *              - Demonstrate tracing concepts (root cause, bottleneck)
 *
 * @param {string} productId - Product ID (determines scenario)
 * @param {boolean} isError - True if HTTP >= 400
 * @param {boolean} isSlow - True if productId === 'P002'
 * @param {number} totalMs - Total response time
 */
function renderExplanation(productId, isError, isSlow, totalMs) {
  const el = document.getElementById('explanation');
  let html = '';

  if (productId === 'P001') {
    // ========== SCENARIO 1: HAPPY PATH ========== \\
    // Success scenario - everything works normally \\
    html = `
      <div class="step step-ok"><strong>✅ Kịch bản 1: Happy Path</strong> — Tổng thời gian: ${totalMs}ms</div>
      <div class="step step-ok"><strong>Bước 1:</strong> Client gửi POST /order → <strong>Order Service</strong> nhận request, tạo Order ID</div>
      <div class="step step-ok"><strong>Bước 2:</strong> Order Service gọi <strong>Inventory Service</strong> → Kiểm tra P001 (Laptop Dell XPS 15) → Còn hàng ✓</div>
      <div class="step step-ok"><strong>Bước 3:</strong> Order Service gọi <strong>Payment Service</strong> → Xử lý thanh toán → Thành công ✓</div>
      <div class="step"><strong>📡 Context Propagation:</strong> Trace ID được truyền qua header <code>traceparent</code> từ Order → Inventory → Payment. Tất cả spans thuộc cùng 1 trace.</div>
      <div class="step"><strong>🔗 Trace/Span:</strong> 1 Trace chứa nhiều Spans. Span Order là parent, Inventory và Payment là child spans.</div>
      <div class="step"><strong>⏱️ Timing:</strong> Inventory (~80ms) + Payment (~100ms overhead) = ~200ms total. Very fast!</div>
      <div class="jaeger-hint">➡️ Mở Jaeger → Service "order-service" → Find Traces → Click trace mới nhất → Xem timeline với 3 spans xanh liên kết nhau.</div>
    `;
  } else if (productId === 'P999') {
    // ========== SCENARIO 2: ERROR - ROOT CAUSE ========== \\
    // Error scenario - demonstrates early failure and root cause analysis \\
    html = `
      <div class="step step-err"><strong>❌ Kịch bản 2: Inventory Error</strong> — Tổng thời gian: ${totalMs}ms</div>
      <div class="step step-ok"><strong>Bước 1:</strong> Client gửi POST /order → <strong>Order Service</strong> nhận request</div>
      <div class="step step-err"><strong>Bước 2:</strong> Order Service gọi <strong>Inventory Service</strong> → Kiểm tra P999 → ❌ KHÔNG TÌM THẤY (out of stock)</div>
      <div class="step"><strong>Bước 3:</strong> Order Service nhận lỗi từ Inventory → <strong>DỪNG</strong>, không gọi Payment Service</div>
      <div class="step step-err"><strong>🔍 Root Cause Analysis:</strong> Trên Jaeger, span đỏ (error) xuất hiện tại <strong>Inventory Service</strong>. Span chứa error event: "Product P999 out of stock". Payment không xuất hiện → chứng minh luồng bị ngắt.</div>
      <div class="step"><strong>💡 Giá trị:</strong> Tracing giúp trả lời: "Lỗi ở đâu?" → Inventory. "Tại sao?" → P999 không tồn tại.</div>
      <div class="step"><strong>⚡ Early Exit:</strong> Order Service caught error, không cần gọi Payment. Tiết kiệm resources!</div>
      <div class="jaeger-hint">➡️ Mở Jaeger → Tìm trace có ⚠️ → Click vào → Thấy span đỏ tại inventory-service với error details.</div>
    `;
  } else if (productId === 'P002') {
    // ========== SCENARIO 3: BOTTLENECK - PERFORMANCE ANALYSIS ========== \\
    // Slow scenario - demonstrates bottleneck identification \\
    html = `
      <div class="step step-warn"><strong>🐌 Kịch bản 3: Payment Latency</strong> — Tổng thời gian: ${totalMs}ms</div>
      <div class="step step-ok"><strong>Bước 1:</strong> Client gửi POST /order → <strong>Order Service</strong> nhận request</div>
      <div class="step step-ok"><strong>Bước 2:</strong> Order Service gọi <strong>Inventory Service</strong> → P002 (iPhone 15 Pro Max) → Còn hàng ✓ (nhanh ~80ms)</div>
      <div class="step step-warn"><strong>Bước 3:</strong> Order Service gọi <strong>Payment Service</strong> → ⚠️ Xử lý CHẬM ~2000ms (simulate payment gateway chậm)</div>
      <div class="step step-warn"><strong>🔍 Bottleneck Analysis:</strong> Trên Jaeger, timeline cho thấy Payment span chiếm ~80% tổng thời gian. Inventory chỉ ~80ms → không phải nguyên nhân.</div>
      <div class="step"><strong>💡 Giá trị:</strong> Tracing giúp trả lời: "Tại sao chậm?" → Payment gateway. "Chậm bao lâu?" → ~2 giây.</div>
      <div class="step"><strong>🎯 Action Items:</strong> Cần optimize/cache payment gateway, hoặc retry logic, hoặc call timeout.</div>
      <div class="jaeger-hint">➡️ Mở Jaeger → Tìm trace có duration ~2.5s → Click → Thấy payment-service span dài bất thường so với inventory.</div>
    `;
  }
  el.innerHTML = html;
}

// ========== TAB SWITCH ==========
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (tab === 'formatted') {
    document.getElementById('formattedView').style.display = 'block';
    document.getElementById('rawView').style.display = 'none';
    document.querySelectorAll('.tab')[0].classList.add('active');
  } else {
    document.getElementById('formattedView').style.display = 'none';
    document.getElementById('rawView').style.display = 'block';
    document.querySelectorAll('.tab')[1].classList.add('active');
  }
}
