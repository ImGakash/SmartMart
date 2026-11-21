const { pool, withTransaction } = require('../pool');

async function markEventProcessed(tx, eventId, consumerGroup) {
  const client = tx || pool;
  const sql = `
    INSERT INTO processed_events (event_id, consumer_group)
    VALUES ($1, $2)
    ON CONFLICT (event_id, consumer_group) DO NOTHING
    RETURNING event_id;
  `;
  const res = await client.query(sql, [eventId, consumerGroup]);
  return res.rows.length > 0;
}

async function insertNotification(tx, { orderId, channel = 'SIMULATED_EMAIL', message }) {
  const client = tx || pool;
  const sql = `
    INSERT INTO notifications (order_id, channel, message)
    VALUES ($1, $2, $3)
    ON CONFLICT (order_id, channel) DO NOTHING
    RETURNING id, order_id AS "orderId", channel, message, created_at AS "createdAt";
  `;
  const res = await client.query(sql, [orderId, channel, message]);
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    orderId: row.orderId,
    channel: row.channel,
    message: row.message,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt
  };
}

async function getNotifications(orderId) {
  const sql = `
    SELECT id, order_id AS "orderId", channel, message, created_at AS "createdAt"
    FROM notifications
    WHERE order_id = $1
    ORDER BY id;
  `;
  const res = await pool.query(sql, [orderId]);
  return res.rows.map((r) => ({
    id: Number(r.id),
    orderId: r.orderId,
    channel: r.channel,
    message: r.message,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt
  }));
}

module.exports = {
  markEventProcessed,
  insertNotification,
  getNotifications
};
