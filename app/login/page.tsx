'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setTimeout(() => {
      window.location.replace('/dashboard')
    }, 500)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#1A3FD6',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '2.5rem',
        borderRadius: '18px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: '400px',
        margin: '1rem',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '8px',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#1A3FD6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: '700',
              fontSize: '14px',
              letterSpacing: '-0.02em',
            }}>
              M
            </div>
            <span style={{
              fontWeight: '700',
              fontSize: '20px',
              letterSpacing: '-0.04em',
              color: '#1A3FD6',
            }}>
              MSCI
            </span>
          </div>
          <p style={{
            color: '#707070',
            fontSize: '14px',
            letterSpacing: '-0.02em',
          }}>
            Research Publishing Platform
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#222',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #CCCCCC',
                borderRadius: '8px',
                fontSize: '15px',
                letterSpacing: '-0.02em',
                outline: 'none',
                fontFamily: 'inherit',
                color: '#000',
              }}
              placeholder="your@email.com"
              onFocus={e => e.target.style.borderColor = '#1A3FD6'}
              onBlur={e => e.target.style.borderColor = '#CCCCCC'}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '600',
              marginBottom: '6px',
              color: '#222',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #CCCCCC',
                borderRadius: '8px',
                fontSize: '15px',
                letterSpacing: '-0.02em',
                outline: 'none',
                fontFamily: 'inherit',
                color: '#000',
              }}
              placeholder="••••••••"
              onFocus={e => e.target.style.borderColor = '#1A3FD6'}
              onBlur={e => e.target.style.borderColor = '#CCCCCC'}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#FEF0E9',
              border: '1px solid #F7620E',
              color: '#F7620E',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '14px',
              letterSpacing: '-0.02em',
              marginBottom: '1rem',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: loading ? '#CCCCCC' : '#1A3FD6',
              color: 'white',
              border: 'none',
              borderRadius: '100px',
              fontSize: '16px',
              fontWeight: '500',
              letterSpacing: '-0.02em',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
