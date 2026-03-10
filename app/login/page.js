'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

const handleLogin = async (e) => {
  e.preventDefault()
  setLoading(true)
  setError('')

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    setError('Email o contraseña incorrectos')
    setLoading(false)
    return
  }

  // Esperar 500ms para que las cookies se escriban correctamente
  setTimeout(() => {
    window.location.replace('/dashboard')
  }, 500)
}

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', backgroundColor: '#f5f5f5', fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: 'white', padding: '2.5rem', borderRadius: '8px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)', width: '100%', maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            backgroundColor: 'black', color: 'white', display: 'inline-block',
            padding: '0.5rem 1.2rem', borderRadius: '4px', fontSize: '1.2rem', fontWeight: 'bold'
          }}>
            MSCI
          </div>
          <p style={{ color: '#666', marginTop: '0.75rem', fontSize: '0.95rem' }}>
            Research Publishing Platform
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#333' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #ddd',
                borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box'
              }}
              placeholder="tu@email.com"
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#333' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%', padding: '0.65rem 0.75rem', border: '1px solid #ddd',
                borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box'
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fff0f0', border: '1px solid #ffcccc',
              color: '#cc0000', padding: '0.65rem 0.75rem', borderRadius: '4px',
              fontSize: '0.85rem', marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem', backgroundColor: loading ? '#999' : 'black',
              color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.95rem',
              fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}