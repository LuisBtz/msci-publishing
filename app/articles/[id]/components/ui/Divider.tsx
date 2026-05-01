'use client'
/**
 * Divider
 *
 * 1px horizontal separator used inside Section cards to divide
 * consecutive FieldRows. Pure visual — no logic.
 */
export default function Divider() {
  return (
    <div
      style={{
        height: '1px',
        backgroundColor: '#f5f5f5',
        margin: '0.65rem 0',
      }}
    />
  )
}
