'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Header from './components/Header'
import ArticleTable from './components/ArticleTable'
import NewArticleModal from './components/NewArticleModal'

export default function Dashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
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

  const deleteArticle = async (id) => {
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (!error) {
      setArticles(prev => prev.filter(a => a.id !== id))
    }
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <p style={{ color: '#999', letterSpacing: '-0.02em', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F4F5FD' }}>
      <Header user={user} />

      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{
            margin: 0,
            fontSize: '28px',
            fontWeight: '600',
            letterSpacing: '-0.04em',
            color: '#000',
          }}>
            Research Articles
          </h1>
          <p style={{
            marginTop: '4px',
            fontSize: '14px',
            color: '#707070',
            letterSpacing: '-0.02em',
          }}>
            Manage and publish MSCI Research content
          </p>
        </div>

        {loadingArticles ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '18px',
            border: '1px solid #E6E6E6',
            padding: '3rem',
            textAlign: 'center',
          }}>
            <p style={{ color: '#999', fontSize: '14px', letterSpacing: '-0.02em' }}>
              Loading articles...
            </p>
          </div>
        ) : (
          <ArticleTable
            articles={articles}
            onNewArticle={() => setShowNewModal(true)}
            onDelete={deleteArticle}
          />
        )}
      </div>

      {showNewModal && (
        <NewArticleModal onClose={() => setShowNewModal(false)} />
      )}
    </div>
  )
}
