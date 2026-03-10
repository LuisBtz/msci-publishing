import { supabase } from '@/lib/supabase'

export default async function Home() {
  const { data, error } = await supabase.from('settings').select('key')

  return (
    <main style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>MSCI Publishing Platform</h1>
      {error && <p style={{ color: 'red' }}>Error: {error.message}</p>}
      {data && (
        <div>
          <p style={{ color: 'green' }}>✅ Supabase conectado correctamente</p>
          <p>Settings encontrados: {data.length}</p>
        </div>
      )}
    </main>
  )
}