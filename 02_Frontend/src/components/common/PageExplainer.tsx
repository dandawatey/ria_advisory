/**
 * PageExplainer — contextual info banner shown at the top of every page.
 * Explains what the page does, who uses it, and key terms/columns.
 */
interface PageExplainerProps {
  icon: string;
  title: string;
  description: string;
  /** Optional 2–4 key concepts shown as a colour-coded legend row */
  concepts?: { icon?: string; color?: string; label: string; desc: string }[];
  /** Optional column/term glossary shown as inline tags */
  glossary?: { term: string; def: string }[];
}

export default function PageExplainer({
  icon,
  title,
  description,
  concepts,
  glossary,
}: PageExplainerProps) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%)',
      border: '1px solid #c3ddf7',
      borderLeft: '4px solid var(--color-primary, #2563eb)',
      borderRadius: 8,
      padding: '16px 20px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 20, lineHeight: 1, marginTop: 2 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#1e40af', marginBottom: 6 }}>
            {title}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.65 }}
            dangerouslySetInnerHTML={{ __html: description }}
          />

          {concepts && concepts.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {concepts.map(({ icon: cIcon, color = '#6b7280', label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {cIcon && <span style={{ fontWeight: 700, color, fontSize: 14, minWidth: 16 }}>{cIcon}</span>}
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12, color }}>{label}</div>
                    <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {glossary && glossary.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#6b7280' }}>
              <strong>Key terms: </strong>
              {glossary.map(({ term, def }, i) => (
                <span key={term} style={{ marginRight: 14 }}>
                  <strong>{term}</strong> — {def}{i < glossary.length - 1 ? '' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
