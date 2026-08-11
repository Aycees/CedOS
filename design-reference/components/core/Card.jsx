export function Card({ children, padding = '20px 22px', style, ...rest }) {
  return (
    <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-card)', padding, ...style }} {...rest}>
      {children}
    </section>
  );
}
