/**
 * APP CONFIG — Single source of truth for the application name and branding.
 *
 * ✅ To rename "Orbis" to anything else:
 *    1. Change VITE_APP_NAME in frontend/.env
 *    2. Done — every component uses this constant
 */
export const APP_CONFIG = {
	name: import.meta.env.VITE_APP_NAME || 'Orbis',
	tagline: 'World-class CRM Platform',
	description: 'Manage contacts, deals, and teams — all in one place.',
	supportEmail: 'support@orbis.com',
	docsUrl: 'https://docs.orbis.com',
	version: '1.0.0',
} as const

/** API base URL — proxied to Rust backend in dev */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

/** Pagination defaults */
export const PAGINATION = {
	defaultPageSize: 25,
	pageSizeOptions: [10, 25, 50, 100],
	maxPageSize: 100,
} as const

/** File upload limits */
export const FILE_LIMITS = {
	maxSizeMb: 50,
	allowedTypes: [
		'image/jpeg', 'image/png', 'image/webp', 'image/gif',
		'application/pdf',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'application/vnd.ms-excel',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'text/csv',
	],
} as const

/** Token storage keys */
export const STORAGE_KEYS = {
	accessToken: 'orbis_access_token',
	refreshToken: 'orbis_refresh_token',
	currentOrg: 'orbis_current_org',
	theme: 'orbis_theme',
} as const

/** Query stale times (milliseconds) */
export const STALE_TIMES = {
	contactsList: 30_000,       // 30 seconds
	contactDetail: 60_000,      // 1 minute
	pipeline: 10_000,           // 10 seconds (changes frequently)
	userProfile: 300_000,       // 5 minutes
	permissions: 300_000,       // 5 minutes
	templates: 600_000,         // 10 minutes
	modules: 600_000,           // 10 minutes
} as const
