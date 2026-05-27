import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Goals from './pages/Goals';
import Reports from './pages/Reports';
import Stocks from './pages/Stocks';
import Telegram from './pages/Telegram';
import ForgotPassword from './pages/ForgotPassword';

function PrivateRoute({ children }) {
  const { signed, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-500"></div>
          <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!signed) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { signed, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-emerald-50 dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-[3px] border-emerald-200 border-t-emerald-600 dark:border-emerald-900 dark:border-t-emerald-500"></div>
          <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">Carregando...</span>
        </div>
      </div>
    );
  }

  if (signed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            className: '',
            style: {
              borderRadius: '12px',
              padding: '14px 20px',
              fontSize: '14px',
              fontWeight: '500',
              boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
              background: 'var(--toast-bg, #fff)',
              color: 'var(--toast-color, #1f2937)',
            },
            success: {
              iconTheme: { primary: '#059669', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#dc2626', secondary: '#fff' },
            },
          }}
        />
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/transactions" element={<PrivateRoute><Transactions /></PrivateRoute>} />
          <Route path="/goals" element={<PrivateRoute><Goals /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
          <Route path="/stocks" element={<PrivateRoute><Stocks /></PrivateRoute>} />
          <Route path="/telegram" element={<PrivateRoute><Telegram /></PrivateRoute>} />
          <Route path="/whatsapp" element={<Navigate to="/telegram" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
