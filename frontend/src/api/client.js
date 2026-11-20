import { handleMockRequest } from './mock.js';

const USE_MOCKS = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCKS !== undefined)
  ? import.meta.env.VITE_USE_MOCKS === 'true'
  : true;

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE)
  ? import.meta.env.VITE_API_BASE
  : 'http://localhost:4000/api';

// Derived root URL for /health which is NOT under /api
const ROOT_URL = API_BASE.replace(/\/api\/?$/, '');

export class ApiError extends Error {
  constructor(code, message, details = {}, status = 500) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.message = message || code;
    this.details = details || {};
    this.status = status;
  }
}

// Active customer ID managed by AppContext
let activeCustomerId = null;

export function setActiveCustomerId(id) {
  activeCustomerId = id;
}

export function getActiveCustomerId() {
  return activeCustomerId;
}

/**
 * Universal fetch wrapper for SmartMart API.
 * Injects X-Customer-Id for cart & checkout endpoints.
 * Handles Idempotency-Key for checkout retries.
 * Maps { error: { code, message, details } } to ApiError.
 */
export async function apiClient(endpoint, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    idempotencyKey,
    params,
    signal,
    isRoot = false,
  } = options;

  // Build query string if params present
  let path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, val);
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      path += (path.includes('?') ? '&' : '?') + qs;
    }
  }

  // If mocks enabled, intercept before network
  if (USE_MOCKS) {
    return handleMockRequest(path, {
      method,
      headers: {
        'x-customer-id': activeCustomerId,
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
        ...headers,
      },
      body,
    });
  }

  // Construct request headers
  const reqHeaders = {
    'Accept': 'application/json',
    ...headers,
  };

  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  // Inject X-Customer-Id on cart / checkout if available
  if (activeCustomerId && (path.startsWith('/cart') || path.startsWith('/checkout'))) {
    reqHeaders['X-Customer-Id'] = activeCustomerId;
  }

  // Inject Idempotency-Key if provided
  if (idempotencyKey) {
    reqHeaders['Idempotency-Key'] = idempotencyKey;
  }

  const baseUrl = isRoot ? ROOT_URL : API_BASE;
  const fullUrl = `${baseUrl}${path}`;

  let response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (netErr) {
    throw new ApiError('NETWORK_ERROR', netErr.message || 'Network connection failed', {}, 0);
  }

  // Handle empty responses (like 204)
  if (response.status === 204) {
    return null;
  }

  let data;
  try {
    data = await response.json();
  } catch (jsonErr) {
    if (!response.ok) {
      throw new ApiError(
        'HTTP_ERROR',
        `Server returned ${response.status} ${response.statusText}`,
        {},
        response.status
      );
    }
    return null;
  }

  if (!response.ok) {
    const errObj = data?.error || {};
    throw new ApiError(
      errObj.code || `HTTP_${response.status}`,
      errObj.message || response.statusText,
      errObj.details || {},
      response.status
    );
  }

  return data;
}

// Convenience methods
export const apiGet = (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'GET' });
export const apiPost = (endpoint, body, options = {}) => apiClient(endpoint, { ...options, method: 'POST', body });
export const apiPatch = (endpoint, body, options = {}) => apiClient(endpoint, { ...options, method: 'PATCH', body });
export const apiDelete = (endpoint, options = {}) => apiClient(endpoint, { ...options, method: 'DELETE' });

// Health endpoint at ROOT
export const checkHealth = () => apiClient('/health', { isRoot: true });
