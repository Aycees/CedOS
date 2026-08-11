export function Button({ children, variant = 'solid', size = 'md', accent, onClick, style, ...rest }) {
  const pad = size === 'sm' ? '7px 12px' : '10px 16px';
  const font = size === 'sm' ? 11.5 : 12;
  const base = {
    fontFamily: 'var(--font-mono)', fontSize: font, borderRadius: 'var(--radius-control)', cursor: 'pointer',
    padding: pad, display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--text)'
  };
  const variants = {
    solid: { background: accent || 'var(--accent-default)', color: 'var(--on-dark)' },
    outline: { border: '1px solid var(--border)', color: 'var(--text)' },
    ghost: { color: accent || 'var(--accent-default)', padding: size === 'sm' ? '4px' : '4px 6px' },
    dashed: { border: '1px dashed var(--border-strong)', color: 'var(--muted)', textAlign: 'left', borderRadius: 8 }
  };
  return <button onClick={onClick} style={{ ...base, ...variants[variant], ...style }} {...rest}>{children}</button>;
}
