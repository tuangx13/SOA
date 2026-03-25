# Observability & Tracing trong Microservices
## Logs, Metrics, Distributed Tracing với OpenTelemetry & Jaeger

---

# 1. ĐẶT VẤN ĐỀ

## Monolith vs Microservices: Debugging thay đổi như thế nào?

### Monolith (Đơn giản)
```
[Client] → [Monolith App] → [Database]
                ↑
        1 process, 1 log file
        Stack trace đầy đủ
        Debug = đọc log là xong
```

### Microservices (Phức tạp)
```
[Client] → [API Gateway] → [Service A] → [Service B] → [Service C]
                                ↓              ↓             ↓
                            [DB-A]         [DB-B]        [DB-C]
                            [Log-A]        [Log-B]       [Log-C]
```

### 3 câu hỏi khó trả lời trong Microservices:
1. **"Request của user X đi qua những service nào?"** → Mỗi service log riêng, không liên kết
2. **"Lỗi 500 xảy ra ở đâu?"** → Service A gọi B gọi C, lỗi ở C nhưng user thấy lỗi ở A
3. **"Tại sao response chậm 5 giây?"** → Không biết service nào gây chậm

> **Kết luận:** Trong microservices, cần một hệ thống quan sát (Observability) xuyên suốt tất cả services

---

# 2. GIẢI QUYẾT CÁI GÌ?

## Ba trụ cột của Observability

```
┌─────────────────────────────────────────────────────────┐
│                    OBSERVABILITY                         │
├──────────────────┬──────────────────┬───────────────────┤
│      LOGS        │     METRICS      │     TRACES        │
│                  │                  │                    │
│  "Chuyện gì     │  "Hệ thống      │  "Request đi      │
│   đã xảy ra?"   │   khỏe không?"   │   qua đâu?"       │
│                  │                  │                    │
│  • Text records  │  • Số liệu       │  • Distributed    │
│  • Errors/Events │  • CPU, Memory   │    tracing        │
│  • Debug info    │  • Latency P99   │  • Span timeline  │
│                  │  • Error rate    │  • Causality       │
├──────────────────┼──────────────────┼───────────────────┤
│  Ví dụ:         │  Ví dụ:          │  Ví dụ:           │
│  "Order #123    │  "Avg response   │  "Order → Inv     │
│   failed:       │   time = 200ms,  │   (50ms) → Pay    │
│   item not      │   Error rate     │   (2000ms) →      │
│   found"        │   = 0.5%"        │   Total: 2050ms"  │
└──────────────────┴──────────────────┴───────────────────┘
```

| Trụ cột | Trả lời câu hỏi | Công cụ phổ biến |
|---------|-----------------|------------------|
| **Logs** | Chuyện gì đã xảy ra? | ELK Stack, Loki |
| **Metrics** | Hệ thống khỏe không? | Prometheus, Grafana |
| **Traces** | Request đi qua đâu? | Jaeger, Zipkin |

> **Bài thuyết trình này tập trung vào Distributed Tracing** — trụ cột đặc biệt quan trọng với microservices

---

# 3. TRÌNH BÀY CỤ THỂ

## 3.1 Cấu trúc Trace và Span

```
Trace (TraceID: abc-123)
│
├── Span 1: [order-service] POST /order          ████████████████████ 250ms
│   │
│   ├── Span 2: [inventory-service] GET /check   ████ 30ms
│   │
│   └── Span 3: [payment-service] POST /pay      ████████████ 200ms
```

### Trace là gì?
- Đại diện cho **toàn bộ vòng đời** của 1 request xuyên suốt hệ thống
- Được định danh bởi **Trace ID** duy nhất (UUID)

### Span là gì?
- Đại diện cho **1 đơn vị công việc** (1 HTTP call, 1 DB query...)
- Mỗi span chứa:
  - `traceId` — thuộc trace nào
  - `spanId` — ID riêng
  - `parentSpanId` — span cha (tạo cây phân cấp)
  - `operationName` — tên thao tác (VD: `GET /check/P001`)
  - `startTime`, `duration` — thời gian
  - `attributes` — metadata (VD: `http.status_code: 200`)
  - `events` — sự kiện đáng chú ý (VD: error message)
  - `status` — OK / ERROR

---

## 3.2 Context Propagation (Lan truyền ngữ cảnh)

### Vấn đề: Làm sao liên kết spans qua các services?

```
Order Service                    Inventory Service
┌──────────────┐                ┌──────────────────┐
│  Tạo Trace   │                │  Nhận header      │
│  TraceID: abc │  HTTP Request  │  traceparent:     │
│              │ ──────────────→ │  abc-...-span1    │
│  Span 1     │  Header:       │                    │
│              │  traceparent:  │  Tạo Span 2       │
│              │  00-abc-span1  │  parentId = span1  │
│              │  -01           │  traceId = abc     │
└──────────────┘                └──────────────────┘
```

### Cơ chế hoạt động (W3C Trace Context):
1. Service A tạo **Trace ID** + **Span ID**, gắn vào HTTP header `traceparent`
2. Service B nhận header, **extract** context → biết thuộc trace nào
3. Service B tạo span mới, set `parentSpanId` = span ID của A
4. Kết quả: **tất cả spans liên kết** thành 1 trace duy nhất

