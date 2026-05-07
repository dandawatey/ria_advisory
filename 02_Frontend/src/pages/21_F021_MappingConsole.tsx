/**
 * F021 — GL Mapping Console (v2)
 * Three-tab interface:
 *   Tab 1: GL Master & Mapping  — two-panel: GL codes (left) + canonical mapping panel (right)
 *   Tab 2: Canonical Hierarchy  — tree view of dim_canonical_account
 *   Tab 3: Coverage Stats       — /api/canonical/stats
 *
 * Account Groups (create/manage groups) lives in a sub-panel within Tab 1.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { get, post, put, del } from '../api/client';
import PageExplainer from '../components/common/PageExplainer';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GLAccount {
  gl_account_no:   string;
  gl_account_name: string | null;
  entity_count:    number;
  total_amount:    number;
  account_category?: string | null;
}

interface CanonicalAccount {
  canonical_id:    number;
  l1_statement:    string;
  l2_category:     string;
  l3_subcategory:  string | null;
  display_name:    string;
  sort_order:      number;
  is_active:       boolean;
}

interface AccountMapping {
  mapping_id:     number;
  source_erp:     string;
  source_account: string;
  source_name:    string | null;
  canonical_id:   number | null;
  l2_override:    string | null;
  mapped_by:      string;
  confidence:     number | null;
  notes:          string | null;
  l1_statement:   string | null;
  l2_category:    string | null;
  l3_subcategory: string | null;
  display_name:   string | null;
}

interface CanonicalStats {
  total:      number;
  mapped:     number;
  unmapped:   number;
  pct_mapped: number;
  by_l1:      Record<string, number>;
  by_erp:     Record<string, number>;
}

interface AccountGroup {
  group_id:     string;
  group_name:   string;
  description:  string | null;
  color:        string;
  sort_order:   number;
  member_count: number;
}

interface GroupMember {
  account_no:       string;
  account_name:     string | null;
  account_category: string | null;
  label_override:   string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${sign}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

function accountPrefix(no: string): string {
  if (no.startsWith('4')) return 'Revenue';
  if (no.startsWith('5')) return 'COGS';
  if (no.startsWith('6')) return 'OpEx';
  if (no.startsWith('7')) return 'Other Income';
  if (no.startsWith('8')) return 'Tax';
  if (no.startsWith('1')) return 'Assets';
  if (no.startsWith('2')) return 'Liabilities';
  if (no.startsWith('3')) return 'Equity';
  if (no === '999999')    return 'Suspense';
  return 'Other';
}

function l1Color(l1: string | null): string {
  if (l1 === 'P&L')            return '#059669';
  if (l1 === 'Balance Sheet')  return '#0369a1';
  if (l1 === 'Cash Flow')      return '#7c3aed';
  return '#6b7280';
}

function mappingDot(m: AccountMapping | undefined): { color: string; label: string } {
  if (!m || !m.canonical_id) return { color: '#ef4444', label: 'Unmapped' };
  if (m.mapped_by === 'user') return { color: '#059669', label: 'User-mapped' };
  return { color: '#3b82f6', label: 'Auto-mapped' };
}

const PRESET_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6',
];

const inp: React.CSSProperties = {
  background: '#fff', border: '1px solid #e5e7eb',
  borderRadius: 7, padding: '7px 11px', fontSize: 13,
  color: '#111', outline: 'none', width: '100%', boxSizing: 'border-box',
};

// ── Tab labels ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'mapping',   label: 'GL Master & Mapping' },
  { id: 'hierarchy', label: 'Canonical Hierarchy' },
  { id: 'stats',     label: 'Coverage Stats' },
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MappingConsole() {
  const [activeTab, setActiveTab] = useState<'mapping' | 'hierarchy' | 'stats'>('mapping');
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  return (
    <div style={{ fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#111', color: '#fff', padding: '10px 20px', borderRadius: 8,
          fontSize: 13, fontWeight: 600, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,.25)',
        }}>
          {toast}
        </div>
      )}

      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>
          GL Mapping Console
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          ERP-agnostic canonical account mapping · GL codes → P&amp;L / Balance Sheet / Cash Flow
        </p>
      </div>

      <PageExplainer
        icon="🗂️"
        title="What is the GL Mapping Console?"
        description="This page is the <strong>central workspace for mapping ERP GL account codes to the canonical 4-level chart of accounts</strong>. Finance controllers and data stewards use it to assign each raw BC account number to the appropriate L1 financial statement (P&L, Balance Sheet, Cash Flow), L2 category (Revenue, COGS, OpEx, etc.), and L3 subcategory. The Canonical Hierarchy tab shows the full standard account tree. The Coverage Stats tab shows how much of the GL is mapped vs. unmapped across all ERPs."
        concepts={[
          { icon: '●', color: '#059669', label: 'User-mapped', desc: 'Account manually mapped by a finance user — highest confidence' },
          { icon: '●', color: '#3b82f6', label: 'Auto-mapped', desc: 'Account mapped automatically by the system based on account prefix rules' },
          { icon: '●', color: '#ef4444', label: 'Unmapped', desc: 'Account not yet assigned to a canonical category — excluded from reports' },
        ]}
        glossary={[
          { term: 'Canonical Account', def: '4-level standard account hierarchy used across all subsidiaries for consolidated reporting' },
          { term: 'L1 / L2 / L3', def: 'Hierarchy levels: L1 = Financial Statement, L2 = Category, L3 = Subcategory' },
          { term: 'Account Group', def: 'Custom named grouping of GL accounts for custom report lines or analysis views' },
        ]}
      />

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid #e5e7eb', marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as typeof activeTab)}
            style={{
              padding: '9px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              background: activeTab === t.id ? '#fff' : 'transparent',
              color: activeTab === t.id ? '#111' : '#6b7280',
              borderBottom: activeTab === t.id ? '2px solid var(--teal-700, #0f3f3c)' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'mapping'   && <TabMapping   showToast={showToast} />}
      {activeTab === 'hierarchy' && <TabHierarchy showToast={showToast} />}
      {activeTab === 'stats'     && <TabStats     showToast={showToast} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 1: GL Master & Mapping
// ══════════════════════════════════════════════════════════════════════════════

function TabMapping({ showToast }: { showToast: (m: string) => void }) {
  // GL master
  const [accounts,    setAccounts]    = useState<GLAccount[]>([]);
  const [acctLoading, setAcctLoading] = useState(true);
  const [search,      setSearch]      = useState('');
  const [prefixFilter,setPrefixFilter]= useState<string>('All');

  // Canonical mappings
  const [mappings,     setMappings]    = useState<AccountMapping[]>([]);
  const [canonicals,   setCanonicals]  = useState<CanonicalAccount[]>([]);
  const [selectedAcct, setSelectedAcct]= useState<GLAccount | null>(null);
  const [editCanonId,  setEditCanonId] = useState<string>('');
  const [editNotes,    setEditNotes]   = useState('');
  const [saving,       setSaving]      = useState(false);

  // Account Groups
  const [groups,    setGroups]    = useState<AccountGroup[]>([]);
  const [grpLoading,setGrpLoading]= useState(true);
  const [activeGrp, setActiveGrp] = useState<AccountGroup | null>(null);
  const [members,   setMembers]   = useState<GroupMember[]>([]);
  const [memLoading,setMemLoading]= useState(false);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[0]);
  const [grpSaving, setGrpSaving] = useState(false);

  // Load all data in parallel
  useEffect(() => {
    api.gl.accounts()
      .then(setAccounts)
      .catch(() => {})
      .finally(() => setAcctLoading(false));

    get<AccountMapping[]>('/api/canonical/mappings')
      .then(setMappings)
      .catch(() => {});

    get<CanonicalAccount[]>('/api/canonical/accounts')
      .then(setCanonicals)
      .catch(() => {});
  }, []);

  const loadGroups = useCallback(() => {
    setGrpLoading(true);
    get<AccountGroup[]>('/api/gl/groups')
      .then(setGroups)
      .catch(() => {})
      .finally(() => setGrpLoading(false));
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Mapping index by source_account
  const mappingIndex = useMemo(() => {
    const idx: Record<string, AccountMapping> = {};
    mappings.forEach((m) => { idx[m.source_account] = m; });
    return idx;
  }, [mappings]);

  // Prefixes for filter chips
  const prefixes = useMemo(() => {
    const all = new Set(accounts.map((a) => accountPrefix(a.gl_account_no)));
    return ['All', ...Array.from(all).sort()];
  }, [accounts]);

  // Filtered GL master
  const filtered = useMemo(() => accounts.filter((a) => {
    const matchSearch = !search
      || a.gl_account_no.includes(search)
      || (a.gl_account_name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchPrefix = prefixFilter === 'All' || accountPrefix(a.gl_account_no) === prefixFilter;
    return matchSearch && matchPrefix;
  }), [accounts, search, prefixFilter]);

  // Member set
  const memberSet = useMemo(() => new Set(members.map((m) => m.account_no)), [members]);

  async function selectGroup(g: AccountGroup) {
    setActiveGrp(g);
    setMemLoading(true);
    try {
      const mem = await get<GroupMember[]>(`/api/gl/groups/${g.group_id}/members`);
      setMembers(mem);
    } catch { setMembers([]); }
    finally  { setMemLoading(false); }
  }

  function openMapping(a: GLAccount) {
    setSelectedAcct(a);
    const m = mappingIndex[a.gl_account_no];
    setEditCanonId(m?.canonical_id ? String(m.canonical_id) : '');
    setEditNotes(m?.notes ?? '');
  }

  async function saveMapping() {
    if (!selectedAcct) return;
    setSaving(true);
    try {
      await put(`/api/canonical/mappings/${encodeURIComponent(selectedAcct.gl_account_no)}`, {
        canonical_id: editCanonId ? parseInt(editCanonId, 10) : null,
        notes: editNotes || null,
      });
      // Refresh mappings
      const fresh = await get<AccountMapping[]>('/api/canonical/mappings');
      setMappings(fresh);
      showToast(`Mapping saved for ${selectedAcct.gl_account_no}`);
      setSelectedAcct(null);
    } catch (e: unknown) {
      showToast(`Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleSelect(no: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(no) ? next.delete(no) : next.add(no);
      return next;
    });
  }

  async function assignToGroup() {
    if (!activeGrp || selected.size === 0) return;
    setAssigning(true);
    let added = 0;
    for (const no of selected) {
      if (memberSet.has(no)) continue;
      try {
        await post(`/api/gl/groups/${activeGrp.group_id}/members`, { account_no: no });
        added++;
      } catch { /* skip duplicates */ }
    }
    const mem = await get<GroupMember[]>(`/api/gl/groups/${activeGrp.group_id}/members`).catch(() => members);
    setMembers(mem);
    setGroups((prev) => prev.map((g) =>
      g.group_id === activeGrp.group_id ? { ...g, member_count: mem.length } : g
    ));
    setSelected(new Set());
    setAssigning(false);
    showToast(`Added ${added} GL code${added !== 1 ? 's' : ''} to "${activeGrp.group_name}"`);
  }

  async function removeMember(no: string) {
    if (!activeGrp) return;
    try {
      await del(`/api/gl/groups/${activeGrp.group_id}/members/${no}`);
      setMembers((prev) => prev.filter((m) => m.account_no !== no));
      setGroups((prev) => prev.map((g) =>
        g.group_id === activeGrp.group_id ? { ...g, member_count: Math.max(0, g.member_count - 1) } : g
      ));
    } catch { showToast('Remove failed'); }
  }

  async function createGroup() {
    if (!newName.trim()) return;
    setGrpSaving(true);
    try {
      await post('/api/gl/groups', { group_name: newName.trim(), description: newDesc || null, color: newColor });
      setNewName(''); setNewDesc(''); setNewColor(PRESET_COLORS[0]);
      setShowForm(false);
      loadGroups();
      showToast(`Group "${newName.trim()}" created`);
    } catch { showToast('Create failed — name may already exist'); }
    finally  { setGrpSaving(false); }
  }

  async function deleteGroup(g: AccountGroup, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete group "${g.group_name}"?`)) return;
    try {
      await del(`/api/gl/groups/${g.group_id}`);
      if (activeGrp?.group_id === g.group_id) { setActiveGrp(null); setMembers([]); }
      loadGroups();
      showToast(`Deleted "${g.group_name}"`);
    } catch { showToast('Delete failed'); }
  }

  // Canonical options grouped by L1/L2
  const canonicalGroups = useMemo(() => {
    const groups: Record<string, Record<string, CanonicalAccount[]>> = {};
    canonicals.forEach((c) => {
      if (!groups[c.l1_statement]) groups[c.l1_statement] = {};
      if (!groups[c.l1_statement][c.l2_category]) groups[c.l1_statement][c.l2_category] = [];
      groups[c.l1_statement][c.l2_category].push(c);
    });
    return groups;
  }, [canonicals]);

  const selectedMapping = selectedAcct ? mappingIndex[selectedAcct.gl_account_no] : undefined;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

      {/* ── LEFT: GL Code Master ────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
            <input
              style={{ ...inp, flex: 1 }}
              placeholder="Search GL code or account name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selected.size > 0 ? (
              <>
                <button
                  onClick={() => setSelected(new Set())}
                  style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#6b7280', whiteSpace: 'nowrap' }}
                >
                  Clear ({selected.size})
                </button>
                <button
                  onClick={assignToGroup}
                  disabled={!activeGrp || assigning}
                  style={{
                    padding: '7px 14px', borderRadius: 7, border: 'none',
                    background: !activeGrp ? '#e5e7eb' : 'var(--teal-700, #0f3f3c)',
                    color: !activeGrp ? '#9ca3af' : '#fff',
                    fontSize: 12, fontWeight: 700, cursor: !activeGrp ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {assigning ? 'Adding…' : activeGrp ? `→ "${activeGrp.group_name}"` : 'Select group →'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setSelected(new Set(filtered.map((a) => a.gl_account_no)))}
                style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
              >
                All ({filtered.length})
              </button>
            )}
          </div>

          {/* Prefix filter chips */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {prefixes.map((p) => (
              <button
                key={p}
                onClick={() => setPrefixFilter(p)}
                style={{
                  padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: prefixFilter === p ? 'var(--teal-700, #0f3f3c)' : '#f3f4f6',
                  color: prefixFilter === p ? '#fff' : '#6b7280',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* GL rows */}
        <div style={{ maxHeight: 560, overflowY: 'auto' }}>
          {acctLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading GL codes…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No GL codes match.</div>
          ) : filtered.map((a) => {
            const isSelected  = selected.has(a.gl_account_no);
            const isMember    = memberSet.has(a.gl_account_no);
            const isActive    = selectedAcct?.gl_account_no === a.gl_account_no;
            const mapping     = mappingIndex[a.gl_account_no];
            const dot         = mappingDot(mapping);
            return (
              <div
                key={a.gl_account_no}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 16px', cursor: 'pointer',
                  borderBottom: '1px solid #f9fafb',
                  background: isActive ? '#fffbeb' : isSelected ? '#eff6ff' : isMember ? `${activeGrp?.color ?? '#10b981'}0d` : '#fff',
                  borderLeft: isActive ? '3px solid #f59e0b' : '3px solid transparent',
                }}
              >
                {/* Checkbox */}
                <div
                  onClick={() => toggleSelect(a.gl_account_no)}
                  style={{
                    width: 15, height: 15, borderRadius: 4, flexShrink: 0, cursor: 'pointer',
                    border: isSelected ? 'none' : '2px solid #d1d5db',
                    background: isSelected ? '#2563eb' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {isSelected && <span style={{ color: '#fff', fontSize: 9, fontWeight: 900 }}>✓</span>}
                </div>

                {/* Mapping status dot */}
                <div
                  title={dot.label}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: dot.color, flexShrink: 0 }}
                />

                {/* GL code */}
                <span
                  onClick={() => openMapping(a)}
                  style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#374151', minWidth: 76 }}
                >
                  {a.gl_account_no}
                </span>

                {/* Account name */}
                <span
                  onClick={() => openMapping(a)}
                  style={{ flex: 1, fontSize: 12, color: '#374151' }}
                >
                  {a.gl_account_name ?? <span style={{ color: '#9ca3af' }}>—</span>}
                </span>

                {/* Canonical badge */}
                {mapping?.l1_statement && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                    background: `${l1Color(mapping.l1_statement)}18`, color: l1Color(mapping.l1_statement),
                    whiteSpace: 'nowrap',
                  }}>
                    {mapping.l2_category}
                  </span>
                )}

                {/* Balance */}
                <span style={{
                  fontSize: 11, fontWeight: 700, minWidth: 64, textAlign: 'right',
                  color: a.total_amount >= 0 ? '#059669' : '#dc2626',
                }}>
                  {fmtAmt(a.total_amount)}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ padding: '8px 16px', borderTop: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280' }}>
          <span>{filtered.length} of {accounts.length} GL codes</span>
          {selected.size > 0 && <span style={{ fontWeight: 700, color: '#2563eb' }}>{selected.size} selected</span>}
        </div>
      </div>

      {/* ── RIGHT panel ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Mapping panel — shown when a GL code is selected */}
        {selectedAcct ? (
          <div style={{ background: '#fff', border: '2px solid #f59e0b', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14, color: '#111', fontFamily: 'monospace' }}>{selectedAcct.gl_account_no}</span>
                <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{selectedAcct.gl_account_name}</span>
              </div>
              <button onClick={() => setSelectedAcct(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 18, lineHeight: 1 }} aria-label="Close">×</button>
            </div>

            <div style={{ padding: 14 }}>
              {/* Current mapping */}
              {selectedMapping?.canonical_id ? (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', marginBottom: 4 }}>
                    {selectedMapping.mapped_by === 'user' ? 'User-mapped' : 'Auto-mapped'}
                    {selectedMapping.confidence && <span style={{ marginLeft: 8, fontWeight: 400, color: '#9ca3af' }}>{selectedMapping.confidence}% confidence</span>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                    {selectedMapping.l1_statement} → {selectedMapping.l2_category}
                    {selectedMapping.l3_subcategory && <span style={{ color: '#6b7280' }}> → {selectedMapping.l3_subcategory}</span>}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 700 }}>
                  Not mapped — assign below
                </div>
              )}

              {/* Canonical selector */}
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
                Assign canonical account
              </label>
              <select
                value={editCanonId}
                onChange={(e) => setEditCanonId(e.target.value)}
                style={{ ...inp, marginBottom: 8 }}
              >
                <option value="">— Not mapped —</option>
                {Object.entries(canonicalGroups).map(([l1, l2s]) => (
                  <optgroup key={l1} label={`── ${l1} ──`}>
                    {Object.entries(l2s).flatMap(([l2, items]) =>
                      items.map((c) => (
                        <option key={c.canonical_id} value={c.canonical_id}>
                          {l2}{c.l3_subcategory ? ` › ${c.l3_subcategory}` : ''}
                        </option>
                      ))
                    )}
                  </optgroup>
                ))}
              </select>

              <input
                style={{ ...inp, marginBottom: 10 }}
                placeholder="Notes (optional)"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={saveMapping}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: 7, border: 'none',
                    background: 'var(--teal-700, #0f3f3c)', color: '#fff',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Mapping'}
                </button>
                <button
                  onClick={() => setSelectedAcct(null)}
                  style={{ padding: '8px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: '16px', background: '#f9fafb', borderRadius: 12, border: '1px dashed #d1d5db', textAlign: 'center', fontSize: 12, color: '#9ca3af' }}>
            Click any GL code row to view or edit its canonical mapping
          </div>
        )}

        {/* ── Account Groups ─────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#111' }}>Account Groups</span>
            <button
              onClick={() => setShowForm((v) => !v)}
              style={{ padding: '5px 12px', borderRadius: 7, border: 'none', background: 'var(--teal-700, #0f3f3c)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              + New Group
            </button>
          </div>

          {showForm && (
            <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', background: '#fefefe' }}>
              <input style={{ ...inp, marginBottom: 8 }} placeholder="Group name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                {PRESET_COLORS.map((c) => (
                  <button key={c} onClick={() => setNewColor(c)} aria-label={c} style={{
                    width: 22, height: 22, borderRadius: '50%', background: c, border: 'none',
                    cursor: 'pointer', outline: newColor === c ? `3px solid ${c}` : 'none', outlineOffset: 2,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={createGroup} disabled={grpSaving || !newName.trim()} style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: 'var(--teal-700, #0f3f3c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: grpSaving || !newName.trim() ? 0.5 : 1 }}>
                  {grpSaving ? 'Creating…' : 'Create'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {grpLoading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
            ) : groups.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>No groups yet.</div>
            ) : groups.map((g) => {
              const isActive = activeGrp?.group_id === g.group_id;
              return (
                <div key={g.group_id} onClick={() => selectGroup(g)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #f9fafb', background: isActive ? `${g.color}12` : '#fff', borderLeft: isActive ? `3px solid ${g.color}` : '3px solid transparent' }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{g.group_name}</div>
                    {g.description && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{g.description}</div>}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${g.color}20`, color: g.color, whiteSpace: 'nowrap' }}>
                    {g.member_count}
                  </span>
                  <button onClick={(e) => deleteGroup(g, e)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: '0 2px', lineHeight: 1 }} aria-label="Delete group">×</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active group members */}
        {activeGrp && (
          <div style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 12, overflow: 'hidden', borderTop: `3px solid ${activeGrp.color}` }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{activeGrp.group_name}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: activeGrp.color }}>{members.length} codes</span>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto' }}>
              {memLoading ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
              ) : members.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                  No GL codes yet. Select codes and click "→ group".
                </div>
              ) : members.map((m) => (
                <div key={m.account_no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderBottom: '1px solid #f9fafb' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: activeGrp.color, minWidth: 68 }}>{m.account_no}</span>
                  <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{m.label_override ?? m.account_name ?? '—'}</span>
                  {m.account_category && <span style={{ fontSize: 10, color: '#9ca3af' }}>{m.account_category}</span>}
                  <button onClick={() => removeMember(m.account_no)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 15, padding: '0 2px' }} aria-label={`Remove ${m.account_no}`}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 2: Canonical Hierarchy
