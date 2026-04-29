/**
 * F051 — New Tenant Creation Form
 * Full-page form, blank sidebar (no navigation).
 * Superadmin only.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { post } from '../api/client';
import { Tenant } from '../types';

const PLANS = ['trial', 'starter', 'professional', 'enterprise'];

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface FormState {
  // Basic
  name:            string;
  slug:            string;
  plan:            string;
  // Branding
  display_name:    string;
  primary_color:   string;
  secondary_color: string;
  logo_url:        string;
  support_email:   string;
  // Billing
  max_users:       string;
  max_subsidiaries: string;
  billing_email:   string;
  renewal_date:    string;
  // First admin user
  admin_email:     string;
  admin_name:      string;
  admin_password:  string;
}

const empty = (): FormState => ({
  name: '', slug: '', plan: 'trial',
  display_name: '', primary_color: '#0F3F3C', secondary_color: '#E8443B',
  logo_url: '', support_email: '',
  max_users: '50', max_subsidiaries: '17', billing_email: '', renewal_date: '',
  admin_email: '', admin_name: '', admin_password: '',
});

// ── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '10px 13px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: 14, background: '#fff',
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 13, fontWeight: 600,
  color: '#374151', marginBottom: 6,
};

const sectionStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 12,
  border: '1px solid #e5e7eb',
  padding: '28px 32px', marginBottom: 20,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 800, color: '#111',
  marginBottom: 4,
};

const sectionSub: React.CSSProperties = {
  fontSize: 12, color: '#9ca3af', marginBottom: 24,
};

const grid2: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18,
};

// ── Component ──────────────────────────────────────────────────────────────

export default function NewTenant() {
  const navigate          = useNavigate();
  const [form, setForm]   = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) { setError('Organisation name is required'); return; }
    if (!form.slug.trim()) { setError('Slug is required'); return; }

    setSaving(true);
    try {
      // 1. Create tenant
      const tenant = await post<Tenant>('/api/tenants', {
        name: form.name.trim(),
        slug: form.slug.trim(),
        plan: form.plan,
      });

      // 2. Save branding + billing config
      const branding = {
        display_name:    form.display_name || form.name,
        primary_color:   form.primary_color,
        secondary_color: form.secondary_color,
        logo_url:        form.logo_url,
        support_email:   form.support_email,
      };
      const billing = {
        contact_email:    form.billing_email,
        max_users:        parseInt(form.max_users) || 50,
        max_subsidiaries: parseInt(form.max_subsidiaries) || 17,
        renewal_date:     form.renewal_date,
        auto_renew:       true,
      };
      await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api/tenants/${tenant.id}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('ria_token')}`,
        },
        body: JSON.stringify({ branding, billing }),
      });

      // 3. Optionally create first admin user
      if (form.admin_email && form.admin_password) {
        await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('ria_token')}`,
          },
          body: JSON.stringify({
            email:        form.admin_email,
            display_name: form.admin_name || form.admin_email.split('@')[0],
            password:     form.admin_password,
            tenant_id:    tenant.id,
            role:         'ria_admin',
          }),
        });
      }

      // Done — go to hub or tenant detail
      navigate('/admin/hub');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create tenant');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '36px 28px' }}>

      {/* Page header */}
      <div style={{ marginBottom: 32 }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{
            padding: '5px 12px', border: '1px solid #e5e7eb', borderRadius: 7,
            background: '#fff', fontSize: 12, color: '#6b7280',
            cursor: 'pointer', marginBottom: 16,
          }}
        >
          ← Back
        </button>
        <div style={{
          display: 'inline-block', marginBottom: 10, marginLeft: 12,
          fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
          color: 'var(--teal-600, #1F6B66)', background: 'var(--teal-50, #f0faf9)',
          padding: '3px 12px', borderRadius: 999,
        }}>
          Platform Administration
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>
          Create New Tenant
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#6b7280' }}>
          Set up a new organisation on the i-CFO360 platform
        </p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, fontSize: 13, color: '#dc2626', marginBottom: 20,
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>

        {/* ── Section 1: Basic Info ── */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Organisation Details</div>
          <div style={sectionSub}>Core identity of the tenant on this platform</div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Organisation Name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Acme Corporation"
              value={form.name}
              onChange={(e) => setForm((f) => ({
                ...f,
                name: e.target.value,
                slug: slugify(e.target.value),
                display_name: f.display_name || e.target.value,
              }))}
              required
            />
          </div>

          <div style={grid2}>
            <div>
              <label style={labelStyle}>URL Slug *</label>
              <input
                style={{ ...inputStyle, fontFamily: 'monospace' }}
                placeholder="acme-corporation"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                required
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                Auto-generated · lowercase, hyphens only
              </div>
            </div>
            <div>
              <label style={labelStyle}>Subscription Plan</label>
              <select style={{ ...inputStyle }} value={form.plan} onChange={set('plan')}>
                {PLANS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ── Section 2: Branding ── */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Branding</div>
          <div style={sectionSub}>How this organisation appears across the platform</div>

          <div style={grid2}>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} placeholder="Acme Corporation"
                value={form.display_name} onChange={set('display_name')} />
            </div>
            <div>
              <label style={labelStyle}>Support Email</label>
              <input style={inputStyle} type="email" placeholder="support@acme.com"
                value={form.support_email} onChange={set('support_email')} />
            </div>
            <div>
              <label style={labelStyle}>Primary Colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.primary_color}
                  onChange={set('primary_color')}
                  style={{ width: 40, height: 38, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.primary_color}
                  onChange={set('primary_color')} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Secondary Colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.secondary_color}
                  onChange={set('secondary_color')}
                  style={{ width: 40, height: 38, border: 'none', cursor: 'pointer', borderRadius: 6, padding: 2 }} />
                <input style={{ ...inputStyle, flex: 1 }} value={form.secondary_color}
                  onChange={set('secondary_color')} />
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <label style={labelStyle}>Logo URL</label>
            <input style={inputStyle} placeholder="https://cdn.acme.com/logo.png"
              value={form.logo_url} onChange={set('logo_url')} />
          </div>
        </div>

        {/* ── Section 3: Billing ── */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>Plan & Billing</div>
          <div style={sectionSub}>Usage limits and billing contact for this organisation</div>

          <div style={grid2}>
            <div>
              <label style={labelStyle}>Billing Contact Email</label>
              <input style={inputStyle} type="email" placeholder="billing@acme.com"
                value={form.billing_email} onChange={set('billing_email')} />
            </div>
            <div>
              <label style={labelStyle}>Renewal Date</label>
              <input style={inputStyle} type="date"
                value={form.renewal_date} onChange={set('renewal_date')} />
            </div>
            <div>
              <label style={labelStyle}>Max Users</label>
              <input style={inputStyle} type="number" min={1}
                value={form.max_users} onChange={set('max_users')} />
            </div>
            <div>
              <label style={labelStyle}>Max Subsidiaries</label>
              <input style={inputStyle} type="number" min={1} max={17}
                value={form.max_subsidiaries} onChange={set('max_subsidiaries')} />
            </div>
          </div>
        </div>

        {/* ── Section 4: First Admin User ── */}
        <div style={sectionStyle}>
          <div style={sectionTitle}>First Admin User <span style={{ fontSize: 12, fontWeight: 400, color: '#9ca3af' }}>(optional)</span></div>
          <div style={sectionSub}>Create an initial admin account for this tenant — skip to invite later</div>

          <div style={grid2}>
            <div>
              <label style={labelStyle}>Admin Email</label>
              <input style={inputStyle} type="email" placeholder="admin@acme.com"
                value={form.admin_email} onChange={set('admin_email')} />
            </div>
            <div>
              <label style={labelStyle}>Display Name</label>
              <input style={inputStyle} placeholder="Acme Admin"
                value={form.admin_name} onChange={set('admin_name')} />
            </div>
            <div>
              <label style={labelStyle}>Password</label>
              <input style={inputStyle} type="password" placeholder="Min. 8 characters"
                value={form.admin_password} onChange={set('admin_password')} />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{
          display: 'flex', gap: 12, justifyContent: 'flex-end',
          paddingTop: 8,
        }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              padding: '11px 24px', border: '1px solid #d1d5db', borderRadius: 9,
              background: '#fff', fontSize: 14, fontWeight: 600,
              color: '#374151', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '11px 32px', border: 'none', borderRadius: 9,
              background: saving ? '#9ca3af' : 'var(--teal-700, #0F3F3C)',
              color: '#fff', fontSize: 14, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 2px 8px rgba(15,63,60,.25)',
            }}
          >
            {saving ? 'Creating…' : 'Create Tenant'}
          </button>
        </div>

      </form>
    </div>
  );
}
