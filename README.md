# SOA Demo - Observability & Distributed Tracing

A microservices demonstrator showcasing **Service-Oriented Architecture** with **OpenTelemetry auto-instrumentation** and **distributed tracing** using Jaeger.

## 🏗️ Architecture

The system consists of **3 services** communicating through HTTP APIs:

```
┌─────────────────────────────────────────────────────────────┐
│                        DASHBOARD                             │
│              (served from order-service:3001)                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Order Service    │→→→│ Inventory Service│   │ Payment Service  │
│ (Port 3001)      │   │ (Port 3002)      │   │ (Port 3003)      │
│                  │→→→→→→→→→→→→→→→→→→→→→→→│                  │
│ • API Gateway    │   │ • Stock Check    │   │ • Payment Logic  │
│ • Orchestration  │   │ • Mock DB        │   │ • Simulate delay │
│ • CORS enabled   │   │ • Error handling │   │ • Error handling │
└──────────────────┘   └──────────────────┘   └──────────────────┘
           ↓                    ↓                       ↓
└─────────────────────────────────────────────────────────────┐
│            OpenTelemetry Auto-Instrumentation               │
│  • Trace ID propagation via W3C traceparent header          │
│  • All HTTP and Axios calls automatically captured          │
│  • Filtered traces (business logic only)                    │
└─────────────────────────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────────────────────────┐
│  Jaeger Exporter (Port 4318)                                │
│  Sends traces to Jaeger for visualization                   │
└─────────────────────────────────────────────────────────────┘
```

## ⚡ Quick Start

### Prerequisites
- Node.js (v16+)
- Jaeger running on localhost:4318 (Docker):
  ```bash
  docker run -d \
    -p 4318:4318 \
    -p 16686:16686 \
    jaegertracing/all-in-one
  ```

### Installation

1. **Install dependencies for all services:**
   ```bash
   npm --prefix order-service install
   npm --prefix inventory-service install
   npm --prefix payment-service install
   ```

2. **Start all services:**
   ```bash
   npm --prefix order-service start &
   npm --prefix inventory-service start &
   npm --prefix payment-service start &
   ```

3. **Access Dashboard:**
   Open `http://localhost:3001` in your browser

## 🌐 API Endpoints

### Order Service (Port 3001)

#### POST /order
Create a new order and process it through inventory and payment.

**Request:**
```json
{
  "productId": "P001",
  "quantity": 1
}
```

**Response (Success):**
```json
{
  "status": "success",
  "orderId": "ORD-1711432123456",
  "productId": "P001",
  "quantity": 1,
  "inventory": {
    "available": true,
    "name": "Laptop Dell XPS 15",
    "stock": 50,
    "price": 1500
  },
  "payment": {
    "status": "completed",
    "transactionId": "TXN-1711432125789",
    "amount": 100
  }
}
```

**Response (Error):**
```json
{
  "status": "failed",
  "orderId": "ORD-1711432123456",
  "error": "Product P999 out of stock"
}
```

#### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "order-service"
}
```

### Inventory Service (Port 3002)

#### GET /check/:productId
Check if a product is in stock.

**Response (Success):**
```json
{
  "available": true,
  "productId": "P001",
  "name": "Laptop Dell XPS 15",
  "stock": 50,
  "price": 1500
}
```

**Response (Error):**
```json
{
  "available": false,
  "error": "Product P999 out of stock",
  "productId": "P999"
}
```

### Payment Service (Port 3003)

#### POST /pay
Process a payment.

**Request:**
```json
{
  "orderId": "ORD-1711432123456",
  "productId": "P001",
  "amount": 100
}
```

**Response:**
```json
{
  "status": "completed",
  "transactionId": "TXN-1711432125789",
  "orderId": "ORD-1711432123456",
  "productId": "P001",
  "amount": 100,
  "processedAt": "2026-03-26T10:35:25.789Z"
}
```

## 🎬 Demo Scenarios

### Scenario 1: Happy Path ✅
**Product ID: P001**

Successfully order a product through all services.

**Flow:**
1. Order Service receives `/order` request
2. Inventory Service returns: P001 available (50 stock)
3. Payment Service processes payment (100ms)
4. Order completes successfully

**Expected Trace:**
```
order-service POST /order (300ms)
  ├─ inventory-service GET /check/P001 (80ms)
  └─ payment-service POST /pay (100ms)
```

### Scenario 2: Inventory Error ❌
**Product ID: P999**

Product doesn't exist in inventory, order fails at the first checkpoint.

**Flow:**
1. Order Service receives `/order` request
2. Inventory Service returns: P999 NOT FOUND (error)
3. Payment Service is NOT called (error-driven stop)

**Expected Trace:**
```
order-service POST /order (failed)
  └─ inventory-service GET /check/P999 (ERROR: 500)
     (payment-service not triggered)
```

**Observation:** Demonstrates early failure detection and error propagation.

### Scenario 3: Payment Bottleneck ⚠️
**Product ID: P002**

Payment processing is intentionally slow (2 seconds).

**Flow:**
1. Order Service receives `/order` request
2. Inventory Service returns: P002 available (30 stock) (80ms)
3. Payment Service simulates slow gateway (2000ms)
4. Order completes successfully but takes ~2.1 seconds total

**Expected Trace:**
```
order-service POST /order (2100ms)
  ├─ inventory-service GET /check/P002 (80ms)
  └─ payment-service POST /pay (2000ms) ← BOTTLENECK