// ══════════════════════════════════════════════════════════════════════════════

function TabHierarchy({ showToast: _showToast }: { showToast: (m: string) => void }) {
  const [canonicals, setCanonicals] = useState<CanonicalAccount[]>([]);
  const [mappings,   setMappings]   = useState<AccountMapping[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    Promise.all([
      get<CanonicalAccount[]>('/api/canonical/accounts'),
      get<AccountMapping[]>('/api/canonical/mappings'),
    ]).then(([c, m]) => {
      setCanonicals(c);
      setMappings(m);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Count GL codes per canonical_id
  const countByCanonical = useMemo(() => {
    const counts: Record<number, number> = {};
    mappings.forEach((m) => {
      if (m.canonical_id) counts[m.canonical_id] = (counts[m.canonical_id] ?? 0) + 1;
    });
    return counts;
  }, [mappings]);

  // Build tree: l1 → l2 → [canonical rows]
  const tree = useMemo(() => {
    const t: Record<string, Record<string, CanonicalAccount[]>> = {};
    canonicals.forEach((c) => {
      if (!t[c.l1_statement]) t[c.l1_statement] = {};
      if (!t[c.l1_statement][c.l2_category]) t[c.l1_statement][c.l2_category] = [];
      t[c.l1_statement][c.l2_category].push(c);
    });
    return t;
  }, [canonicals]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading hierarchy…</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
      {Object.entries(tree).map(([l1, l2s]) => (
        <div key={l1} style={{ background: '#fff', border: `2px solid ${l1Color(l1)}30`, borderRadius: 12, overflow: 'hidden' }}>

          {/* L1 header */}
          <div style={{ padding: '12px 16px', background: `${l1Color(l1)}10`, borderBottom: `2px solid ${l1Color(l1)}20` }}>
            <div style={{ fontWeight: 900, fontSize: 15, color: l1Color(l1) }}>{l1}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              {Object.values(l2s).flat().reduce((s, c) => s + (countByCanonical[c.canonical_id] ?? 0), 0)} GL codes mapped
            </div>
          </div>

          {/* L2 / L3 */}
          {Object.entries(l2s).map(([l2, items]) => {
            const l2Count = items.reduce((s, c) => s + (countByCanonical[c.canonical_id] ?? 0), 0);
            return (
              <div key={l2} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {/* L2 */}
                <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafafa' }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#374151' }}>{l2}</span>
                  {l2Count > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: `${l1Color(l1)}15`, color: l1Color(l1) }}>
                      {l2Count}
                    </span>
                  )}
                </div>

                {/* L3 items */}
                {items.map((c) => {
                  const cnt = countByCanonical[c.canonical_id] ?? 0;
                  return (
                    <div key={c.canonical_id} style={{ padding: '5px 16px 5px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f9fafb' }}>
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        {c.l3_subcategory ?? c.display_name}
                      </span>
                      <span style={{ fontSize: 11, color: cnt > 0 ? '#374151' : '#d1d5db', fontWeight: cnt > 0 ? 700 : 400 }}>
                        {cnt > 0 ? cnt : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB 3: Coverage Stats
// ══════════════════════════════════════════════════════════════════════════════

function TabStats({ showToast }: { showToast: (m: string) => void }) {
  const [stats,    setStats]    = useState<CanonicalStats | null>(null);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [autoMapping, setAutoMapping] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      get<CanonicalStats>('/api/canonical/stats'),
      get<AccountMapping[]>('/api/canonical/mappings'),
    ]).then(([s, m]) => {
      setStats(s);
      setMappings(m);
    }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runAutoMap() {
    setAutoMapping(true);
    try {
      const result = await post<{ updated: number }>('/api/canonical/mappings/auto-map', {});
      showToast(`Auto-mapped ${result.updated} accounts`);
      load();
    } catch (e: unknown) {
      showToast(`Auto-map failed: ${(e as Error).message}`);
    } finally {
      setAutoMapping(false);
    }
  }

  const unmappedAccounts = useMemo(() =>
    mappings.filter((m) => !m.canonical_id).sort((a, b) => a.source_account.localeCompare(b.source_account)),
    [mappings]
  );

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading stats…</div>;
  }

  if (!stats) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No stats available</div>;
  }

  const pct = stats.pct_mapped;
  const barW = Math.round(pct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Hero row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Total GL codes', value: stats.total,   color: '#374151' },
          { label: 'Mapped',         value: stats.mapped,  color: '#059669' },
          { label: 'Unmapped',       value: stats.unmapped, color: stats.unmapped > 0 ? '#ef4444' : '#9ca3af' },
          { label: 'Coverage',       value: `${pct}%`,     color: pct >= 95 ? '#059669' : pct >= 80 ? '#f59e0b' : '#ef4444' },
        ].map((c) => (
          <div key={c.label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Mapping coverage</span>
          <span style={{ fontSize: 13, fontWeight: 900, color: pct >= 95 ? '#059669' : '#f59e0b' }}>{pct}%</span>
        </div>
        <div style={{ height: 12, background: '#f3f4f6', borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${barW}%`, background: pct >= 95 ? '#059669' : '#f59e0b', borderRadius: 6, transition: 'width 0.5s' }} />
        </div>
      </div>

      {/* By L1 */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 12 }}>Mapped by Financial Statement</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {Object.entries(stats.by_l1).map(([l1, cnt]) => (
            <div key={l1} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: l1Color(l1) }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{l1}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: l1Color(l1) }}>{cnt}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By ERP */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#111', marginBottom: 10 }}>By ERP Source</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {Object.entries(stats.by_erp).map(([erp, cnt]) => (
            <div key={erp} style={{ padding: '6px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8' }}>{erp}</span>
              <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>{cnt} codes</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unmapped accounts */}
      {unmappedAccounts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 20px', borderBottom: '1px solid #fee2e2', background: '#fef2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#dc2626' }}>Unmapped Accounts ({unmappedAccounts.length})</span>
            <button
              onClick={runAutoMap}
              disabled={autoMapping}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#dc2626', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: autoMapping ? 0.6 : 1 }}
            >
              {autoMapping ? 'Running…' : 'Auto-map remaining'}
            </button>
          </div>
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {unmappedAccounts.map((m) => (
              <div key={m.source_account} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 20px', borderBottom: '1px solid #f9fafb' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#dc2626', minWidth: 80 }}>{m.source_account}</span>
                <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{m.source_name ?? '—'}</span>
                <span style={{ fontSize: 11, padding: '2px 8px', background: '#fee2e2', color: '#dc2626', borderRadius: 20, fontWeight: 700 }}>unmapped</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
