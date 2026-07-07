// SPDX-License-Identifier: AGPL-3.0-only
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ui/ lives inside the kernel repo (Q-D3). The fixture is imported from the
// repo root, one level above the Vite root, so allow it explicitly.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: ['..'] },
  },
})
