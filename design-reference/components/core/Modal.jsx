export function Modal({ children, width = 400, onClose }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 40 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: `min(${width}px, 88%)`, background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-modal)', boxShadow: 'var(--shadow-modal)', padding: '24px 26px'
      }}>{children}</div>
    </div>
  );
}
