import { API_BASE } from './client.js';
import { mockXRayBundle } from './mock.js';

const USE_MOCKS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCKS !== undefined)
  ? import.meta.env.VITE_USE_MOCKS === 'true'
  : false;

/**
 * Hardened EventSource helper with auto-reconnect, exponential backoff (1s - 30s),
 * connection status propagation, and graceful unmount cleanup.
 *
 * @param {string} endpoint - Path, e.g. '/orders/:id/events' or '/xray/stream'
 * @param {object} callbacks
 * @param {function} callbacks.onMessage - Called with parsed data and event type
 * @param {function} callbacks.onStatusChange - Called with 'connecting' | 'connected' | 'reconnecting' | 'closed' | 'error'
 * @param {function} callbacks.onError - Called with error details
 * @returns {function} unsubscribe function
 */
export function subscribeSSE(endpoint, callbacks = {}) {
  const {
    onMessage,
    onStatusChange,
    onError,
  } = callbacks;

  let eventSource = null;
  let isClosed = false;
  let reconnectAttempts = 0;
  let reconnectTimeout = null;
  let mockInterval = null;

  function updateStatus(status) {
    if (onStatusChange && !isClosed) {
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
        const isDuplicateSimulation = endpoint.includes('replayed') || endpoint.includes('dup');
        const stages = [
          { stage: 'COMMITTED', delay: 400, detail: {} },
          { stage: 'OUTBOX_PUBLISHED', delay: 1200, detail: {} },
          ...(isDuplicateSimulation
            ? [{ stage: 'DUPLICATE_SKIPPED', delay: 1600, detail: { eventId: 'evt-dup-9001', consumerGroup: 'notifications' } }]
            : []),
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
        mockInterval = setInterval(() => {
          if (isClosed) return;
          try {
            if (onMessage) onMessage(mockXRayBundle(), 'metrics');
          } catch (e) {}
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
      eventSource = new EventSource(fullUrl, { withCredentials: true });

      eventSource.onopen = () => {
        if (isClosed) {
          eventSource.close();
          return;
        }
        reconnectAttempts = 0;
        updateStatus('connected');
      };

      // Generic message listener
      eventSource.onmessage = (event) => {
        if (isClosed) return;
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'message');
        } catch {
          if (onMessage) onMessage(event.data, 'message');
        }
      };

      // Custom event listener: 'stage'
      eventSource.addEventListener('stage', (event) => {
        if (isClosed) return;
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'stage');
        } catch {
          if (onMessage) onMessage(event.data, 'stage');
        }
      });

      // Custom event listener: 'metrics'
      eventSource.addEventListener('metrics', (event) => {
        if (isClosed) return;
        try {
          const data = JSON.parse(event.data);
          if (onMessage) onMessage(data, 'metrics');
        } catch {
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

        // Exponential backoff: 1s, 2s, 4s, 8s, up to 30s + small jitter
        reconnectAttempts++;
        const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
        const jitter = Math.floor(Math.random() * 500);
        const waitMs = backoffMs + jitter;

        updateStatus('reconnecting');
        reconnectTimeout = setTimeout(connect, waitMs);
      };
    } catch (err) {
      if (onError && !isClosed) onError(err);
      if (isClosed) return;

      reconnectAttempts++;
      const backoffMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
      reconnectTimeout = setTimeout(connect, backoffMs);
    }
  }

  connect();

  return () => {
    isClosed = true;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    updateStatus('closed');
  };
}
