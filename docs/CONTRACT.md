```markdown
# SMARTMART INTEGRATION CONTRACT

**Version:** 1.1 — FROZEN  
**Authority:** Single source of truth. Supersedes all earlier notes, drafts, and addendums.  
**Owners:** DB Owner (PostgreSQL layer) · Tech Lead (Express, Kafka, OpenSearch, X-Ray, integration) · Frontend Owner (React)  
**Change rule:** Any change to this file, the schema, event payloads, topic names, or repository signatures requires a new migration/PR **approved by both DB Owner and Tech Lead**. No silent edits. No schema changes via the Aiven console — migrations only.

---

## 1. System and ownership

```text
React (5173) → Express (4000) → PostgreSQL [source of truth]
                     │
              outbox relay → Aiven Kafka → consumers ──→ notifications (PG)
                                          └────────────→ OpenSearch [derived index]
POS simulator ──────→ Express ────────────→ same inventory table
```

| Area | Owner |
|---|---|
| `backend/src/db/**` (pool, migrations, seed, repositories, scripts, db tests) | DB Owner |
| `backend/src/api/**`, `events/**` (relay, consumers), `search/**`, `demo/**` | Tech Lead |
| `frontend/**` | Frontend Owner |

**Out of scope for v1 (do not build):** login/auth, payments, product CRUD admin, restocking, reservations, Android, real SMS/email, OpenSearch synonyms, per-product versioning. Stock may only decrease via `placeOrderAtomic` or `recordPosSale`. Any future stock adjustment requires a movement ledger first.

---

## 2. Global conventions

| Rule | Decision |
|---|---|
| Entity PKs | UUID, `DEFAULT gen_random_uuid()` (PG ≥ 13, built-in) |
| Exceptions | `outbox_events.id`, `notifications.id`: BIGINT identity. `order_number`: sequence |
| Money | BIGINT **paise** everywhere. ₹1,299.00 = `129900`. Never float |
| Timestamps | `TIMESTAMPTZ DEFAULT now()`; every UPDATE sets `updated_at = now()` |
| JSON casing | Repositories return **camelCase**, timestamps as ISO 8601 strings |
| BIGINT parsing | `pool.js` MUST set `pg.types.setTypeParser(20, Number)` — otherwise `pg` returns `int8` as strings and totals break. Safe: all values ≪ 2⁵³ |
| Errors | Repos throw `DbError` (below). Anything unshaped → HTTP 500 |
| Transactions | `withTransaction(fn)` helper; every tx-participating repo function takes `tx` (pg Client) as **first argument** and never touches the pool |

```js
class DbError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.code = code;
    this.details = details;
  }
}
```

| Code | Details | HTTP |
|---|---|---|
| `INSUFFICIENT_STOCK` | `{ productId, storeId, available, requested }` | 409 |
| `CART_EMPTY` | `{}` | 400 |
| `INVALID_QUANTITY` | `{ productId, quantity }` | 400 |
| `PRODUCT_NOT_FOUND` / `STORE_NOT_FOUND` / `CUSTOMER_NOT_FOUND` / `ORDER_NOT_FOUND` | `{ id }` | 404 |

---

## 3. Final schema (migrations implement exactly this)

```sql
CREATE SEQUENCE order_number_seq START WITH 1000;

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_code TEXT NOT NULL UNIQUE,
  store_name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_stores_city ON stores(city);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  price_paise BIGINT NOT NULL CHECK (price_paise > 0),
  image_url TEXT,
  attributes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON products(category);

CREATE TABLE inventory (
  store_id UUID NOT NULL REFERENCES stores(id),
  product_id UUID NOT NULL REFERENCES products(id),
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);
CREATE INDEX idx_inventory_product ON inventory(product_id);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CHECKED_OUT')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_cart ON carts(customer_id, store_id) WHERE status = 'ACTIVE';

CREATE TABLE cart_items (
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (cart_id, product_id)
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE
    DEFAULT ('SM-' || lpad(nextval('order_number_seq')::text, 6, '0')),
  customer_id UUID REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  source TEXT NOT NULL CHECK (source IN ('ONLINE', 'POS_STORE')),
  status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
  total_paise BIGINT NOT NULL CHECK (total_paise >= 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (source = 'POS_STORE' OR customer_id IS NOT NULL)
);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

CREATE TABLE order_items (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_paise BIGINT NOT NULL CHECK (unit_price_paise > 0),
  subtotal_paise BIGINT NOT NULL CHECK (subtotal_paise = unit_price_paise * quantity),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, product_id)
);
CREATE INDEX idx_order_items_product_store ON order_items(product_id, store_id);

CREATE TABLE outbox_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('ORDER', 'PRODUCT')),
  aggregate_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('OrderPlaced', 'StoreStockChanged')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  claimed_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_outbox_claimable ON outbox_events(id) WHERE status IN ('PENDING', 'PROCESSING');

CREATE TABLE processed_events (
  event_id UUID NOT NULL,
  consumer_group TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, consumer_group)
);

CREATE TABLE notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id),
  channel TEXT NOT NULL DEFAULT 'SIMULATED_EMAIL',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, channel)
);

CREATE TABLE inventory_baseline (
  store_id UUID NOT NULL REFERENCES stores(id),
  product_id UUID NOT NULL REFERENCES products(id),
  baseline_qty INTEGER NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, product_id)
);

-- DEMO ONLY: deliberately unsafe, no CHECK. Never used by real checkout.
CREATE TABLE inventory_naive (
  product_id UUID PRIMARY KEY REFERENCES products(id),
  stock_qty INTEGER NOT NULL
);
```

Notes: `order_items.store_id` must equal parent `orders.store_id` (enforced in repo code; verified in §13). `idempotency_key` is **NOT NULL for all orders** — frontend sends it for online checkout; backend generates a UUID for each POS sale.

---

## 4. Seed contract

Deterministic UUIDs (valid v4 shape), rerunnable via `ON CONFLICT (id) DO UPDATE`. `seed.js` reads `shared/products.json` — the single catalog source shared with frontend mocks and initial OpenSearch indexing.

**Stores (6, two in Bengaluru to prove multi-store cities):**

| UUID | store_code | City |
|---|---|---|
| `20000000-0000-4000-8000-000000000001` | BLR-01 | Bengaluru (Indiranagar) |
| `20000000-0000-4000-8000-000000000002` | BLR-02 | Bengaluru (Koramangala) |
| `20000000-0000-4000-8000-000000000003` | MUM-01 | Mumbai |
| `20000000-0000-4000-8000-000000000004` | DEL-01 | Delhi |
| `20000000-0000-4000-8000-000000000005` | HYD-01 | Hyderabad |
| `20000000-0000-4000-8000-000000000006` | CHE-01 | Chennai |

**Products:** 36, IDs `10000000-0000-4000-8000-0000000000NN` (NN = `01`–`36`). Categories: `Electronics`, `Audio`, `Appliances`, `Footwear`, `Apparel`. Realistic Indian brands/names, INR paise prices.

| Fixed demo product | Purpose | Stock |
|---|---|---|
| P01 (`…0001`) boAt Airdopes 141 Bluetooth Earphones, ₹1,299 (`129900`) | **Flash sale** + typo demo (`"bluetoth"`) | BLR-01 = **1**, all others 0 |
| P02 (`…0002`) Samsung Galaxy Watch4 Smartwatch, ₹29,999 (`2999900`) | Stock-10 race test + POS demo | BLR-01 = 10 |
| P03 (`…0003`) Eureka Forbes Vacuum Cleaner | Typo demo (`"vacum"`) + Act 3 chaos order | BLR-01 ≥ 5, varied elsewhere |
| P04–P36 | Catalog depth | varied across stores, some 0 in some cities |

**Customers:** 60, IDs `30000000-0000-4000-8000-0000000000NN`, emails `c01@demo.smartmart.in` … `c60@demo.smartmart.in`, city `Bengaluru` (50 race buyers + spares).

Seed also: fills `inventory_baseline` from seed quantities, fills `inventory_naive` for P01/P02, runs `SELECT setval('order_number_seq', 1000, false)`.

**Frozen demo constants:**
* `FLASH_PRODUCT_ID = '10000000-0000-4000-8000-000000000001'`
* `FLASH_STORE_ID = '20000000-0000-4000-8000-000000000001'`

---

## 5. Repository contract (DB Owner implements; Tech Lead consumes)

All functions are `async`. `tx` = `pg.Client` from `withTransaction`. Self-contained functions manage their own connections via the shared pool.

### Stores & Customers
```js
getStores()      // → [{ id, storeCode, storeName, city, state }]
getCustomers()   // → [{ id, name, email, city }]
```

### Products & Inventory
```js
getProducts({ category, limit = 50, offset = 0 })
// → [{ id, sku, name, brand, category, pricePaise, imageUrl }]   (PG fallback browse)

getProductById(productId)
// → Product + availability: [{ storeId, storeCode, storeName, city, stockQty }]
// throws PRODUCT_NOT_FOUND

getInventory(storeId, productId)        // → { storeId, productId, stockQty, updatedAt } | null
getCityInventory(city, productId)       // → [{ storeId, storeCode, storeName, city, stockQty }]

deductInventory(tx, storeId, productId, quantity)
// conditional UPDATE below; 0 rows → read available (0 if no inventory row), throw INSUFFICIENT_STOCK
// → { stockQty }   — the ONLY stock-decrease primitive in the codebase
```
```sql
UPDATE inventory
SET stock_qty = stock_qty - $3, updated_at = now()
WHERE store_id = $1 AND product_id = $2 AND stock_qty >= $3
RETURNING stock_qty;
```

### Cart
```js
getCart(customerId, storeId)   // upsert: returns ACTIVE cart or creates one
// → { id, customerId, storeId, status, totalPaise,
//     items: [{ productId, name, imageUrl, unitPricePaise, quantity, subtotalPaise, stockQty }] }
// stockQty is ADVISORY display data; checkout re-validates authoritatively

addCartItem(cartId, productId, quantity)     // INCREMENTS existing qty; advisory stock check
updateCartItem(cartId, productId, quantity)  // SETS absolute qty (> 0)
removeCartItem(cartId, productId)
// all three → updated Cart (same shape as getCart)

closeCart(tx, cartId)   // sets status = 'CHECKED_OUT'; never DELETE
```

### Checkout (implement in this exact order)
```js
placeOrderAtomic({ customerId, storeId, items, idempotencyKey, cartId = null })
// items: [{ productId, quantity }]
// → { order: OrderWithItems, replayed: boolean }
```
1. `withTransaction`:
2. Validate: `items` non-empty (`CART_EMPTY`), all `quantity` positive integers (`INVALID_QUANTITY`). Validate `storeId` (`STORE_NOT_FOUND`) and `customerId` (`CUSTOMER_NOT_FOUND`).
3. Fetch authoritative prices: one `SELECT ... FROM products WHERE id = ANY($1)`; any missing → `PRODUCT_NOT_FOUND`.
4. Compute `totalPaise = Σ (pricePaise × quantity)`.
5. **Insert-first idempotency:**
```sql
INSERT INTO orders (customer_id, store_id, source, total_paise, idempotency_key)
VALUES ($1, $2, 'ONLINE', $3, $4)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING *;
```
0 rows → `SELECT` existing order + items by `idempotency_key` (inside `tx`) → return `{ order: existing, replayed: true }`. **No deduction.**
6. Sort `items` by `productId` string ascending (deadlock avoidance — all callers use this same order).
7. `deductInventory(tx, storeId, item.productId, item.quantity)` per item → any failure rolls back the entire transaction.
8. Insert `order_items` (price snapshot, subtotal, `store_id`).
9. If `cartId`: `closeCart(tx, cartId)`.
10. Outbox, same transaction: **1 × `OrderPlaced`** (`aggregateType: 'ORDER'`, `aggregateId: order.id`) **+ 1 × `StoreStockChanged` per item** (`aggregateType: 'PRODUCT'`, `aggregateId: item.productId`, `source: 'ONLINE'`).
11. Commit → `{ order, replayed: false }`.

```js
getOrderById(orderId)           // → OrderWithItems + customer{id,name,email} + store{storeCode,city}; throws ORDER_NOT_FOUND
getOrderByIdempotencyKey(key)   // → OrderWithItems | null
getRecentOrders(limit = 10)
// → [{ id, orderNumber, source, status, totalPaise, storeCity, itemCount, createdAt }]
```
`OrderWithItems = { id, orderNumber, customerId, storeId, source, status, totalPaise, idempotencyKey, createdAt, items: [{ productId, storeId, quantity, unitPricePaise, subtotalPaise }] }`

### POS
```js
recordPosSale({ storeId, items, idempotencyKey })   // → { order, replayed }
```
Same algorithm minus customer/cart (`source = 'POS_STORE'`, `customer_id = NULL`). Emits **only `StoreStockChanged` per item** (no `OrderPlaced`, no notification).

### Outbox
```js
insertOutboxEvent(tx, { eventType, aggregateType, aggregateId, payload })  // → { id, eventId }
claimOutboxEvents(batchSize, leaseSeconds)
// → [{ id, eventId, eventType, aggregateType, aggregateId, payload, createdAt }]
markOutboxPublished(outboxRowId)
markOutboxFailed(outboxRowId, errorMessage, maxAttempts)  // attempts + 1; >= maxAttempts → FAILED, else PENDING
getOutboxMetrics()   // → { pending, processing, published, failed, oldestPendingAgeSeconds }
requeueFailedOutboxEvents()   // FAILED → PENDING, attempts = 0; → count
```
Claim = one short transaction, committed **before** any Kafka publish:
```sql
UPDATE outbox_events
SET status = 'PROCESSING', claimed_at = now()
WHERE id IN (
  SELECT id FROM outbox_events
  WHERE status = 'PENDING'
     OR (status = 'PROCESSING' AND claimed_at < now() - make_interval(secs => $2))
  ORDER BY id
  LIMIT $1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, event_id, event_type, aggregate_type, aggregate_id, payload, created_at;
```
```sql
-- markOutboxFailed:
UPDATE outbox_events
SET attempts = attempts + 1,
    last_error = $2,
    claimed_at = NULL,
    status = CASE WHEN attempts + 1 >= $3 THEN 'FAILED' ELSE 'PENDING' END
WHERE id = $1;
```
`attempts` counts **publish failures only** (not claims) — crash-recovery reclaims must not burn the retry budget. Row `id` (BIGINT) marks publication; `event_id` (UUID) is the consumer dedup key. Never confuse them.

### Consumer persistence
```js
markEventProcessed(tx, eventId, consumerGroup)   // → boolean (true = first time)
insertNotification(tx, { orderId, channel = 'SIMULATED_EMAIL', message })
// ON CONFLICT (order_id, channel) DO NOTHING → Notification | null
getNotifications(orderId)          // → [Notification]
getRecentNotifications(limit = 10) // → [Notification]
```

### Search support
```js
getProductSearchDoc(productId)    // → SearchDoc (§9); throws PRODUCT_NOT_FOUND
getAllProductSearchDocs()         // → [SearchDoc]  (initial bulk + /admin/reindex)
```

### Analytics & Demo
```js
getDashboardMetrics()
// → { totalProducts, totalStores, totalOrders, ordersBySource: { ONLINE, POS_STORE },
//     totalNotifications, lowStockCount, outbox: getOutboxMetrics() }
getInventoryByCity()   // → [{ city, storeCount, totalUnits, outOfStockSkus }]
getLowStock(threshold = 3)   // → [{ productId, name, storeCode, city, stockQty }]
getConsistencyReport()   // → { checks: [{ name, status: 'PASS' | 'FAIL', detail }] } (§13)
resetDemo()   // §13; → { durationMs }
getRaceState(productId, storeId)
// → { baselineQty, currentQty, successfulOrders, unitsSold }

// DEMO ONLY (inventory_naive — split so raceRunner.js injects the 50ms JS delay between read and write):
setNaiveStock(productId, qty)              // → { productId, stockQty }
readNaiveStock(productId)                  // → number (stockQty); alias: getNaiveStock
writeNaiveStockBlind(productId, newQty)    // UPDATE inventory_naive SET stock_qty = $2 WHERE product_id = $1
```

---

## 6. Event contract (Kafka)

**Topics (create in Aiven console at H0, 3 partitions each):** `order-events`, `inventory-events`.  
**Message key:** `aggregateId`.  
**Consumer groups:** `notifications`, `search-indexer`.

**Envelope** — relay wraps the outbox payload; `outbox_events.payload` stores business fields only:
```json
{
  "schemaVersion": 1,
  "eventId": "<outbox event_id>",
  "eventType": "OrderPlaced | StoreStockChanged",
  "occurredAt": "<outbox created_at, ISO-8601>",
  "...": "business fields below"
}
```

**`OrderPlaced`** (online orders only → topic `order-events`):
```json
{
  "orderId": "uuid",
  "orderNumber": "SM-001000",
  "source": "ONLINE",
  "storeId": "uuid",
  "customer": {
    "id": "uuid",
    "name": "Asha Rao",
    "email": "c01@demo.smartmart.in"
  },
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPricePaise": 129900
    }
  ],
  "totalPaise": 259800
}
```

**`StoreStockChanged`** (both `ONLINE` and `POS_STORE` → topic `inventory-events`, one event per item):
```json
{
  "productId": "uuid",
  "storeId": "uuid",
  "qtySold": 2,
  "source": "ONLINE | POS_STORE",
  "orderId": "uuid"
}
```

**KafkaJS config:**
* Auth mode via `KAFKA_AUTH_MODE`: `sasl` (`SASL_SSL` + `scram-sha-256` + CA) or `mtls` (TLS client `cert` + `key` + `ca` — fallback if Aiven Free Tier uses certificate auth). Confirm active mode in §18A and remove the unused branch from `.env.example` before H0.
* Producer: `acks: -1`, `idempotent: true`, `retries: 5`, `requestTimeout: 8000`.
* Consumers: `fromBeginning: true`, `autoCommit: false`, `eachMessage`; commit `offset + 1` **only after** processing/PG transaction commits. Failure → no commit → redelivery.
* Delivery semantics: **at-least-once + idempotent effects.** Never claim exactly-once.

---

## 7. Outbox relay (Tech Lead)

Single worker inside the backend process.  
Loop: `claimOutboxEvents(batchSize, leaseSeconds)` → publish each (topic routed by `eventType`, `key = aggregateId`, `value = JSON.stringify(envelope)`) → await broker ack → `markOutboxPublished(id)`; on publish error → `markOutboxFailed(id, msg, maxAttempts)`.  
Poll interval: `1000ms` when idle; immediate next poll on full batch.  
Lease: `30s` default, `10s` for stage demo (`OUTBOX_LEASE_SECONDS`). `config.js` **must assert `OUTBOX_LEASE_SECONDS * 1000 > KAFKA_PUBLISH_TIMEOUT_MS + 1000` at startup** and exit loudly if violated.

**Chaos switches (in-memory flags via admin API):**

| Target | Effect |
|---|---|
| `relay` | Pause the relay loop |
| `relay-after-publish` | One-shot fault injection: for the next **`OrderPlaced`** event only — publish to Kafka, await ack, **skip `markOutboxPublished`**, leave row `PROCESSING`, clear the flag. **Relay keeps running.** All other events flow normally. |
| `notifications` | Pause processing in `notifications` consumer |
| `search-indexer` | Pause processing in `search-indexer` consumer |

---

## 8. Consumers (Tech Lead)

**`notifications` (`order-events`):**
```js
await withTransaction(async (tx) => {
  const first = await markEventProcessed(tx, eventId, 'notifications');
  if (!first) return;
  await insertNotification(tx, { orderId, message });
});
// commit Kafka offset only after withTransaction resolves
```
Message template (zero extra DB reads):  
`Order ${orderNumber} confirmed: ${items.length} item(s), ₹${(totalPaise / 100).toFixed(2)}. Thank you for shopping with SmartMart!`

**`search-indexer` (`inventory-events`):**  
Re-read authoritative state via `getProductSearchDoc(payload.productId)` → upsert into OpenSearch (`_id = productId`, `refresh: 'wait_for'`) → emit SSE `INDEXED` for `payload.orderId` (with `{ productId }` in `detail`) → commit Kafka offset.  
**Never index stock numbers from the event payload.** Re-read + deterministic upsert is idempotent; no dedup table required.

---

## 9. OpenSearch contract

Index: `smartmart-products`, one document per product, `_id = productId`:
```json
{
  "productId": "uuid",
  "sku": "SM-AUD-001",
  "name": "boAt Airdopes 141 Bluetooth Earphones",
  "description": "...",
  "category": "Audio",
  "brand": "boAt",
  "pricePaise": 129900,
  "imageUrl": "...",
  "cities": ["Bengaluru"],
  "availability": [
    { "storeId": "uuid", "storeCode": "BLR-01", "city": "Bengaluru", "stockQty": 1 }
  ],
  "totalStock": 1,
  "indexedAt": "2026-01-01T00:00:00.000Z"
}
```
* `cities` = distinct cities where `stockQty > 0`.
* `availability` includes zero-stock stores.

**Mapping:** `name` text (boost `^3`), `brand` text (`^2`), `description` text; `category`, `cities`, `sku`, `productId` keyword; `pricePaise` long; `availability` nested; `totalStock` integer.

**Query:** `multi_match` with `fuzziness: "AUTO"`; filters: `term category`, `term cities`, `range pricePaise`; highlight `name`, `description`. Empty `q` → `match_all` (browse).  
Initial bulk index runs at startup from `getAllProductSearchDocs()`; `POST /api/admin/reindex` re-runs it.  
**Degradation:** If OpenSearch is unreachable, `GET /api/search` returns `503`; frontend falls back to `GET /api/products` (PostgreSQL browse without typo tolerance).

---

## 10. REST API contract (Tech Lead implements; Frontend consumes)

Base URL: `http://localhost:4000/api` (except `GET /health`, mounted explicitly at root `http://localhost:4000/health` in `app.js`, outside the `/api` router). JSON camelCase. **No auth.**

Headers:
* `X-Customer-Id: <uuid>` — active demo customer (seeded customers).
* `Idempotency-Key: <uuid>` — required on `POST /checkout` (frontend generates per attempt, reuses on retry).

Error body: `{ "error": { "code", "message", "details" } }` — HTTP status mapping in §2.

| Method · Path | Input & Resolution Semantics | Success |
|---|---|---|
| `GET /health` *(root, no `/api`)* | Mounted directly in `app.js` | `{ pg, kafka, opensearch: 'up' \| 'down' }` |
| `GET /stores` | — | `[{ id, storeCode, storeName, city, state }]` |
| `GET /customers` | — | `[{ id, name, email, city }]` |
| `GET /products` | `?category&limit&offset` | `[ProductCard]` (PG fallback) |
| `GET /products/:id` | — | Product + availability |
| `GET /search` | `?q&category&city&minPaise&maxPaise&limit` | `{ took, total, hits: [SearchDoc + highlight] }` |
| `GET /cart` | `?storeId` + `X-Customer-Id` (upserts `ACTIVE` cart) | Cart (§5) |
| `POST /cart/items` | `{ storeId, productId, quantity }` + `X-Customer-Id` — resolves or creates `ACTIVE` cart via `getCart(customerId, storeId)`, then calls `addCartItem` (increments) | Cart |
| `PATCH /cart/items/:productId` | `{ storeId, quantity }` + `X-Customer-Id` — resolves `ACTIVE` cart via `getCart`, then calls `updateCartItem` (sets absolute qty) | Cart |
| `DELETE /cart/items/:productId` | `?storeId` + `X-Customer-Id` — resolves `ACTIVE` cart via `getCart`, then calls `removeCartItem` | Cart |
| `POST /checkout` | `{ storeId, items? }` + both headers; if `items` omitted, loads active cart and passes `cartId` | `201 { order, replayed: false }` / `200 { order, replayed: true }` / `409` |
| `GET /orders/:id` | — | OrderWithItems + customer + store |
| `GET /orders/:id/notifications` | — | `[Notification]` |
| `GET /orders/:id/events` | SSE | §11 |
| `POST /pos/sale` | `{ storeId, items }` (backend generates `idempotencyKey`) | `201 { order }` |
| `GET /xray/metrics` | — | §11 bundle |
| `GET /xray/stream` | SSE | metrics every 1s |
| `POST /demo/race` | `{ productId, storeId, buyers = 50, mode: 'safe' \| 'naive' }` | §12 |
| `POST /demo/reset` | — | `{ durationMs }` |
| `POST /admin/chaos` | `{ target, enabled }` | `{ target, paused }` |
| `GET /admin/chaos` | — | all switch states |
| `POST /admin/outbox/requeue` | — | `{ requeued }` |
| `POST /admin/reindex` | — | `{ indexed }` |

---

## 11. X-Ray / SSE

Order timeline stages (exact names): `COMMITTED` → `OUTBOX_PUBLISHED` → `NOTIFIED` → `INDEXED`.  
SSE event name: `stage`, payload: `{ stage, at, detail }`.  
Multi-item orders emit one `INDEXED` event per item (`detail: { productId }`); frontend marks `INDEXED` complete once received (or displays indexed count).  
Internal `EventEmitter` bridges checkout, relay, and consumers → SSE.

`/xray/metrics` bundle:
```json
{
  "dashboard": {},
  "inventoryByCity": [],
  "lowStock": [],
  "recentOrders": [],
  "recentNotifications": [],
  "outbox": {},
  "consistency": {},
  "chaos": {}
}
```
All values come from live PostgreSQL — nothing hardcoded.

---

## 12. Demo contract

**Safe race:** `N` distinct seeded customers, `N` distinct idempotency keys, parallel `placeOrderAtomic` (`cartId = null`) on P01/BLR-01.  
Response:
```json
{
  "results": [{ "customerId": "uuid", "status": "SUCCESS | INSUFFICIENT_STOCK", "orderId": "uuid" }],
  "summary": { "success": 1, "failed": 49, "baselineQty": 1, "finalStock": 0 }
}
```

**Naive race:** Same `N` concurrent workers in `raceRunner.js`, each executing: `const current = await readNaiveStock(productId)` → **50ms JS delay** → `await writeNaiveStockBlind(productId, current - qty)`. No orders created — pure inventory-corruption demo against `inventory_naive` only. Guarantees visible negative stock.

**Reset between runs:** `POST /demo/reset` (target `< 5s`).

---

## 13. Reset and verification (DB Owner)

`resetDemo()` in one transaction:
1. `TRUNCATE notifications, processed_events, outbox_events, order_items, orders, cart_items, carts RESTART IDENTITY CASCADE;`
2. Restore `inventory` and `inventory_naive` from seed quantities.
3. Rebuild `inventory_baseline` from seed quantities.
4. `SELECT setval('order_number_seq', 1000, false);`
5. **Preserve** `stores`, `products`, and `customers`.

`verify_consistency.sql` / `getConsistencyReport()` — each check returns `{ name, status: 'PASS' | 'FAIL', detail }`. Any row returned = `FAIL` (except check 9):

1. `no_negative_stock` — `SELECT * FROM inventory WHERE stock_qty < 0`
2. `inventory_reconciliation` — per `(store_id, product_id)`: `baseline_qty - Σ CONFIRMED order_items.quantity = stock_qty`:
```sql
SELECT b.store_id, b.product_id
FROM inventory_baseline b
JOIN inventory i ON i.store_id = b.store_id AND i.product_id = b.product_id
LEFT JOIN (
  SELECT oi.store_id, oi.product_id, SUM(oi.quantity) AS qty
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.status = 'CONFIRMED'
  GROUP BY 1, 2
) sold ON sold.store_id = b.store_id AND sold.product_id = b.product_id
WHERE b.baseline_qty - COALESCE(sold.qty, 0) <> i.stock_qty;
```
3. `order_totals_match` — `orders.total_paise <> Σ order_items.subtotal_paise`
4. `order_item_store_matches` — `order_items.store_id <> orders.store_id`
5. `outbox_order_orphans` — `outbox_events` where `event_type = 'OrderPlaced'` `LEFT JOIN orders ON orders.id = outbox_events.aggregate_id WHERE orders.id IS NULL`
6. `no_duplicate_notifications` — `GROUP BY (order_id, channel) HAVING COUNT(*) > 1`
7. `every_order_has_items` — `orders` with zero matching rows in `order_items`
8. `no_orphan_order_items` — `order_items LEFT JOIN orders WHERE orders.id IS NULL`
9. `outbox_drained` — `PASS` when `COUNT(*) WHERE status IN ('PENDING', 'PROCESSING') = 0` (informational during chaos demos)
10. `idempotency_unique` — duplicate `orders.idempotency_key`

---

## 14. Configuration (`.env.example`, no secrets in Git)

| Var | Value / Notes |
|---|---|
| `DATABASE_URL` | Aiven PostgreSQL connection URI |
| `PG_CA_CERT_PATH` | Path to Aiven PG CA cert (`rejectUnauthorized: true`) |
| `PG_POOL_MAX` | `8` (API ~5, relay 1, consumers 2; verify Aiven limit, keep headroom) |
| `KAFKA_BROKERS` | Aiven Kafka host:port |
| `KAFKA_AUTH_MODE` | `sasl` or `mtls` *(verify live Aiven mode in §18A; delete unused branch from `.env.example`)* |
| `KAFKA_CA_CERT_PATH` | Path to Aiven Kafka CA cert |
| `KAFKA_USERNAME`, `KAFKA_PASSWORD` | Used only if `KAFKA_AUTH_MODE=sasl` |
| `KAFKA_CERT_PATH`, `KAFKA_KEY_PATH` | Used only if `KAFKA_AUTH_MODE=mtls` |
| `OPENSEARCH_URL`, `OPENSEARCH_USERNAME`, `OPENSEARCH_PASSWORD`, `OPENSEARCH_CA_CERT_PATH` | Aiven OpenSearch |
| `OUTBOX_BATCH_SIZE` | `20` |
| `OUTBOX_POLL_MS` | `1000` |
| `OUTBOX_LEASE_SECONDS` | `10` (demo) / `30` (default) |
| `OUTBOX_MAX_ATTEMPTS` | `5` |
| `KAFKA_PUBLISH_TIMEOUT_MS` | `8000` *(startup asserts `OUTBOX_LEASE_SECONDS * 1000 > KAFKA_PUBLISH_TIMEOUT_MS + 1000`)* |
| `PORT` | `4000` |
| `VITE_API_BASE` | `http://localhost:4000/api` |

All three Aiven services in the **same region**, closest to India available. One team account. Topics created manually at H0.

---

## 15. Acceptance tests (exact numbers, automated where practical)

| Test | Expected |
|---|---|
| A: stock 1, 50 concurrent buyers, distinct keys | exactly 1 success, 49 × 409, final stock 0, 1 order |
| B: stock 10, 50 buyers | exactly 10 successes, 40 failures, final stock 0 |
| C: multi-item, second item unavailable | full rollback: no order, no items, no outbox rows, stock unchanged |
| D: POS vs online, stock 1, concurrent | exactly 1 succeeds; `source` identifies winner; stock 0 |
| E: same idempotency key twice (incl. concurrent) | same order returned, one deduction, one `OrderPlaced` |
| F: same event delivered twice to `notifications` | 1 `processed_events` row, 1 notification; other group processes independently |
| G: relay crash after publish, before mark | lease expires → still-running relay reclaims → republish → dedup absorbs → outbox `PUBLISHED` |
| H: constraints | PG rejects negative stock, qty ≤ 0, duplicate SKU, duplicate keys, bad FKs |
| I: pool under 50-way race | no leaked clients; test timeout 30s (queuing on pool of 8 is correct, not a bug) |
| J: search | `"bluetoth"` finds P01; city filter `Bengaluru` shows it, `Mumbai` doesn't; after P01 hits stock 0, P01 disappears from `Bengaluru` search ≤ ~2s |

---

## 16. Change control

Schema changes: new numbered migration + contract PR, both DB Owner and Tech Lead approve. Payload, topic, or signature changes: bump contract version and update all consumers in the same PR. **If it is not in this file, it does not exist.**

---

## 17. Repository structure and Git discipline

Single monorepo. Strict directory ownership prevents merge conflicts across all three owners.

```text
smartmart/
├── docs/
│   └── CONTRACT.md                 # This file (v1.1 FROZEN)
├── shared/
│   └── products.json               # Single catalog source (36 Indian retail products + seed stock)
├── backend/
│   ├── .env.example                # All vars in §14 (unused Kafka auth branch pruned), zero secrets
│   ├── package.json
│   └── src/
│       ├── index.js                # Server bootstrap, relay + consumers startup, graceful shutdown (Tech Lead)
│       ├── config.js               # Env parsing + startup assertions incl. lease > timeout + 1000ms (Tech Lead)
│       ├── db/                     # ── DB OWNER ──
│       │   ├── pool.js             # pg.Pool (max: 8), SSL CA, int8 parser, withTransaction, DbError
│       │   ├── migrations/
│       │   │   └── 001_init.sql    # Exact §3 schema
│       │   ├── seed.js             # Idempotent seed from shared/products.json (§4)
│       │   ├── repositories/
│       │   │   ├── storeRepo.js
│       │   │   ├── customerRepo.js
│       │   │   ├── productRepo.js  # products + inventory + deductInventory + search docs
│       │   │   ├── cartRepo.js
│       │   │   ├── orderRepo.js    # placeOrderAtomic + recordPosSale + order queries
│       │   │   ├── outboxRepo.js
│       │   │   ├── consumerRepo.js # markEventProcessed + notifications
│       │   │   └── analyticsRepo.js# dashboard, city inventory, low stock, consistency, reset, naive read/write
│       │   └── scripts/
│       │       ├── migrate.js
│       │       ├── verify_consistency.sql
│       │       └── reset_demo.js
│       ├── api/                    # ── TECH LEAD ──
│       │   ├── app.js              # Express app, CORS, JSON, root GET /health, /api router, DbError handler
│       │   ├── routes/
│       │   │   ├── catalog.js      # /stores, /customers, /products, /search
│       │   │   ├── cart.js         # /cart, /cart/items
│       │   │   ├── checkout.js     # /checkout, /orders, /pos/sale
│       │   │   ├── xray.js         # /xray/metrics, /xray/stream, /orders/:id/events
│       │   │   ├── demo.js         # /demo/race, /demo/reset
│       │   │   └── admin.js        # /admin/chaos, /admin/outbox/requeue, /admin/reindex
│       │   └── mocks/              # In-memory repo mocks (unblocks Tech Lead + Frontend before Gate 2)
│       ├── events/                 # ── TECH LEAD ──
│       │   ├── kafka.js            # KafkaJS client, producer, consumer factories
│       │   ├── bus.js              # Internal EventEmitter (stage updates → SSE)
│       │   ├── chaos.js            # In-memory chaos switches (§7)
│       │   ├── outboxRelay.js      # Poll + claim + publish + mark loop (§7)
│       │   ├── notificationsConsumer.js
│       │   └── searchIndexerConsumer.js
│       ├── search/                 # ── TECH LEAD ──
│       │   ├── client.js           # Aiven OpenSearch HTTPS client
│       │   └── productIndex.js     # Index mapping, bulk seed, upsert, fuzzy + filtered search (§9)
│       └── demo/                   # ── TECH LEAD ──
│           └── raceRunner.js       # Safe vs naive (read → 50ms delay → blind write) simulator (§12)
│   └── tests/
│       ├── db/                     # DB Owner: Tests A, B, C, D, E, H, I
│       └── integration/            # Tech Lead: Tests F, G, J + full API smoke tests
└── frontend/                       # ── FRONTEND OWNER ──
    ├── package.json
    └── src/
        ├── api/client.js           # REST + SSE client (injects X-Customer-Id, Idempotency-Key)
        ├── pages/
        │   ├── Storefront.jsx      # Search (typo + filters), city/store switcher, product cards
        │   ├── CartCheckout.jsx    # Cart drawer/page + checkout + live order timeline (SSE)
        │   ├── PosSimulator.jsx    # Walk-in physical store sale simulator
        │   ├── RaceDemo.jsx        # Safe vs Naive 50-buyer flash-sale comparison
        │   └── XRayDashboard.jsx   # Live metrics, outbox state, chaos toggles, 10/10 consistency report
        └── components/
```

**Branch rules:**
* `main` stays green at all times.
* Feature branches: `db/<task>`, `be/<task>`, `fe/<task>`.
* No owner edits files outside their ownership directory without explicit PR approval.

---

## 18. Deliverables and sign-off gates

### A. Pre-hackathon deliverables (No pre-written business logic; scaffolding, client connection smoke-tests, mocks, and local-PG test harnesses may be prepared pre-event)

| Owner | Deliverable | Review Gate |
|---|---|---|
| **DB Owner** | 1. ER diagram matching §3.<br>2. Verified SQL schema draft + `verify_consistency.sql` query list.<br>3. Repo folder & function signature checklist matching §5.<br>4. Aiven PG SSL connection + actual `max_connections` verified.<br>5. Catalog spec for 36 Indian retail products (P01–P36) + local-PG test harness for Tests A, B, C, E, H, I. | Tech Lead verifies 100% alignment with §2–§5 and §13. |
| **Tech Lead** | 1. Aiven Kafka auth mode (`sasl` vs `mtls`) verified; unused auth branch deleted from `.env.example`; manual topic creation confirmed.<br>2. Aiven OpenSearch HTTPS + Dashboards verified.<br>3. Express skeleton (`app.js`, root `/health`), `config.js` assertions, and mock repos ready.<br>4. Dry-run mental trace of sync deduction, outbox lease recovery, and consumer idempotency. | All 3 Aiven services verified in same India-closest region. |
| **Frontend Owner** | 1. Screen flow & state map for all 5 pages (`Storefront`, `CartCheckout`, `PosSimulator`, `RaceDemo`, `XRayDashboard`).<br>2. Mock data plan using `shared/products.json` + §10 response shapes.<br>3. Confirmed `Idempotency-Key` generation/retry handling and SSE subscription lifecycle. | Tech Lead confirms zero API shape mismatches against §10–§11. |

### B. 24-hour hackathon integration gates

| Gate | Target | Required Proof (Run & Verify — No Unverified Claims) |
|---|---|---|
| **Gate 1 — Infra & Schema Live** | **H2** | All 3 Aiven services up in same region; Kafka topics `order-events` & `inventory-events` created (3 partitions each); `001_init.sql` + `seed.js` executed; root `GET /health` returns `{ pg: 'up', kafka: 'up', opensearch: 'up' }`. |
| **Gate 2 — Core Engine Swap** | **H6–H8** | DB Owner re-runs pre-authored automated **Tests A, B, C, E, H, I** against live Aiven PG (not first authorship). Tech Lead swaps mocked repos for real `backend/src/db/**`. Initial OpenSearch bulk index succeeds (36 docs). |
| **Gate 3 — Full Event Pipeline** | **H12–H14** | Online checkout & POS sale flow end-to-end: PG commit → Outbox Relay → Kafka → `notifications` + `search-indexer` → OpenSearch updated ≤ 2s. **Tests D, F, G, J** green. |
| **Gate 4 — Stage Weapons Ready** | **H18–H20** | All 5 Frontend pages wired to live APIs & SSE: live order timeline (`COMMITTED → OUTBOX_PUBLISHED → NOTIFIED → INDEXED`), Safe vs Naive 50-buyer race, Chaos crash & self-healing recovery, POS live sync, `POST /demo/reset` < 5s, 10/10 Consistency Report green. |
| **Gate 5 — Feature Freeze & Rehearsal** | **H22–H24** | Strict code freeze at H22. Three clean end-to-end stage rehearsals including full `resetDemo()` between runs. Pitch deck & Q&A notes locked. |

---

## 19. Stage demo choreography (3-minute live proof)

Run `POST /demo/reset` before stepping on stage. Verify 10/10 Consistency Report = `PASS`, P01 (`BLR-01`) stock = `1`, P02 (`BLR-01`) stock = `10`, and P03 (`BLR-01`) stock ≥ `5`.

1. **Act 1 — India-Smart Search & Storefront (35s · Frontend / Tech Lead):**
   * Search `"bluetoth"` with city filter `Bengaluru` → OpenSearch fuzzy query highlights **boAt Airdopes 141** (stock `1` in `BLR-01`).
   * Switch city filter to `Mumbai` → P01 disappears (`cities` array excludes Mumbai).
2. **Act 2 — Live Flash-Sale Race: Naive vs Safe (45s · DB Owner):**
   * Run **Naive** 50-buyer race → `inventory_naive` drops to negative stock (proves real check-then-act corruption).
   * Run **Safe** 50-buyer race on P01 (`BLR-01`, stock `1`) → **exactly 1 `201 Created`**, **49 × `409 Conflict`**, final stock = `0`, 1 order created.
   * Show live Order Timeline SSE stages lighting up: `COMMITTED → OUTBOX_PUBLISHED → NOTIFIED → INDEXED`.
   * Re-run `"bluetoth"` search with `Bengaluru` filter active → **P01 vanishes completely from Bengaluru results** (*"watch it disappear from Bengaluru — Kafka synced the zero-stock state to OpenSearch in real time"*).
3. **Act 3 — Physical Store POS Sync + Self-Healing Chaos Recovery (50s · Tech Lead):**
   * Trigger a **Physical Store POS Sale** on P02 (`BLR-01`, stock `10 → 9`) → `StoreStockChanged` updates OpenSearch in real time without emitting a customer notification.
   * Enable chaos switch **`relay-after-publish`**, then trigger an online order on **P03** (keeping P01/P02 numbers untouched) → relay publishes `OrderPlaced` to Kafka, skips `markOutboxPublished`, leaves the row `PROCESSING`, clears the flag, and **keeps running**.
   * Wait 10s for lease expiry → still-running relay automatically reclaims the expired `OrderPlaced` row and republishes → `notifications` consumer dedups via `processed_events` → **still exactly 1 notification**, outbox self-heals and drains to `PUBLISHED`.
4. **Act 4 — Mathematical Proof & Close (30s · All):**
   * Open X-Ray Consistency Panel → all **10/10 SQL invariants = `PASS`** (`baseline_qty - sold = current_stock`, zero negative stock, zero orphan outbox events, zero duplicate notifications).
   * One-line wrap: *"PostgreSQL guarantees correctness, Kafka guarantees decoupled durability, OpenSearch guarantees instant discovery—proven live under race conditions and simulated crashes."*
```