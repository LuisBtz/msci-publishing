'use client'

export default function Badge({ label, colors }) {
  const { bg = '#F4F5FD', fg = '#1A3FD6' } = colors || {}
  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: '500',
        padding: '3px 10px',
        borderRadius: '100px',
        whiteSpace: 'nowrap',
        letterSpacing: '-0.01em',
        backgroundColor: bg,
        color: fg,
      }}
    >
      {label}
    </span>
  )
}
