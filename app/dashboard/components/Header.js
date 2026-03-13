'use client'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Header({ user }) {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div style={{
      backgroundColor: 'black', color: 'white',
      padding: '0 2rem', height: '56px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      position: 'sticky', top: 0, zIndex: 100
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontWeight: 'bold', fontSize: '1rem', letterSpacing: '0.05em' }}>MSCI</span>
        <span style={{ color: '#666', fontSize: '0.8rem' }}>|</span>
        <span style={{ color: '#999', fontSize: '0.85rem' }}>Research Publishing Platform</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#888' }}>{user?.email}</span>
        <button
          onClick={handleLogout}
          style={{
            backgroundColor: 'transparent', border: '1px solid #444',
            color: '#ccc', padding: '0.35rem 0.8rem', borderRadius: '4px',
            cursor: 'pointer', fontSize: '0.8rem'
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}