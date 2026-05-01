'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function Header({ user }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div style={{
      backgroundColor: '#1A3FD6',
      color: 'white',
      padding: '0 2rem',
      height: '56px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '28px',
          height: '28px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: '700',
          fontSize: '13px',
        }}>
          M
        </div>
        <span style={{ fontWeight: '700', fontSize: '15px', letterSpacing: '-0.04em' }}>MSCI</span>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>|</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', letterSpacing: '-0.02em' }}>
          Research Publishing
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', letterSpacing: '-0.02em' }}>
          {user?.email}
        </span>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid rgba(255,255,255,0.35)',
            color: 'rgba(255,255,255,0.85)',
            padding: '5px 14px',
            borderRadius: '100px',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'inherit',
            letterSpacing: '-0.02em',
            fontWeight: '500',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
