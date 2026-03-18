import { lazy, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

// ─── Lazy-loaded pages — each becomes a separate JS chunk ─────────────────────
// The browser downloads ONLY the current page's chunk, not all pages at once.
// This reduces initial JS load from ~300KB to ~50KB.
const LoginPage    = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))
const AppLayout    = lazy(() => import('./components/layout/AppLayout'))

const Dashboard    = lazy(() => import('./pages/dashboard/Dashboard'))
const ContactsList = lazy(() => import('./pages/contacts/ContactsList'))
const AccountsList = lazy(() => import('./pages/accounts/AccountsList'))
const LeadsList    = lazy(() => import('./pages/leads/LeadsList'))
const DealsList    = lazy(() => import('./pages/deals/DealsList'))
const PipelineBoard= lazy(() => import('./pages/pipeline/PipelineBoard'))
const AdminDashboard= lazy(() => import('./pages/admin/AdminDashboard'))
const ProductsList = lazy(() => import('./pages/products/ProductsList'))
const QuotesList   = lazy(() => import('./pages/quotes/QuotesList'))
const SettingsPage = lazy(() => import('./pages/settings/Settings'))

// ─── Placeholder pages for future days ───────────────────────────────────────
const ComingSoon = lazy(() => Promise.resolve({
  default: ({ page, day }: { page: string; day: string }) => (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh', fontFamily: 'Inter, sans-serif',
      background: '#f8fafc', gap: '12px'
    }}>
      <div style={{ fontSize: 48 }}>🌐</div>
      <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1e293b', margin: 0 }}>
        Orbis CRM
      </h1>
      <p style={{ color: '#64748b', margin: 0 }}>
        <strong>{page}</strong> — Coming Day {day}
      </p>
      <div style={{ marginTop: 16, padding: '8px 16px', background: '#6366f1', color: 'white', borderRadius: 8, fontSize: 13 }}>
        🚀 Phase 1 — Day 3 Auth Complete!
      </div>
    </div>
  )
}))

// ─── Page loading skeleton ────────────────────────────────────────────────────
// Shown while lazy chunk is downloading (usually <100ms on fast connection)
function PageSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#f8fafc',
    }}>
      <div style={{
        width: 32, height: 32, border: '3px solid #e2e8f0',
        borderTopColor: '#6366f1', borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── React Query Client ───────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60s stale time — data is considered fresh for 60s
      // → zero redundant API calls on quick navigation
      staleTime: 60_000,
      // Keep unused data in cache for 5 minutes
      gcTime: 300_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,         // don't re-fetch if data is still fresh
    },
    mutations: {
      retry: 0,
    },
  },
})

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Suspense catches lazy-loaded pages while their chunk downloads */}
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* ─── Auth ───────────────────────────────────── */}
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<RegisterPage />} />
            <Route path="/verify-email"    element={<ComingSoon page="Verify Email" day="3" />} />
            <Route path="/forgot-password" element={<ComingSoon page="Forgot Password" day="3" />} />
            <Route path="/reset-password"  element={<ComingSoon page="Reset Password" day="3" />} />

            {/* ─── Onboarding — Day 9 ─────────────────────── */}
            <Route path="/onboarding/*"    element={<ComingSoon page="Onboarding" day="9" />} />

            {/* ─── App — Day 10 ───────────────────────────── */}
            <Route element={<AppLayout />}>
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/contacts/*"      element={<ContactsList />} />
              <Route path="/accounts/*"      element={<AccountsList />} />
              <Route path="/products/*"      element={<ProductsList />} />
              <Route path="/quotes/*"        element={<QuotesList />} />
              <Route path="/leads/*"         element={<LeadsList />} />
              <Route path="/deals/*"         element={<DealsList />} />
              <Route path="/pipeline/*"      element={<PipelineBoard />} />
              <Route path="/admin/*"         element={<AdminDashboard />} />
              <Route path="/settings/*"      element={<SettingsPage />} />
            </Route>

            {/* ─── Default redirect ────────────────────────── */}
            <Route path="/"                element={<Navigate to="/dashboard" replace />} />
            <Route path="*"                element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
