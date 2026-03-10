'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/useAuth'
import { supabase } from '@/lib/supabase'
import Header from './components/Header'
import ArticleTable from './components/ArticleTable'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const [articles, setArticles] = useState([])
  const [loadingArticles, setLoadingArticles] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)

  useEffect(() => {
    if (user) fetchArticles()
  }, [user])

  const fetchArticles = async () => {
    setLoadingArticles(true)
    const { data, error } = await supabase
      .from('articles')
      .select('id, headline, type, status, assigned_to, created_at')
      .order('created_at', { ascending: false })

    if (!error) setArticles(data || [])
    setLoadingArticles(false)
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontFamily: 'sans-serif'
    }}>
      <p style={{ color: '#999' }}>Cargando...</p>
    </div>
  )

  return (
    <div style={{ fontFamily: 'sans-serif', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Header user={user} />

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.4rem', color: '#111', fontWeight: '700' }}>
            Artículos de Research
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#999' }}>
            Gestiona y publica el contenido de MSCI Research
          </p>
        </div>

        {loadingArticles ? (
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e5e5e5',
            padding: '3rem', textAlign: 'center'
          }}>
            <p style={{ color: '#999', fontSize: '0.9rem', margin: 0 }}>Cargando artículos...</p>
          </div>
        ) : (
          <ArticleTable
            articles={articles}
            onNewArticle={() => setShowNewModal(true)}
          />
        )}
      </div>

      {/* Modal placeholder — lo construimos mañana */}
      {showNewModal && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '8px', padding: '2rem',
            width: '100%', maxWidth: '500px', margin: '1rem'
          }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Nuevo Artículo</h2>
            <p style={{ color: '#999', fontSize: '0.9rem' }}>
              Lo construimos mañana — por ahora el modal abre correctamente ✅
            </p>
            <button
              onClick={() => setShowNewModal(false)}
              style={{
                marginTop: '1rem', padding: '0.6rem 1.2rem', backgroundColor: 'black',
                color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}