/**
 * F021 — GL Mapping Console
 * ERP-style: GL Code Master (left) + Account Groups (right)
 * Select GL codes → assign to groups, exactly like SAP/BC account grouping.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import { get, post, del } from '../api/client';

// ── Types ─────────────────────────────────────────────────────────────────────

interface GLAccount {
  gl_account_no:   string;
  gl_account_name: string | null;
  entity_count:    number;
  total_amount:    number;
  account_category?: string | null;
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

function categoryColor(cat: string | null | undefined): string {
  const c = (cat ?? '').toLowerCase();
  if (c.includes('revenue') || c.includes('income')) return '#059669';
  if (c.includes('cogs') || c.includes('cost'))      return '#d97706';
  if (c.includes('opex') || c.includes('expense'))   return '#dc2626';
  if (c.includes('asset'))                           return '#0369a1';
  if (c.includes('liabilit'))                        return '#b45309';
  if (c.includes('equity'))                          return '#6d28d9';
  if (c.includes('tax'))                             return '#7c3aed';
  return '#6b7280';
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

const PRESET_COLORS = [
  '#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#ec4899','#14b8a6',
];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function MappingConsole() {
  // GL master
  const [accounts,    setAccounts]    = useState<GLAccount[]>([]);
  const [acctLoading, setAcctLoading] = useState(true);
  const [search,      setSearch]      = useState('');
  const [prefixFilter,setPrefixFilter]= useState<string>('All');
  const [selected,    setSelected]    = useState<Set<string>>(new Set());

  // Groups
  const [groups,      setGroups]      = useState<AccountGroup[]>([]);
  const [grpLoading,  setGrpLoading]  = useState(true);
  const [activeGrp,   setActiveGrp]   = useState<AccountGroup | null>(null);
  const [members,     setMembers]     = useState<GroupMember[]>([]);
  const [memLoading,  setMemLoading]  = useState(false);

  // Create group form
  const [showForm,  setShowForm]  = useState(false);
  const [newName,   setNewName]   = useState('');
  const [newDesc,   setNewDesc]   = useState('');
  const [newColor,  setNewColor]  = useState(PRESET_COLORS[0]);
  const [saving,    setSaving]    = useState(false);

  // Assign state
  const [assigning, setAssigning] = useState(false);
  const [toast,     setToast]     = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 2800);
  }

  // Load GL accounts
  useEffect(() => {
    api.gl.accounts()
      .then((rows) => setAccounts(rows))
      .catch(() => {})
      .finally(() => setAcctLoading(false));
  }, []);

  // Load groups
  const loadGroups = useCallback(() => {
    setGrpLoading(true);
    get<AccountGroup[]>('/api/gl/groups')
      .then(setGroups)
      .catch(() => {})
      .finally(() => setGrpLoading(false));
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Load members when group selected
  async function selectGroup(g: AccountGroup) {
    setActiveGrp(g);
    setMemLoading(true);
    try {
      const mem = await get<GroupMember[]>(`/api/gl/groups/${g.group_id}/members`);
      setMembers(mem);
    } catch { setMembers([]); }
    finally  { setMemLoading(false); }
  }

  // Member set for highlighting in master list
  const memberSet = useMemo(() => new Set(members.map((m) => m.account_no)), [members]);

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

  // Toggle selection
  function toggleSelect(no: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(no) ? next.delete(no) : next.add(no);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((a) => a.gl_account_no)));
  }

  function clearSelection() { setSelected(new Set()); }

  // Assign selected to active group
  async function assignToGroup() {
    if (!activeGrp || selected.size === 0) return;
    setAssigning(true);
    let added = 0;
    for (const no of selected) {
      if (memberSet.has(no)) continue; // already in group
      try {
        await post(`/api/gl/groups/${activeGrp.group_id}/members`, { account_no: no });
        added++;
      } catch { /* skip duplicates */ }
    }
    // Refresh members
    const mem = await get<GroupMember[]>(`/api/gl/groups/${activeGrp.group_id}/members`).catch(() => members);
    setMembers(mem);
    setGroups((prev) => prev.map((g) =>
      g.group_id === activeGrp.group_id ? { ...g, member_count: mem.length } : g
    ));
    setSelected(new Set());
    setAssigning(false);
    showToast(`Added ${added} GL code${added !== 1 ? 's' : ''} to "${activeGrp.group_name}"`);
  }

  // Remove member from active group
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

  // Create group
  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await post('/api/gl/groups', { group_name: newName.trim(), description: newDesc || null, color: newColor });
      setNewName(''); setNewDesc(''); setNewColor(PRESET_COLORS[0]);
      setShowForm(false);
      loadGroups();
      showToast(`Group "${newName.trim()}" created`);
    } catch { showToast('Create failed — name may already exist'); }
    finally  { setSaving(false); }
  }

  // Delete group
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

  // ── Render ────────────────────────────────────────────────────────────────

  const inp: React.CSSProperties = {
    background: '#fff', border: '1px solid #e5e7eb',
    borderRadius: 7, padding: '7px 11px', fontSize: 13,
    color: '#111', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

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
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#111', letterSpacing: '-0.02em' }}>
          GL Mapping Console
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {accounts.length} GL codes · Select codes from master list and assign to groups
        </p>
      </div>

      {/* Main two-panel layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

        {/* ── LEFT: GL Code Master ─────────────────────────────────────────── */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>

          {/* Master toolbar */}
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
                    onClick={clearSelection}
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
                    {assigning ? 'Adding…' : activeGrp ? `→ Add to "${activeGrp.group_name}"` : 'Select a group →'}
                  </button>
                </>
              ) : (
                <button
                  onClick={selectAll}
                  style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}
                >
                  Select All ({filtered.length})
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

          {/* GL code rows */}
          <div style={{ maxHeight: 580, overflowY: 'auto' }}>
            {acctLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading GL codes…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>No GL codes match your search.</div>
            ) : filtered.map((a) => {
              const isSelected  = selected.has(a.gl_account_no);
              const isMember    = memberSet.has(a.gl_account_no);
              const color       = categoryColor(a.account_category ?? accountPrefix(a.gl_account_no));
              return (
                <div
                  key={a.gl_account_no}
                  onClick={() => toggleSelect(a.gl_account_no)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '9px 16px', cursor: 'pointer',
                    borderBottom: '1px solid #f9fafb',
                    background: isSelected ? '#eff6ff' : isMember ? `${activeGrp?.color ?? '#10b981'}0d` : '#fff',
                    transition: 'background 80ms',
                  }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                    border: isSelected ? 'none' : '2px solid #d1d5db',
                    background: isSelected ? '#2563eb' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>✓</span>}
                  </div>

                  {/* GL code */}
                  <span style={{
                    fontFamily: 'monospace', fontSize: 13, fontWeight: 700,
                    color, minWidth: 80,
                  }}>
                    {a.gl_account_no}
                  </span>

                  {/* Account name */}
                  <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>
                    {a.gl_account_name ?? <span style={{ color: '#9ca3af' }}>—</span>}
                  </span>

                  {/* Category chip */}
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 20, background: `${color}15`, color,
                    whiteSpace: 'nowrap',
                  }}>
                    {accountPrefix(a.gl_account_no)}
                  </span>

                  {/* Balance */}
                  <span style={{
                    fontSize: 12, fontWeight: 700, minWidth: 72, textAlign: 'right',
                    color: a.total_amount >= 0 ? '#059669' : '#dc2626',
                  }}>
                    {fmtAmt(a.total_amount)}
                  </span>

                  {/* In-group indicator */}
                  {isMember && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px',
                      borderRadius: 20,
                      background: `${activeGrp?.color ?? '#10b981'}20`,
                      color: activeGrp?.color ?? '#10b981',
                      whiteSpace: 'nowrap',
                    }}>
                      In group
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer count */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280' }}>
            <span>{filtered.length} of {accounts.length} GL codes shown</span>
            {selected.size > 0 && <span style={{ fontWeight: 700, color: '#2563eb' }}>{selected.size} selected</span>}
          </div>
        </div>

        {/* ── RIGHT: Groups panel ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Groups header */}
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

            {/* Create form */}
            {showForm && (
              <div style={{ padding: 14, borderBottom: '1px solid #f3f4f6', background: '#fefefe' }}>
                <input style={{ ...inp, marginBottom: 8 }} placeholder="Group name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <input style={{ ...inp, marginBottom: 10 }} placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                  {PRESET_COLORS.map((c) => (
                    <button key={c} onClick={() => setNewColor(c)} aria-label={c} style={{
                      width: 22, height: 22, borderRadius: '50%', background: c, border: 'none',
                      cursor: 'pointer', outline: newColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: 2,
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={createGroup}
                    disabled={saving || !newName.trim()}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', background: 'var(--teal-700, #0f3f3c)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving || !newName.trim() ? 0.5 : 1 }}
                  >
                    {saving ? 'Creating…' : 'Create'}
                  </button>
                  <button onClick={() => setShowForm(false)} style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#6b7280' }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Group list */}
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {grpLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : groups.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No groups yet. Create one above.</div>
              ) : groups.map((g) => {
                const isActive = activeGrp?.group_id === g.group_id;
                return (
                  <div
                    key={g.group_id}
                    onClick={() => selectGroup(g)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', cursor: 'pointer',
                      borderBottom: '1px solid #f9fafb',
                      background: isActive ? `${g.color}12` : '#fff',
                      borderLeft: isActive ? `3px solid ${g.color}` : '3px solid transparent',
                    }}
                  >
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{g.group_name}</div>
                      {g.description && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{g.description}</div>}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${g.color}20`, color: g.color, whiteSpace: 'nowrap' }}>
                      {g.member_count}
                    </span>
                    <button
                      onClick={(e) => deleteGroup(g, e)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: '0 2px', lineHeight: 1 }}
                      aria-label="Delete group"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active group members */}
          {activeGrp && (
            <div style={{ background: '#fff', border: `1px solid #e5e7eb`, borderRadius: 12, overflow: 'hidden', borderTop: `3px solid ${activeGrp.color}` }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', background: '#fafafa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, fontSize: 13, color: '#111' }}>{activeGrp.group_name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: activeGrp.color }}>{members.length} GL codes</span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {memLoading ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
                ) : members.length === 0 ? (
                  <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
                    No GL codes yet.<br />Select codes from the master list and click "Add to group".
                  </div>
                ) : members.map((m) => (
                  <div key={m.account_no} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 14px', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: activeGrp.color, minWidth: 72 }}>
                      {m.account_no}
                    </span>
                    <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>
                      {m.label_override ?? m.account_name ?? '—'}
                    </span>
                    {m.account_category && (
                      <span style={{ fontSize: 10, color: '#9ca3af' }}>{m.account_category}</span>
                    )}
                    <button
                      onClick={() => removeMember(m.account_no)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', fontSize: 15, padding: '0 2px', lineHeight: 1 }}
                      aria-label={`Remove ${m.account_no}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
