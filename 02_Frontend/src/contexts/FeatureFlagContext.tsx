import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const TOKEN_KEY = 'ria_token';

// i-Source staff see all features regardless of tenant flag state
const BYPASS_ROLES = new Set(['superadmin', 'isource_admin']);

export interface FeatureFlag {
  flag_key:    string;
  label:       string;
  description: string | null;
  is_enabled:  boolean;
  phase:       string;
  category:    string;
}

interface FeatureFlagContextValue {
  flags:      FeatureFlag[];
  isEnabled:  (key: string) => boolean;
  toggleFlag: (key: string, enabled: boolean) => Promise<void>;
  isLoading:  boolean;
  refresh:    () => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextValue | null>(null);

// Phase 1 in-memory fallback when backend is unreachable
const PHASE1_DEFAULTS = new Set([
  'page_collections',
  'page_ar_aging',
  'page_revenue',
  'page_ubr',
  'page_invoicing',
  'page_settings',
  'page_bc_tenants',
  'page_api_status',
]);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const { user }          = useAuth();
  const { activeTenantId } = useTenant();

  const isBypass = BYPASS_ROLES.has(user?.role ?? '');

  const [flags, setFlags]       = useState<FeatureFlag[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Bypass roles: skip fetch — isEnabled always returns true anyway
    if (isBypass) { setLoading(false); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      let url: string;

      if (token && activeTenantId) {
        // Authenticated + tenant known → fetch per-tenant merged flags
        url = `${BASE}/api/tenants/${activeTenantId}/feature-flags`;
      } else if (token) {
        // Authenticated but no tenant yet → global defaults
        url = `${BASE}/api/feature-flags`;
      } else {
        // Not logged in → public global defaults
        url = `${BASE}/api/feature-flags/public`;
      }

      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const res = await fetch(url, { headers });
      if (res.ok) {
        setFlags(await res.json());
      } else {
        setFlags([]);
      }
    } catch {
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, [isBypass, activeTenantId]);

  // Reload whenever tenant changes or login state changes
  useEffect(() => { load(); }, [load]);

  const isEnabled = useCallback(
    (key: string): boolean => {
      // i-Source staff always see everything
      if (isBypass) return true;
      if (flags.length === 0) {
        // Backend unreachable — fall back to Phase 1 defaults
        return PHASE1_DEFAULTS.has(key);
      }
      const flag = flags.find((f) => f.flag_key === key);
      // Keys not in the table (system pages) → always allowed
      return flag ? flag.is_enabled : true;
    },
    [flags, isBypass],
  );

  const toggleFlag = useCallback(async (key: string, enabled: boolean) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Not authenticated');

    // Always write to the tenant-scoped endpoint when tenant is known
    const url = activeTenantId
      ? `${BASE}/api/tenants/${activeTenantId}/feature-flags/${key}`
      : `${BASE}/api/feature-flags/${key}`;

    const res = await fetch(url, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ is_enabled: enabled }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { detail?: string }).detail ?? 'Toggle failed');
    }
    setFlags((prev) =>
      prev.map((f) => (f.flag_key === key ? { ...f, is_enabled: enabled } : f)),
    );
  }, [activeTenantId]);

  return (
    <FeatureFlagContext.Provider value={{
      flags,
      isEnabled,
      toggleFlag,
      isLoading: isBypass ? false : isLoading,
      refresh: load,
    }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlagContextValue {
  const ctx = useContext(FeatureFlagContext);
  if (!ctx) throw new Error('useFeatureFlags must be used inside FeatureFlagProvider');
  return ctx;
}
