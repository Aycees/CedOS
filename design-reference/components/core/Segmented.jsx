export function Segmented({ options, value, onChange, style }) {
  return (
    <div style={{ display: 'flex', background: 'color-mix(in srgb, var(--text) 7%, transparent)', borderRadius: 8, padding: 3, width: 'fit-content', ...style }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          border: 'none', borderRadius: 6, padding: '6px 13px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
          background: value === opt.value ? 'var(--card)' : 'transparent',
          color: value === opt.value ? 'var(--text)' : 'var(--muted)', cursor: 'pointer'
        }}>{opt.label}</button>
      ))}
    </div>
  );
}
