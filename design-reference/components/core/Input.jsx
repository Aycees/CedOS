export function Input({ variant = 'boxed', style, ...rest }) {
  const base = { fontFamily: variant === 'ghost' ? 'var(--font-serif)' : 'var(--font-mono)', color: 'var(--text)', background: 'transparent', outline: 'none', width: '100%' };
  const variants = {
    boxed: { border: '1px solid var(--border)', borderRadius: 'var(--radius-input)', padding: '8px 11px', fontSize: 12.5 },
    ghost: { border: 'none', padding: 0, fontSize: 24, letterSpacing: '-.015em' }
  };
  return <input style={{ ...base, ...variants[variant], ...style }} {...rest} />;
}
