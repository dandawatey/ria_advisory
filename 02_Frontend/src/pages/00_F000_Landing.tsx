import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import riaLogo from '../assets/ria-advisory-logo.svg';
import isourceLogo from '../assets/isource-logo.png';
import hexPattern from '../assets/pattern-lattice.svg';

const FEATURES = [
  {
    icon: '▦',
    title: 'Executive Dashboard',
    desc: 'Consolidated P&L, Balance Sheet, and Cash Flow across all 17 entities in a single view.',
  },
  {
    icon: '₱',
    title: 'P&L Analytics',
    desc: 'Drill from consolidated group to entity to cost-centre with variance and YoY trending.',
  },
  {
    icon: '⇄',
    title: 'Cash Flow Statement',
    desc: 'Operating, investing, and financing activities auto-derived from your GL entries.',
  },
  {
    icon: '⧖',
    title: 'AR Ageing & Collections',
    desc: 'Real-time receivables ageing buckets with customer-level exposure and collection velocity.',
  },
  {
    icon: '⊕',
    title: 'GL Explorer',
    desc: '188,380 journal entries searchable by account, entity, date, and document reference.',
  },
  {
    icon: '◈',
    title: 'KPI Dashboard',
    desc: 'Current Ratio, EBITDA Margin, DSO, Quick Ratio — auto-calculated, always current.',
  },
  {
    icon: '⊜',
    title: 'Entity Comparison',
    desc: 'Side-by-side financial performance across subsidiaries with normalised benchmarks.',
  },
  {
    icon: '♥',
    title: 'Financial Health Score',
    desc: 'Composite scoring model weighing liquidity, profitability, leverage, and efficiency.',
  },
];

const STATS = [
  { value: '188K+', label: 'GL Entries' },
  { value: '17',    label: 'Entities' },
  { value: '8+',    label: 'Report Types' },
  { value: '365',   label: 'Days Coverage' },
];

