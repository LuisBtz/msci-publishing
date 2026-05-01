import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import TabPreview from "@/app/articles/[id]/components/TabPreview";

// Public Supabase client — anon key only, no auth required
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export async function generateMetadata({ params }) {
  const { id } = await params
  const { data } = await supabase
    .from("articles")
    .select("headline, meta_description")
    .eq("id", id)
    .single();

  if (!data) return { title: "Preview" };

  return {
    title: `Preview — ${data.headline}`,
    description: data.meta_description || "",
    // Prevent search engines from indexing preview URLs
    robots: { index: false, follow: false },
  };
}

export default async function PreviewPage({ params }) {
  const { id } = await params
  const { data: article, error } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !article) notFound();

  return (
    <div>
      {/* Banner visible solo en preview — no forma parte del contenido publicado */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        background: "#1a1a2e",
        color: "#a0aec0",
        fontSize: "12px",
        padding: "8px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{
            background: "#f6ad55",
            color: "#1a1a2e",
            fontWeight: 600,
            fontSize: "10px",
            padding: "2px 8px",
            borderRadius: "20px",
            letterSpacing: "0.05em",
          }}>PREVIEW</span>
          This is a preview link — not published on msci.com
        </span>
        <span style={{ color: "#718096" }}>
          Status: <strong style={{ color: "#f6ad55" }}>{article.status}</strong>
        </span>
      </div>

      <TabPreview article={article} />
    </div>
  );
}