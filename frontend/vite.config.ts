import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),   // Tailwind v4 — no tailwind.config.ts needed
	],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		port: 5173,
		// Proxy API calls to Rust backend — avoids CORS in dev
		proxy: {
			'/api': {
				target: 'http://localhost:8000',
				changeOrigin: true,
			},
		},
	},
	build: {
		outDir: 'dist',
		sourcemap: true,
		// Split large chunks for better caching
		rollupOptions: {
			output: {
				manualChunks: {
					'react-vendor': ['react', 'react-dom'],
					'router': ['react-router-dom'],
					'query': ['@tanstack/react-query'],
					'ui': ['lucide-react'],
				},
			},
		},
	},
})
