import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';

interface Props {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export function ProtectedRoute({ children, requiredRole }: Props) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', fontSize: 14, color: 'var(--color-text-muted)',
      }}>
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Superadmin must stay within /admin/* — no access to financial dashboards
  if (user?.role === 'superadmin' && !location.pathname.startsWith('/admin')) {
    return <Navigate to="/admin/hub" replace />;
  }

  if (requiredRole) {
    const roleOrder: UserRole[] = ['viewer', 'finance_user', 'isource_admin', 'ria_admin', 'superadmin'];
    const userLevel     = roleOrder.indexOf(user?.role ?? 'viewer');
    const requiredLevel = roleOrder.indexOf(requiredRole);
    if (userLevel < requiredLevel) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
}
