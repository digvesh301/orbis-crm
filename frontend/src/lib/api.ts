import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { API_BASE_URL, STORAGE_KEYS } from './constants'

/**
 * Axios instance pre-configured for the Orbis API.
 * - Auto-attaches JWT Authorization header
 * - Auto-refreshes token on 401
 * - Consistent error shape
 */
export const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 30_000,
	headers: {
		'Content-Type': 'application/json',
		'Accept': 'application/json',
	},
	withCredentials: true,  // send cookies (refresh token in HttpOnly cookie)
})

// ─── Request Interceptor — Attach JWT ─────────────────────────────────────────
api.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		const token = localStorage.getItem(STORAGE_KEYS.accessToken)
		if (token && config.headers) {
			config.headers.Authorization = `Bearer ${token}`
		}
		return config
	},
	(error) => Promise.reject(error)
)

// ─── Response Interceptor — Handle errors + token refresh ────────────────────
let isRefreshing = false
let refreshQueue: Array<{
	resolve: (token: string) => void
	reject: (error: unknown) => void
}> = []

api.interceptors.response.use(
	// Success — pass through
	(response) => response,

	// Error — handle 401 with token refresh
	async (error: AxiosError) => {
		const originalRequest = error.config as InternalAxiosRequestConfig & {
			_retried?: boolean
		}

		// If 401 and we haven't retried yet — attempt token refresh
		if (error.response?.status === 401 && !originalRequest._retried) {
			originalRequest._retried = true

			if (isRefreshing) {
				// Queue this request until refresh completes
				return new Promise((resolve, reject) => {
					refreshQueue.push({
						resolve: (token) => {
							if (originalRequest.headers) {
								originalRequest.headers.Authorization = `Bearer ${token}`
							}
							resolve(api(originalRequest))
						},
						reject,
					})
				})
			}

			isRefreshing = true

			try {
				const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken)
				if (!refreshToken) throw new Error('No refresh token available')

				const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
					refresh_token: refreshToken
				}, {
					withCredentials: true,
				})

				const newToken = data.data.access_token
				const newRefreshToken = data.data.refresh_token || refreshToken // Keep old if not rotated 

				localStorage.setItem(STORAGE_KEYS.accessToken, newToken)
				if (data.data.refresh_token) {
					localStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken)
				}

				// Retry all queued requests with new token
				refreshQueue.forEach(({ resolve }) => resolve(newToken))
				refreshQueue = []

				if (originalRequest.headers) {
					originalRequest.headers.Authorization = `Bearer ${newToken}`
				}
				return api(originalRequest)
			} catch (refreshError) {
				// Refresh failed — clear auth and redirect to login
				refreshQueue.forEach(({ reject }) => reject(refreshError))
				refreshQueue = []

				localStorage.removeItem(STORAGE_KEYS.accessToken)
				localStorage.removeItem(STORAGE_KEYS.refreshToken)
				window.location.href = '/login'
				return Promise.reject(refreshError)
			} finally {
				isRefreshing = false
			}
		}

		return Promise.reject(error)
	}
)

// ─── Helper to extract error message from API response ────────────────────────
export function getApiErrorMessage(error: unknown): string {
	if (error instanceof AxiosError) {
		return (
			error.response?.data?.error?.message ||
			error.response?.data?.message ||
			error.message ||
			'Something went wrong'
		)
	}
	if (error instanceof Error) return error.message
	return 'Something went wrong'
}

export default api
