import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Globe, ArrowRight, Loader2, Building2, User } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import api, { getApiErrorMessage } from '@/lib/api'
import { useAuthStore } from '@/store/auth.store'
import { APP_CONFIG } from '@/lib/constants'
import './auth.css'

interface RegisterResponse {
  success: boolean
  data: {
    access_token: string
    refresh_token: string
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

export default function RegisterPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    org_name: '',
  })

  const registerMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await api.post<RegisterResponse>('/auth/register', data)
      return res.data
    },
    onSuccess: (data) => {
      setAuth(data.data.user, data.data.access_token, data.data.refresh_token)
      toast.success(`Welcome to ${APP_CONFIG.name}! Your account is ready 🎉`)
      navigate('/onboarding')
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.first_name || !form.email || !form.password || !form.org_name) {
      toast.error('Please fill in all required fields')
      return
    }
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    registerMutation.mutate(form)
  }

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="auth-layout">
      {/* ─── Left Panel ─────────────────────────────────── */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <Globe size={28} strokeWidth={1.5} />
            </div>
            <span className="auth-logo-text">{APP_CONFIG.name}</span>
          </div>

          <div className="auth-headline">
            <h1>Start your free account. No credit card required.</h1>
            <p>Get up and running in minutes. Invite your team, customize modules, and close more deals.</p>
          </div>

          <div className="auth-steps">
            {[
              { step: '01', title: 'Create your account', desc: 'Takes less than 2 minutes' },
              { step: '02', title: 'Set up your workspace', desc: 'Add contacts, accounts & pipeline' },
              { step: '03', title: 'Invite your team', desc: 'Collaborate and sell together' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="auth-step">
                <div className="auth-step-num">{step}</div>
                <div>
                  <p className="auth-step-title">{title}</p>
                  <p className="auth-step-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-badge">
            🔒 Enterprise-grade security &nbsp;·&nbsp; 99.9% uptime SLA
          </div>
        </div>

        <div className="auth-left-bg">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />
          <div className="auth-grid-lines" />
        </div>
      </div>

      {/* ─── Right Panel ────────────────────────────────── */}
      <div className="auth-right">
        <div className="auth-form-container auth-form-container--wide">
          <div className="auth-form-header">
            <h2>Create your account</h2>
            <p>Start your free {APP_CONFIG.name} workspace today</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {/* Name row */}
            <div className="auth-row">
              <div className="auth-field">
                <label htmlFor="first_name">
                  <User size={13} /> First Name *
                </label>
                <input
                  id="first_name"
                  type="text"
                  placeholder="John"
                  value={form.first_name}
                  onChange={update('first_name')}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="last_name">Last Name</label>
                <input
                  id="last_name"
                  type="text"
                  placeholder="Doe"
                  value={form.last_name}
                  onChange={update('last_name')}
                />
              </div>
            </div>

            {/* Company */}
            <div className="auth-field">
              <label htmlFor="org_name">
                <Building2 size={13} /> Company / Organization Name *
              </label>
              <input
                id="org_name"
                type="text"
                placeholder="Acme Inc."
                value={form.org_name}
                onChange={update('org_name')}
                required
              />
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="reg_email">Work Email *</label>
              <input
                id="reg_email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                required
              />
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="reg_password">Password * <span className="auth-hint">(min. 8 characters)</span></label>
              <div className="auth-input-wrap">
                <input
                  id="reg_password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Choose a strong password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={update('password')}
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
              {/* Password strength bar */}
              {form.password && (
                <div className="auth-strength">
                  <div
                    className={`auth-strength-bar ${
                      form.password.length >= 12 ? 'strong' :
                      form.password.length >= 8 ? 'medium' : 'weak'
                    }`}
                    style={{
                      width: `${Math.min(100, (form.password.length / 12) * 100)}%`
                    }}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              className="auth-btn-primary"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 size={16} className="auth-spinner" />
                  Creating your workspace...
                </>
              ) : (
                <>
                  Create Free Account
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="auth-switch" style={{ marginTop: '20px' }}>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in →</Link>
          </p>

          <p className="auth-footer-note">
            By creating an account, you agree to our{' '}
            <a href="#" className="auth-link-small">Terms of Service</a> and{' '}
            <a href="#" className="auth-link-small">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  )
}
