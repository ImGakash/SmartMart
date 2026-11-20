import { ApiError } from './client.js';
import { mockXRayBundle } from './mock.js';

/**
 * Robust EventSource helper with auto-reconnect, exponential backoff,
 * and silent recovery designed for stage Wi-Fi drops.
 *
 * @param {string} endpoint - Path, e.g. '/orders/:id/events' or '/xray/stream'
 * @param {object} callbacks
 * @param {function} callbacks.onMessage - Called with parsed data and event type
 * @param {function} callbacks.onStatusChange - Called with 'connecting' | 'connected' | 'reconnecting' | 'closed'
 * @param {function} callbacks.onError - Called with error details
 * @returns {function} unsubscribe function
 */
export function subscribeSSE(endpoint, callbacks = {}) {
  const {
    onMessage,
    onStatusChange,
    onError,
  } = callbacks;

  const USE_MOCKS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCKS !== undefined)
    ? import.meta.env.VITE_USE_MOCKS === 'true'
    : true;
  const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
    ? import.meta.env.VITE_API_BASE
    : 'http://localhost:4000/api';

  let eventSource = null;
  let isClosed = false;
  let reconnectAttempts = 0;
  let reconnectTimeout = null;
  let mockInterval = null;

  function updateStatus(status) {
    if (onStatusChange) {
      onStatusChange(status);
    }
  }

  // Mock SSE generator for dev/offline mode
  if (USE_MOCKS) {
    updateStatus('connecting');
    const timer = setTimeout(() => {
      if (isClosed) return;
      updateStatus('connected');

      if (endpoint.includes('/events')) {
        // Order timeline stages simulation: COMMITTED -> OUTBOX_PUBLISHED -> NOTIFIED -> INDEXED
        const stages = [
          { stage: 'COMMITTED', delay: 400, detail: {} },
          { stage: 'OUTBOX_PUBLISHED', delay: 1200, detail: {} },
          { stage: 'NOTIFIED', delay: 2000, detail: { channel: 'SIMULATED_EMAIL' } },
          { stage: 'INDEXED', delay: 2800, detail: { productId: 'item-1' } },
        ];

        stages.forEach(({ stage, delay, detail }) => {
          setTimeout(() => {
            if (isClosed) return;
            const payload = {
              stage,
              at: new Date().toISOString(),
              detail,
            };
            if (onMessage) onMessage(payload, 'stage');
          }, delay);
        });
      } else if (endpoint.includes('/xray/stream')) {
        // Stream periodic xray metrics
        mockInterval = setInterval(() => {
          if (isClosed) return;
          try {
            if (onMessage) onMessage(mockXRayBundle(), 'metrics');
          } catch (e) {
            // ignore
          }
        }, 1000);
      }
    }, 200);

    return () => {
      isClosed = true;
      clearTimeout(timer);
      if (mockInterval) clearInterval(mockInterval);
      updateStatus('closed');
    };
  }

  // Real SSE connection
  function connect() {
    if (isClosed) return;

    updateStatus(reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    const fullUrl = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    try {
      eventSource = new EventSource(fullUrl);

      eventSource.onopen = () => {
        reconnectAttempts = 0;
        updateStatus('connected');
      };

      // Listen to generic messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'message');
        } catch (e) {
          if (onMessage) onMessage(event.data, 'message');
        }
      };

      // Listen to custom named events: 'stage' and 'metrics'
      eventSource.addEventListener('stage', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'stage');
        } catch (e) {
          if (onMessage) onMessage(event.data, 'stage');
        }
      });

      eventSource.addEventListener('metrics', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'metrics');
        } catch (e) {
          if (onMessage) onMessage(event.data, 'metrics');
        }
      });

      eventSource.onerror = (err) => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }

        if (isClosed) return;

        if (onError) onError(err);

        // Exponential backoff with jitter: 1s, 2s, 4s, capped at 10s
        reconnectAttempts++;
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
        const jitter = Math.floor(Math.random() * 500);
        const waitMs = backoffMs + jitter;

        updateStatus('reconnecting');
        reconnectTimeout = setTimeout(connect, waitMs);
      };
    } catch (err) {
      if (onError) onError(err);
      reconnectAttempts++;
      const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
      reconnectTimeout = setTimeout(connect, backoffMs);
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    updateStatus('closed');
  };
}
