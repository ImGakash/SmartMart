const { pool } = require('../pool');

async function insertOutboxEvent(tx, { eventType, aggregateType, aggregateId, payload }) {
  const client = tx || pool;
  const sql = `
    INSERT INTO outbox_events (event_type, aggregate_type, aggregate_id, payload)
    VALUES ($1, $2, $3, $4)
    RETURNING id, event_id AS "eventId";
  `;
  const res = await client.query(sql, [eventType, aggregateType, aggregateId, payload]);
  return {
    id: Number(res.rows[0].id),
    eventId: res.rows[0].eventId
  };
}

async function claimOutboxEvents(batchSize = 20, leaseSeconds = 10) {
  const sql = `
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
    RETURNING id, event_id AS "eventId", event_type AS "eventType", aggregate_type AS "aggregateType",
              aggregate_id AS "aggregateId", payload, created_at AS "createdAt";
  `;
  const res = await pool.query(sql, [batchSize, leaseSeconds]);
  return res.rows.map(r => ({
    ...r,
    id: Number(r.id),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
  }));
}

async function markOutboxPublished(outboxRowId) {
  const sql = `
    UPDATE outbox_events
    SET status = 'PUBLISHED', published_at = now()
    WHERE id = $1
    RETURNING id, status, published_at AS "publishedAt";
  `;
  const res = await pool.query(sql, [outboxRowId]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    status: row.status,
    publishedAt: row.publishedAt instanceof Date ? row.publishedAt.toISOString() : row.publishedAt
  };
}

async function markOutboxFailed(outboxRowId, errorMessage, maxAttempts = 5) {
  const sql = `
    UPDATE outbox_events
    SET attempts = attempts + 1,
        last_error = $2,
        claimed_at = NULL,
        status = CASE WHEN attempts + 1 >= $3 THEN 'FAILED' ELSE 'PENDING' END
    WHERE id = $1
    RETURNING id, status, attempts, last_error AS "lastError";
  `;
  const res = await pool.query(sql, [outboxRowId, errorMessage, maxAttempts]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    status: row.status,
    attempts: Number(row.attempts),
    lastError: row.lastError
  };
}

async function requeueFailedOutboxEvents() {
  const sql = `
    UPDATE outbox_events
    SET status = 'PENDING', attempts = 0, last_error = NULL, claimed_at = NULL
    WHERE status = 'FAILED'
    RETURNING id;
  `;
  const res = await pool.query(sql);
  return res.rows.length;
}

async function getOutboxMetrics() {
  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
      COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing,
      COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published,
      COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
      COALESCE(EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status = 'PENDING'))), 0) AS "oldestPendingAgeSeconds"
    FROM outbox_events;
  `;
  const res = await pool.query(sql);
  const row = res.rows[0];
  return {
    pending: Number(row.pending),
    processing: Number(row.processing),
    published: Number(row.published),
    failed: Number(row.failed),
    oldestPendingAgeSeconds: Number(row.oldestPendingAgeSeconds)
  };
}

module.exports = {
  insertOutboxEvent,
  claimOutboxEvents,
  markOutboxPublished,
  markOutboxFailed,
  requeueFailedOutboxEvents,
  getOutboxMetrics
};