### Header format:
```
traceparent: 00-<trace-id>-<parent-span-id>-<trace-flags>
             │   │           │                │
             │   │           │                └─ Sampling (01 = sampled)
             │   │           └─ Parent span ID (16 hex)
             │   └─ Trace ID (32 hex chars)
             └─ Version
```

> **Quan trọng:** OpenTelemetry tự động inject/extract header này — developer không cần code thủ công!

---

## 3.3 OpenTelemetry — Chuẩn hóa Observability

```
┌──────────────────────────────────────────┐
│            OpenTelemetry                  │
│  (Vendor-neutral observability standard) │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────┐  ┌──────────┐  ┌────────┐  │
│  │  API    │  │   SDK    │  │  Auto  │  │
│  │         │  │          │  │ Instru │  │
│  │ Trace() │  │ Exporter │  │ ment   │  │
│  │ Span()  │  │ Sampler  │  │        │  │
│  └─────────┘  └──────────┘  └────────┘  │
│                     │                    │
│              ┌──────┴──────┐             │
│              │   OTLP      │             │
│              │  Protocol   │             │
│              └──────┬──────┘             │
└─────────────────────┼────────────────────┘
                      │
            ┌─────────┴─────────┐
            │  Jaeger / Zipkin  │
            │  Datadog / etc.   │
            └───────────────────┘
```

### Tại sao dùng OpenTelemetry?
- **Chuẩn mở** (CNCF) — không bị vendor lock-in
- **Auto-instrumentation**: chỉ cần 1 file config, tự động trace HTTP, DB, gRPC...
- **Đa ngôn ngữ**: Java, Node.js, Python, Go, .NET, ...
- **OTLP protocol**: giao thức truyền dữ liệu thống nhất

### Auto-instrumentation vs Manual:
```javascript
// ❌ Manual — phải code từng span thủ công
const span = tracer.startSpan('check-inventory');
span.setAttribute('product.id', 'P001');
// ... business logic ...
span.end();

// ✅ Auto-instrumentation — chỉ cần import 1 lần
require('./tracing');  // <-- Chỉ cần dòng này!
// Express, Axios, HTTP tự động được trace
```

---

# 4. TÓM LẠI LÀ GÌ?

## Summary

| Khái niệm | Một dòng tóm tắt |
|------------|-------------------|
| **Observability** | Khả năng hiểu hệ thống từ bên ngoài qua Logs, Metrics, Traces |
| **Distributed Tracing** | Theo dõi 1 request xuyên suốt nhiều services |
| **Trace** | Toàn bộ hành trình của 1 request (chứa nhiều spans) |
| **Span** | 1 bước trong hành trình (1 HTTP call, 1 DB query) |
| **Context Propagation** | Tự động truyền Trace ID qua HTTP headers giữa services |
| **OpenTelemetry** | Chuẩn mở để thu thập Logs/Metrics/Traces, không phụ thuộc vendor |
| **Auto-instrumentation** | Tự động gắn trace mà không cần sửa code business logic |
| **Jaeger** | Công cụ hiển thị và phân tích distributed traces |

### Một câu kết:
> **Observability + OpenTelemetry + Jaeger** = Bộ ba giúp bạn **nhìn thấy** những gì đang xảy ra bên trong hệ thống microservices, từ đó **debug nhanh hơn**, **phát hiện bottleneck**, và **hiểu kiến trúc** ngay cả khi hệ thống có hàng chục services.

---

# 5. DEMO

## Hệ thống demo: Đặt hàng online

```
[Client] → [Order Service] → [Inventory Service]
                  ↓
            [Payment Service]
                  ↓
              [Jaeger UI]  ← Xem traces tại localhost:16686
```

## 5 kịch bản demo:

| # | Kịch bản | Mục đích | ProductId |
|---|---------|----------|-----------|
| 1 | ✅ Happy Path | Xem trace hoàn chỉnh, hiểu Span/Trace | `P001` |
| 2 | ❌ Error | Phát hiện lỗi ở service nào, root cause | `P999` |
| 3 | 🐌 Latency | Tìm bottleneck, service nào chậm | `P002` |
| 4 | 🔄 Concurrent | Chứng minh Trace ID isolation | 3 requests cùng lúc |
| 5 | 🔍 Dependency Map | Tự động vẽ bản đồ service | Jaeger UI → DAG |

## Liên hệ nội dung ↔ Demo:

| Nội dung lý thuyết | Kịch bản demo |
|--------------------|---------------|
| Cấu trúc Trace/Span | Kịch bản 1: Xem spans trong Jaeger |
| Context Propagation | Kịch bản 1 & 4: Spans tự động liên kết |
| Error Detection | Kịch bản 2: Span đỏ, error events |
| Latency Analysis | Kịch bản 3: Timeline bất thường |
| Auto-instrumentation | Tất cả: Không code trace thủ công |
| OpenTelemetry → Jaeger | Tất cả: Traces hiển thị trên Jaeger UI |
