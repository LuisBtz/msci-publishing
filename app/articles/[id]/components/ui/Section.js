'use client'
/**
 * Section
 *
 * Card wrapper with an uppercase title and a white rounded body used
 * to group related article fields (Metadata, Tags, Authors, Body, …).
 * Used throughout Metadata and Content tabs.
 */
import { sectionTitleStyle } from './articleStyles'

export default function Section({ title, children }) {
  return (
    <div>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          border: '1px solid #e5e5e5',
          padding: '1rem',
        }}
      >
        {children}
      </div>
    </div>
  )
}
