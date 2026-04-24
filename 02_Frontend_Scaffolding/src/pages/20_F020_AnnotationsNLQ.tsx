/**
 * F020 — In-App Annotations & Natural Language Query
 * Overlay components: annotation thread panel + NLQ pane.
 * This page demonstrates both as standalone review screens.
 */
import { useState } from 'react';

interface Annotation {
  id: string;
  author: string;
  initials: string;
  content: string;
  timestamp: string;
  replies: { author: string; initials: string; content: string; timestamp: string }[];
}

const mockAnnotations: Annotation[] = [
  {
    id: 'ann-001',
    author: 'Marcus Chen',
    initials: 'MC',
    content: 'Advisory fee revenue is running $1.4M above plan for April. Main driver is SUB01 closing two new institutional mandates mid-month.',
    timestamp: '2026-04-23 09:12',
    replies: [
      { author: 'Elena Marchetti', initials: 'EM', content: 'Good — make sure this is reflected in the Q2 forecast update for the board pack.', timestamp: '2026-04-23 10:04' },
    ],
  },
  {
    id: 'ann-002',
    author: 'Priya Nair',
    initials: 'PN',
    content: 'SUB04 technology costs spiked in April due to a one-time infrastructure migration charge. Will normalise in May.',
    timestamp: '2026-04-22 15:30',
    replies: [],
  },
];

const nlqHistory = [
  {
    question: 'What is our EBITDA margin for Q2 vs Q1 by service line?',
    answer: 'Q2 YTD EBITDA margin: 36.8%. Q1 actual: 38.2%. Portfolio Management margin declined 2.1pp driven by technology investment. Financial Planning improved 0.4pp.',
    sql: `SELECT service_line, period_quarter,\n  SUM(ebitda_usd) / NULLIF(SUM(revenue_usd), 0) * 100 AS ebitda_margin\nFROM gold.fact_gl_entry\nJOIN gold.dim_dimension_value dv ON dv.sk_dim = fact_gl_entry.sk_service_line\nJOIN gold.dim_date d ON d.date_key = fact_gl_entry.posting_date\nWHERE d.fiscal_year = 2026\n  AND is_eliminated = true\nGROUP BY 1, 2\nORDER BY 2, 1`,
  },
];

export default function AnnotationsNLQ() {
  const [activeSection, setActiveSection] = useState<'annotations' | 'nlq'>('annotations');
  const [nlqInput, setNlqInput] = useState('');
  const [showSQL, setShowSQL] = useState<Record<number, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');

  const handleNLQ = () => {
    if (!nlqInput.trim()) return;
    setSubmitting(true);
    setTimeout(() => { setSubmitting(false); setNlqInput(''); }, 1500);
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Annotations & Natural Language Query</h1>
        <p className="page-subtitle">
          In-app management commentary with @mentions · LLM-backed NLQ with SQL transparency. (F020)
        </p>
      </div>

      <div className="tabs">
        <div className={`tab ${activeSection === 'annotations' ? 'active' : ''}`} onClick={() => setActiveSection('annotations')}>
          Annotations ({mockAnnotations.length})
        </div>
        <div className={`tab ${activeSection === 'nlq' ? 'active' : ''}`} onClick={() => setActiveSection('nlq')}>
          Natural Language Query
        </div>
      </div>

      {activeSection === 'annotations' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}>
          {/* Annotation thread */}
          <div>
            {mockAnnotations.map((ann) => (
              <div className="card mb-16" key={ann.id}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                    {ann.initials}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{ann.author}</span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{ann.timestamp}</span>
                    </div>
                    <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>{ann.content}</p>
                    {ann.replies.length > 0 && (
                      <div style={{ marginTop: 12, paddingLeft: 16, borderLeft: '2px solid var(--color-border)' }}>
                        {ann.replies.map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--color-primary-dark)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                              {r.initials}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 12 }}>{r.author} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>{r.timestamp}</span></div>
                              <p style={{ fontSize: 12, margin: '2px 0 0' }}>{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary btn-sm">Reply</button>
                      <button className="btn btn-secondary btn-sm">@Mention</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* New annotation */}
            <div className="card">
              <div className="card-title">Add Annotation</div>
              <textarea
                className="form-input" rows={4}
                placeholder="Add commentary on this data point… Use @Name to mention colleagues."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                style={{ resize: 'vertical' }}
              />
              <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setNewComment('')}>Cancel</button>
                <button className="btn btn-primary btn-sm" disabled={!newComment.trim()}>Post Annotation</button>
              </div>
            </div>
          </div>

          {/* Context panel */}
          <div className="card" style={{ height: 'fit-content' }}>
            <div className="card-title">Annotation Context</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.8 }}>
              <div><strong>View:</strong> Executive Dashboard</div>
              <div><strong>Data Point:</strong> Advisory Fees · Apr 2026 · MTD</div>
              <div><strong>Value:</strong> $24.8M</div>
              <div><strong>Entity:</strong> All Entities (consolidated)</div>
              <div><strong>Run ID:</strong> run-20260423-1402-sched</div>
            </div>
            <div className="divider" />
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              Annotations are visible to all users with access to this data point's scope.
              @mentions trigger email + Teams notifications.
            </p>
          </div>
        </div>
      )}

      {activeSection === 'nlq' && (
        <div>
          <div className="alert alert-warning mb-24">
            ⚠ AI-generated answers. Always verify the SQL and consult the data team for material financial decisions.
            Scoped to Gold layer · Your entity permissions apply.
          </div>

          {/* NLQ input */}
          <div className="card mb-16">
            <div className="card-title">Ask a Question</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                placeholder="e.g. What is our EBITDA margin by service line for Q2 vs Q1?"
                value={nlqInput}
                onChange={(e) => setNlqInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNLQ()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={handleNLQ} disabled={submitting || !nlqInput.trim()}>
                {submitting ? '…' : 'Ask'}
              </button>
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['Revenue by region YTD', 'EBITDA margin trend Q1-Q2', 'Top 5 clients by fee income', 'AR aging summary'].map((s) => (
                <button key={s} className="btn btn-secondary btn-sm" onClick={() => setNlqInput(s)}>{s}</button>
              ))}
            </div>
          </div>

          {/* Prior answers */}
          {nlqHistory.map((item, idx) => (
            <div className="card mb-16" key={idx}>
              <div style={{ marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Question</span>
                <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>❝ {item.question}</div>
              </div>
              <div style={{ padding: '12px 16px', background: 'var(--color-primary-light)', borderRadius: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600, display: 'block', marginBottom: 4 }}>AI Answer</span>
                <p style={{ fontSize: 13, margin: 0 }}>{item.answer}</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowSQL({ ...showSQL, [idx]: !showSQL[idx] })}>
                {showSQL[idx] ? 'Hide' : 'Show'} SQL ↓
              </button>
              {showSQL[idx] && (
                <pre style={{
                  marginTop: 10, padding: '12px 16px', background: '#0f172a', color: '#94a3b8',
                  borderRadius: 8, fontSize: 12, overflowX: 'auto', lineHeight: 1.7,
                }}>
                  {item.sql}
                </pre>
              )}
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm">Copy SQL to Explorer</button>
                <button className="btn btn-secondary btn-sm">Export Result</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
