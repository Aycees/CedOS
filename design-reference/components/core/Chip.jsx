export function Chip({ children, color, dot = false, style }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      border: '1px solid var(--border)', borderRadius: 'var(--radius-pill)', padding: '7px 14px',
      fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text)',
      background: 'color-mix(in srgb, var(--text) 5%, transparent)', ...style
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: color || 'var(--accent-default)', flex: 'none' }} />}
      {children}
    </span>
  );
}
