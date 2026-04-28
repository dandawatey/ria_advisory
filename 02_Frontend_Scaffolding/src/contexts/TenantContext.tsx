import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Tenant } from '../types';
import { useAuth } from './AuthContext';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

interface TenantContextValue {
  tenant: Tenant | null;
  tenants: Tenant[];
  activeTenantId: string | null;
  switchTenant: (id: string) => void;
  refetch: () => void;
}

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, token, isAuthenticated } = useAuth();
  const [tenants, setTenants]           = useState<Tenant[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const fetchTenants = async () => {
    if (!token || !isAuthenticated) return;
    try {
      if (user?.role === 'superadmin') {
        const res = await fetch(`${BASE}/api/tenants`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setTenants(await res.json());
      } else if (user?.tenant_id) {
        const res = await fetch(`${BASE}/api/tenants/${user.tenant_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setTenants([await res.json()]);
      }
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenants();
      setActiveTenantId(user?.tenant_id ?? null);
    } else {
      setTenants([]);
      setActiveTenantId(null);
    }
  }, [isAuthenticated, user?.tenant_id]);

  const tenant = tenants.find((t) => t.id === activeTenantId) ?? null;

  return (
    <TenantContext.Provider value={{
      tenant, tenants, activeTenantId,
      switchTenant: setActiveTenantId,
      refetch: fetchTenants,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used inside TenantProvider');
  return ctx;
}
