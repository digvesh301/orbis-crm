import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Globe, ArrowRight, Loader2 } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { APP_CONFIG } from '@/lib/constants'
import './auth.css'

interface LoginResponse {
  success: boolean
  data: {
    access_token: string
    refresh_token: string
    expires_in: number
    user: {
      id: string
      first_name: string
      last_name?: string
      email: string
      org_id: string
      org_name: string
      avatar_url?: string
      is_email_verified: boolean
    }
  }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({ email: '', password: '' })

  const loginMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await api.post<LoginResponse>('/auth/login', data)
      return res.data
    },
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.access_token, data.data.refresh_token)
      toast.success(`Welcome back, ${data.data.user.first_name}! 👋`)
      navigate('/dashboard')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    loginMutation.mutate(form)
  }

  return (
    <div className="auth-layout">
      {/* ─── Left Panel — Brand ─────────────────────────── */}
      <div className="auth-left">
        <div className="auth-left-content">
          {/* Logo */}
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <Globe size={28} strokeWidth={1.5} />
            </div>
            <span className="auth-logo-text">{APP_CONFIG.name}</span>
          </div>

          {/* Headline */}
          <div className="auth-headline">
            <h1>Everything your team needs. In one place.</h1>
            <p>Manage contacts, pipeline, emails, and support — all in a single, beautiful platform.</p>
          </div>

          {/* Feature list */}
          <ul className="auth-features">
            {[
              'Contacts & Accounts',
              'Sales Pipeline & Deals',
              'Email with Open Tracking',
              'Support Tickets & SLA',
              'Custom Modules & Fields',
              'Reports & Analytics',
            ].map((f) => (
              <li key={f}>
                <span className="auth-feature-dot" />
                {f}
              </li>
            ))}
          </ul>

          {/* Social proof */}
          <div className="auth-social-proof">
            <div className="auth-avatars">
              {['A', 'R', 'S', 'M', 'K'].map((l, i) => (
                <div key={i} className="auth-avatar" style={{ left: i * 24 }}>
                  {l}
                </div>
              ))}
            </div>
            <span>Trusted by 500+ teams worldwide</span>
          </div>
        </div>

        {/* Background decoration */}
        <div className="auth-left-bg">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-grid-lines" />
        </div>
      </div>

      {/* ─── Right Panel — Form ─────────────────────────── */}
      <div className="auth-right">
        <div className="auth-form-container">
          {/* Header */}
          <div className="auth-form-header">
            <h2>Welcome back</h2>
            <p>Sign in to your {APP_CONFIG.name} account</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>

            <div className="auth-field">
              <div className="auth-field-header">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="auth-link-small">
                  Forgot password?
                </Link>
              </div>
              <div className="auth-input-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="auth-eye-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 size={16} className="auth-spinner" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Sign up link */}
          <p className="auth-switch">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create one free →
            </Link>
          </p>

          {/* Footer */}
          <p className="auth-footer-note">
            By signing in, you agree to our{' '}
            <a href="#" className="auth-link-small">Terms</a> and{' '}
            <a href="#" className="auth-link-small">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
