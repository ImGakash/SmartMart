import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Production build guard per Section 2B: fail if VITE_USE_MOCKS is enabled in production
  if (mode === 'production' && env.VITE_USE_MOCKS === 'true') {
    throw new Error(
      'FATAL: PRODUCTION BUILD GUARD TRIGGERED!\n' +
      'VITE_USE_MOCKS cannot be set to "true" when building for production.\n' +
      'Ensure real API integration is enabled before building for cloud deployment.'
    );
  }

  return {
    plugins: [react()],
    server: {
      port: 5173,
      host: true
    }
  };
});