export default function Landing() {
  const navigate  = useNavigate();
  const { isAuthenticated } = useAuth();

  function handleCTA() {
    navigate(isAuthenticated ? '/dashboard' : '/login');
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--neutral-25)', fontFamily: "'Nunito Sans', system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,251,251,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--neutral-100)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--teal-800)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em',
          }}>
            i
          </div>
          <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--neutral-900)', letterSpacing: '-0.02em' }}>
            i-CFO<span style={{ color: 'var(--coral-500)' }}>360</span>
          </span>
          <span style={{
            marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: '.1em',
            textTransform: 'uppercase', color: 'var(--teal-600)',
            background: 'var(--teal-50)', padding: '2px 8px', borderRadius: 999,
          }}>
            by i-Source Infosystems
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--neutral-500)' }}>
            Unified Financial Intelligence Platform
          </span>
          <button onClick={handleCTA} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'var(--coral-500)', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            transition: 'background 120ms ease',
          }}
            onMouseOver={e => (e.currentTarget.style.background = 'var(--coral-600)')}
            onMouseOut={e  => (e.currentTarget.style.background = 'var(--coral-500)')}
          >
            {isAuthenticated ? 'Go to Dashboard' : 'Sign In'}
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, var(--teal-50) 0%, var(--neutral-25) 55%, var(--coral-50) 100%)',
      }}>
        {/* Hexagon lattice overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          backgroundImage: `url(${hexPattern})`,
          backgroundRepeat: 'repeat',
          backgroundSize: '208px 240px',
          opacity: 0.35,
          pointerEvents: 'none',
        }} />
      <div style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1100, margin: '0 auto', padding: '96px 40px 80px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block', marginBottom: 20,
          fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
          color: 'var(--coral-500)', background: 'var(--coral-50)',
          padding: '4px 14px', borderRadius: 999,
        }}>
          CFO-Grade Financial Intelligence
        </div>

        <h1 style={{
          fontSize: 56, fontWeight: 900, lineHeight: 1.1,
          letterSpacing: '-0.03em', color: 'var(--neutral-900)',
          marginBottom: 24,
        }}>
          Your entire group's finances,<br />
          <span style={{ color: 'var(--teal-600)' }}>unified in one platform.</span>
        </h1>

        <p style={{
          fontSize: 18, color: 'var(--neutral-600)', lineHeight: 1.65,
          maxWidth: 640, margin: '0 auto 40px', fontWeight: 400,
        }}>
          i-CFO360 consolidates P&L, Balance Sheet, Cash Flow, and AR Ageing across
          all your entities — powered by 188,000+ real GL entries from Business Central.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={handleCTA} style={{
            padding: '14px 32px', borderRadius: 10, border: 'none',
            background: 'var(--coral-500)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(232,68,59,.30)',
            transition: 'all 120ms ease',
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--coral-600)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.background = 'var(--coral-500)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isAuthenticated ? 'Open Dashboard →' : 'Get Started →'}
          </button>
          <button onClick={() => navigate('/login')} style={{
            padding: '14px 32px', borderRadius: 10,
            border: '1px solid var(--neutral-200)',
            background: '#fff', color: 'var(--neutral-700)',
            fontSize: 15, fontWeight: 600, cursor: 'pointer',
            transition: 'border-color 120ms ease, color 120ms ease',
          }}
            onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--teal-300)'; e.currentTarget.style.color = 'var(--teal-700)'; }}
            onMouseOut={e  => { e.currentTarget.style.borderColor = 'var(--neutral-200)'; e.currentTarget.style.color = 'var(--neutral-700)'; }}
          >
            Sign In
          </button>
        </div>
      </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: 'var(--teal-800)', padding: '40px 40px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0,
        }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{
              textAlign: 'center', padding: '20px 24px',
              borderRight: i < STATS.length - 1 ? '1px solid rgba(255,255,255,.12)' : 'none',
            }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.55)', marginTop: 6, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 40px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <div style={{
            display: 'inline-block', marginBottom: 14,
            fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'var(--teal-600)', background: 'var(--teal-50)',
            padding: '4px 14px', borderRadius: 999,
          }}>
            Platform Modules
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: 'var(--neutral-900)', letterSpacing: '-0.02em', marginBottom: 12 }}>
            Everything a CFO needs
          </h2>
          <p style={{ fontSize: 16, color: 'var(--neutral-500)', maxWidth: 520, margin: '0 auto' }}>
            Eight purpose-built modules covering every dimension of group financial management.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: '#fff',
              border: '1px solid var(--neutral-100)',
              borderRadius: 12,
              padding: '24px 20px',
              boxShadow: '0 1px 3px rgba(15,63,60,.06)',
              transition: 'border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease',
              cursor: 'default',
            }}
              onMouseOver={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--teal-200)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(15,63,60,.10)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              }}
              onMouseOut={e => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--neutral-100)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(15,63,60,.06)';
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'var(--teal-50)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, marginBottom: 14, color: 'var(--teal-600)',
              }}>
                {f.icon}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--neutral-900)', marginBottom: 8, lineHeight: 1.3 }}>
                {f.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--neutral-500)', lineHeight: 1.6 }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Band ── */}
      <section style={{
        background: 'linear-gradient(135deg, var(--teal-800) 0%, var(--teal-600) 100%)',
        padding: '72px 40px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginBottom: 16 }}>
            Ready to take control?
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.72)', marginBottom: 36, lineHeight: 1.6 }}>
            Sign in with your Microsoft Entra account to access your organisation's financial intelligence platform.
          </p>
          <button onClick={handleCTA} style={{
            padding: '14px 36px', borderRadius: 10, border: 'none',
            background: 'var(--coral-500)', color: '#fff',
            fontSize: 15, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,.25)',
            transition: 'all 120ms ease',
          }}
            onMouseOver={e => { e.currentTarget.style.background = 'var(--coral-600)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseOut={e  => { e.currentTarget.style.background = 'var(--coral-500)'; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {isAuthenticated ? 'Go to Dashboard →' : 'Sign In with Microsoft →'}
          </button>
        </div>
      </section>

      {/* ── Partner Logos ── */}
      <section style={{
        background: 'var(--neutral-50)',
        borderTop: '1px solid var(--neutral-100)',
        borderBottom: '1px solid var(--neutral-100)',
        padding: '32px 40px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <p style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
            color: 'var(--neutral-400)', marginBottom: 24,
          }}>
            Trusted by
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 56, flexWrap: 'wrap' }}>
            <img
              src={riaLogo}
              alt="RIA Advisory"
              style={{ height: 40, objectFit: 'contain', opacity: 0.85 }}
            />
            <div style={{ width: 1, height: 40, background: 'var(--neutral-200)' }} />
            <img
              src={isourceLogo}
              alt="i-Source Infosystems"
              style={{ height: 40, objectFit: 'contain', opacity: 0.85 }}
            />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        background: 'var(--teal-900)',
        padding: '32px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--teal-700)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900, color: '#fff',
          }}>i</div>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>
            i-CFO<span style={{ color: 'var(--coral-500)' }}>360</span>
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>
          Powered by i-Source Infosystems · Unified Financial Intelligence Platform
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
          © {new Date().getFullYear()} i-Source Infosystems
        </div>
      </footer>
    </div>
  );
}
