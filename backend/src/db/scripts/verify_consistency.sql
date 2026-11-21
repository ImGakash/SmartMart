-- SmartMart §13 Consistency Verification Queries (10 Checks)

-- 1. no_negative_stock
SELECT store_id, product_id, stock_qty
FROM inventory
WHERE stock_qty < 0;

-- 2. inventory_reconciliation
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

-- 3. order_totals_match
SELECT o.id, o.order_number, o.total_paise, COALESCE(SUM(oi.subtotal_paise), 0) AS items_total
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
GROUP BY o.id, o.order_number, o.total_paise
HAVING o.total_paise <> COALESCE(SUM(oi.subtotal_paise), 0);

-- 4. order_item_store_matches
SELECT oi.order_id, oi.product_id, oi.store_id AS item_store, o.store_id AS order_store
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE oi.store_id <> o.store_id;

-- 5. outbox_order_orphans
SELECT e.id, e.aggregate_id
FROM outbox_events e
LEFT JOIN orders o ON o.id = e.aggregate_id
WHERE e.event_type = 'OrderPlaced' AND o.id IS NULL;

-- 6. no_duplicate_notifications
SELECT order_id, channel, COUNT(*)
FROM notifications
GROUP BY order_id, channel
HAVING COUNT(*) > 1;

-- 7. every_order_has_items
SELECT o.id, o.order_number
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
WHERE oi.order_id IS NULL;

-- 8. no_orphan_order_items
SELECT oi.order_id, oi.product_id
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE o.id IS NULL;

-- 9. outbox_drained (informational)
SELECT COUNT(*) AS pending_processing_count
FROM outbox_events
WHERE status IN ('PENDING', 'PROCESSING');

-- 10. idempotency_unique
SELECT idempotency_key, COUNT(*)
FROM orders
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
