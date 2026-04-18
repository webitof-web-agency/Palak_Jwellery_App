import { Navigate, Route, BrowserRouter, Routes, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/auth/LoginPage'
import SuppliersPage from './pages/suppliers/SuppliersPage'
import SalesPage from './pages/sales/SalesPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import UsersPage from './pages/users/UsersPage'
import { Layout } from './components/Layout'
import './index.css'

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
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
