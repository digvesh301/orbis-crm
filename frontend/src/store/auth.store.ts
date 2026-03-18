import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { STORAGE_KEYS } from '@/lib/constants'

interface User {
	id: string
	first_name: string
	last_name?: string
	email: string
	org_id: string
	org_name: string
	avatar_url?: string
	is_email_verified: boolean
}

interface AuthState {
	user: User | null
	accessToken: string | null
	refreshToken: string | null
	isAuthenticated: boolean

	setAuth: (user: User, accessToken: string, refreshToken: string) => void
	setUser: (user: User) => void
	logout: () => void
}

export const useAuthStore = create<AuthState>()(
	persist(
		(set) => ({
			user: null,
			accessToken: null,
			refreshToken: null,
			isAuthenticated: false,

			setAuth: (user, accessToken, refreshToken) => {
				localStorage.setItem(STORAGE_KEYS.accessToken, accessToken)
				localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken)
				set({ user, accessToken, refreshToken, isAuthenticated: true })
			},

			setUser: (user) => set({ user }),

			logout: () => {
				localStorage.removeItem(STORAGE_KEYS.accessToken)
				localStorage.removeItem(STORAGE_KEYS.refreshToken)
				set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
			},
		}),
		{
			name: 'orbis-auth',
			partialize: (state) => ({
				user: state.user,
				isAuthenticated: state.isAuthenticated,
			}),
		}
	)
)
