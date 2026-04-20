import { lazy, Suspense } from 'react'
import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/auth/LoginPage'
import { Layout } from './components/Layout'
import FullScreenLoader from './components/ui/FullScreenLoader'
import './index.css'

const SuppliersPage = lazy(() => import('./pages/suppliers/SuppliersPage'))
const SupplierFormPage = lazy(() => import('./pages/suppliers/SupplierFormPage'))
const SalesPage = lazy(() => import('./pages/sales/SalesPage'))
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'))
const UsersPage = lazy(() => import('./pages/users/UsersPage'))

const HomeRedirect = () => {
  const token = useAuthStore((state) => state.token)
  return <Navigate to={token ? '/dashboard' : '/login'} replace />
}

const PublicRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token)
  if (token) return <Navigate to="/dashboard" replace />
  return children
}

const ProtectedRoute = ({ children }) => {
  const token = useAuthStore((state) => state.token)
  if (!token) return <Navigate to="/login" replace />
  return children
}

const AdminRoute = ({ children }) => {
  const user = useAuthStore((state) => state.user)
  const token = useAuthStore((state) => state.token)
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

function App() {
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
            <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
