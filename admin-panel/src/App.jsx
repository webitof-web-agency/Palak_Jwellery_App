import { lazy, Suspense } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/auth/LoginPage'
import { Layout } from './components/Layout'
import FullScreenLoader from './components/ui/FullScreenLoader'
import BackendFallbackPage from './components/system/BackendFallbackPage'
import NotFoundPage from './components/system/NotFoundPage'
import { useBackendBootStatus } from './hooks/useBackendBootStatus'
import './index.css'

const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'))
const SupplierFormPage = lazy(() => import('./pages/suppliers/SupplierFormPage'))
const SalesPage = lazy(() => import('./pages/sales/SalesPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))
const ExceptionsPage = lazy(
  () => import('./pages/settlement-workflow/ExceptionsPage'),
)
const ExceptionDetailPage = lazy(
  () => import('./pages/settlement-workflow/ExceptionDetailPage'),
)
const SettlementReportsPage = lazy(
  () => import('./pages/settlement-workflow/SettlementReportsPage'),
)
const BusinessSettingsPage = lazy(
  () => import('./pages/business/BusinessSettingsPage'),
)

const HomeRedirect = () => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  if (token && user?.role !== 'admin') {
    clearAuth()
    return <Navigate to="/login" replace />
  }

  return <Navigate to={token ? '/dashboard' : '/login'} replace />
}

const PublicRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  if (token && user?.role !== 'admin') {
    clearAuth()
    return <Navigate to="/login" replace />
  }

  if (token) return <Navigate to="/dashboard" replace />
  return children
}

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') {
    clearAuth()
    return <Navigate to="/login" replace />
  }
  return children
}

const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  const clearAuth = useAuthStore((state) => state.clearAuth)

  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') {
    clearAuth()
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  const { status, error, retry } = useBackendBootStatus()

  if (status === 'checking') {
    return <FullScreenLoader label="Checking backend status" />
  }

  if (status === 'unavailable') {
    return <BackendFallbackPage error={error} onRetry={retry} />
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<FullScreenLoader />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />

          {/* Public Routes */}
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          {/* Protected Authenticated Routes with Sidebar */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/form" element={<SupplierFormPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/settlement-reports" element={<SettlementReportsPage />} />
            <Route
              path="/business-settings"
              element={
                <AdminRoute>
                  <BusinessSettingsPage />
                </AdminRoute>
              }
            />
            <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
            <Route
              path="/legacy-settlement-workflow"
              element={
                <AdminRoute>
                  <Navigate to="/exceptions" replace />
                </AdminRoute>
              }
            />
            <Route
              path="/legacy-settlement-workflow/review"
              element={
                <AdminRoute>
                  <Navigate to="/exceptions" replace />
                </AdminRoute>
              }
            />
            <Route
              path="/exceptions"
              element={
                <AdminRoute>
                  <ExceptionsPage />
                </AdminRoute>
              }
            />
            <Route
              path="/exceptions/:id"
              element={
                <AdminRoute>
                  <ExceptionDetailPage />
                </AdminRoute>
              }
            />
            <Route
              path="/legacy-settlement-workflow/ingestions/:id"
              element={
                <AdminRoute>
                  <ExceptionDetailPage />
                </AdminRoute>
              }
            />
            <Route
              path="/legacy-settlement-workflow/reports"
              element={
                <AdminRoute>
                  <Navigate to="/settlement-reports" replace />
                </AdminRoute>
              }
            />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