```

**Observation:** Demonstrates performance analysis using trace timelines.

### Concurrent Orders
Send 3 orders simultaneously (P001, P999, P002).

**Expected:**
- 3 separate traces, each with unique Trace ID
- No trace ID mixing or data leakage
- Context properly isolated per request

## 🔍 Distributed Tracing & Observability

### How It Works

1. **Auto-Instrumentation:**
   - OpenTelemetry SDK automatically captures all HTTP requests and responses
   - No manual span creation needed
   - Works seamlessly with Express and Axios

2. **Context Propagation (W3C Trace Context):**
   - Each trace gets a unique **Trace ID**
   - The Trace ID is propagated via `traceparent` header:
     ```
     traceparent: 00-<trace_id>-<span_id>-<flags>
     Example: 00-abc123def456-1234567890abcd-01
     ```
   - All services in the chain use the same Trace ID
   - Child spans maintain parent-child relationships

3. **Smart Filtering (Custom Sampler):**
   - Health checks (`/health`) are filtered out
   - Static files (`.js`, `.css`, `.html`, etc.) are filtered out
   - Only **business logic traces** are recorded
   - Result: Clean, focused traces without noise

### Viewing Traces in Jaeger

1. **Open Jaeger UI:**
   - Navigate to `http://localhost:16686`

2. **Select Service:**
   - Choose "order-service" from the dropdown

3. **Find Traces:**
   - Click "Find Traces"
   - Browse recent traces

4. **View Trace Details:**
   - Click any trace to see:
     - **Trace ID:** Unique identifier for the entire request flow
     - **Spans:** Individual operations (order-service, inventory-service, payment-service)
     - **Timeline:** Visual representation of service-to-service calls
     - **Attributes:** Request/response details
     - **Status:** Success or error

5. **Compare Traces:**
   - Select multiple traces
   - Click "Compare" to see differences

## 🌍 Environment Variables

Configure services using environment variables:

```bash
# Order Service
PORT=3001                                    # Express server port
INVENTORY_URL=http://localhost:3002          # Inventory service URL
PAYMENT_URL=http://localhost:3003            # Payment service URL
DASHBOARD_PATH=./dashboard                   # Dashboard static files path
OTEL_SERVICE_NAME=order-service              # Service name for Jaeger
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318  # Jaeger OTLP endpoint

# Inventory Service
PORT=3002
OTEL_SERVICE_NAME=inventory-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Payment Service
PORT=3003
OTEL_SERVICE_NAME=payment-service
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## 📁 Project Structure

```
SOA/
├── order-service/
│   ├── index.js              # API Gateway & orchestration
│   └── package.json
│
├── inventory-service/
│   ├── index.js              # Stock check service
│   └── package.json
│
├── payment-service/
│   ├── index.js              # Payment processing
│   └── package.json
│
├── shared/
│   └── tracing.js            # OpenTelemetry setup (auto-instrumentation)
│
├── dashboard/
│   ├── app.js                # Interactive UI for testing scenarios
│   ├── index.html
│   └── style.css
│
└── README.md
```

## 🔧 Technical Details

### OpenTelemetry Setup (shared/tracing.js)

- **SDK:** `@opentelemetry/sdk-node`
- **Auto-Instrumentations:**
  - Express HTTP server
  - Axios HTTP client
  - Node.js standard libraries
- **Exporter:** OTLP/HTTP to Jaeger
- **Custom Sampler:** Filters health checks and static files

### Key Implementation Details

1. **Tracing initialization must come first:**
   ```javascript
   require('./shared/tracing'); // MUST be before all imports
   ```

2. **Context propagation is automatic:**
   - Axios requests automatically include `traceparent` header
   - Services automatically extract and use the header

3. **No manual span code:**
   - Pure auto-instrumentation approach
   - Business logic remains clean and focused

## 📊 Example Trace Analysis

### Identifying Bottlenecks

**Request time: 2150ms**

Using Jaeger timeline:
- Inventory check: 80ms ← Fast ✅
- Payment processing: 2000ms ← **BOTTLENECK** ⚠️
- Order overhead: 70ms

**Conclusion:** Payment gateway is slow, not inventory.

### Error Root Cause Analysis

**Request failed with 500 status**

Using Jaeger:
1. Find error trace (red icon)
2. Click to view details
3. Locate red span (error)
4. Read error attributes and events
5. Determine: Inventory service returned P999 not found

## 🚀 Performance Characteristics

| Scenario | Total Time | Inventory | Payment | Notes |
|----------|-----------|-----------|---------|-------|
| P001 (Happy) | ~200ms | 80ms | 100ms | Fast & normal |
| P999 (Error) | ~100ms | Error | N/A | Early failure |
| P002 (Slow) | ~2100ms | 80ms | 2000ms | Payment bottleneck |

## 🛠️ Development Notes

### Adding New Services

1. Copy structure from existing service
2. Install OpenTelemetry dependencies:
   ```bash
   npm install express @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions
   ```
3. Import tracing first: `require('../shared/tracing')`
4. Set `OTEL_SERVICE_NAME` environment variable
5. Traces will automatically flow to Jaeger

### Debugging

- Check console logs for service startup confirmation
- Verify Jaeger is running: `curl http://localhost:16686`
- Check OTLP endpoint: `curl http://localhost:4318`
- Export `OTEL_LOG_LEVEL=debug` for verbose OpenTelemetry logs

## 📚 References

- [OpenTelemetry Node.js](https://opentelemetry.io/docs/instrumentation/js/)
- [W3C Trace Context](https://www.w3.org/TR/trace-context/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Service-Oriented Architecture](https://en.wikipedia.org/wiki/Service-oriented_architecture)

## 📝 License

Educational project - Feel free to use and modify for learning purposes.

---

**Last Updated:** March 26, 2026
**Version:** 1.0.0 (Auto-instrumentation)
