# MSCI Research Publishing Platform

Plataforma interna para el equipo de publicación web de MSCI Research. Automatiza el proceso de ingesta, organización y preparación de contenido editorial para su publicación en AEM (Adobe Experience Manager) en `msci.com`.

---

## Tabla de contenido

1. [Descripción general](#descripción-general)
2. [Stack tecnológico](#stack-tecnológico)
3. [Prerequisitos](#prerequisitos)
4. [Instalación y configuración local](#instalación-y-configuración-local)
5. [Variables de entorno](#variables-de-entorno)
6. [Estructura del proyecto](#estructura-del-proyecto)
7. [Base de datos](#base-de-datos)
8. [Autenticación y roles](#autenticación-y-roles)
9. [Funcionalidades](#funcionalidades)
10. [Tipos de contenido](#tipos-de-contenido)
11. [Reglas de links](#reglas-de-links)
12. [Integración con SharePoint](#integración-con-sharepoint)
13. [Integración con Claude API](#integración-con-claude-api)
14. [Deploy en Vercel](#deploy-en-vercel)
15. [Roadmap](#roadmap)

---

## Descripción general

El equipo de publicación web de MSCI recibe documentos de intake en formato `.docx` desde SharePoint para cada pieza de contenido de Research (blog posts, papers, quick takes y podcasts). El proceso manual de extraer la información, organizarla y pasarla a AEM es lento y propenso a errores.

Esta plataforma automatiza ese proceso:

1. El editor pega el link de la carpeta de SharePoint del proyecto
2. La app localiza automáticamente el documento de intake (`.docx` con "package" en el nombre)
3. Claude API parsea el documento y extrae todos los campos estructurados
4. La app busca banners y exhibits en las subcarpetas de SharePoint
5. Claude genera alt text para cada imagen
6. Se validan automáticamente las páginas de contributor de los autores en `msci.com`
7. El editor revisa, ajusta y copia el contenido campo por campo a AEM
8. Al publicar, la app puede hacer QA automático de la URL publicada

---

## Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Next.js | 14 (App Router) |
| Estilos | Tailwind CSS | 3 |
| Auth + Base de datos | Supabase | Latest |
| Hosting | Vercel | - |
| IA | Claude API (Anthropic) | claude-sonnet-4-6 |
| SharePoint | Microsoft Graph API | v1.0 |

---

## Prerequisitos

Antes de instalar el proyecto necesitas tener:

- **Node.js** v18 o superior → [nodejs.org](https://nodejs.org)
- **Git** → [git-scm.com](https://git-scm.com)
- **VS Code** (recomendado) → [code.visualstudio.com](https://code.visualstudio.com)
- Cuenta en **Supabase** → [supabase.com](https://supabase.com)
- Cuenta en **Vercel** → [vercel.com](https://vercel.com)
- Cuenta en **Anthropic Console** → [console.anthropic.com](https://console.anthropic.com)
- App registrada en **Azure AD** con permisos `Files.Read.All` y `Sites.Read.All`

---

## Instalación y configuración local

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/msci-publishing.git
cd msci-publishing
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

Crea el archivo `.env.local` en la raíz del proyecto (ver sección de variables de entorno).

### 4. Configurar la base de datos

Copia y ejecuta el SQL del archivo `supabase/schema.sql` en el SQL Editor de tu proyecto de Supabase.

### 5. Correr el proyecto

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

---

## Variables de entorno

Crea un archivo `.env.local` en la raíz con los siguientes valores:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key

# Anthropic (Claude API)
ANTHROPIC_API_KEY=tu_api_key

# Microsoft Graph API (SharePoint)
AZURE_CLIENT_ID=tu_client_id
AZURE_CLIENT_SECRET=tu_client_secret
AZURE_TENANT_ID=tu_tenant_id
```

> ⚠️ El archivo `.env.local` está en `.gitignore` y nunca se sube a GitHub.

---

## Estructura del proyecto

```
msci-publishing/
├── app/
│   ├── login/
│   │   └── page.js              # Página de login
│   ├── dashboard/
│   │   ├── page.js              # Dashboard principal
│   │   └── components/
│   │       ├── Header.js        # Header con logout
│   │       ├── ArticleTable.js  # Tabla de artículos con filtros
│   │       └── NewArticleModal.js # Modal para crear artículo
│   ├── articles/
│   │   └── [id]/
│   │       ├── page.js          # Vista de artículo (tabs)
│   │       └── components/
│   │           ├── TabOverview.js
│   │           ├── TabContent.js
│   │           ├── TabTags.js
│   │           ├── TabAssets.js
│   │           ├── TabRelated.js
│   │           └── TabPreview.js
│   ├── settings/
│   │   └── page.js              # Configuración (solo admin)
│   └── auth/
│       └── callback/
│           └── route.js         # Callback de auth
├── lib/
│   ├── supabase.js              # Cliente Supabase (browser)
│   ├── supabase-server.js       # Cliente Supabase (server)
│   └── useAuth.js               # Hook de protección de rutas
├── middleware.js                # Middleware Next.js
└── .env.local                   # Variables de entorno (no en git)
```

---

## Base de datos

### Tablas

#### `profiles`
Información adicional de usuarios (complementa `auth.users` de Supabase).

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | FK a auth.users |
| full_name | text | Nombre completo |
| role | text | `admin` o `editor` |
| created_at | timestamp | Fecha de creación |

#### `articles`
Tabla principal de artículos de research.

| Campo | Tipo | Descripción |
|---|---|---|
| id | uuid | PK generado automáticamente |
| created_by | uuid | FK a profiles |
| assigned_to | uuid | FK a profiles |
| type | text | `blog-post`, `paper`, `quick-take`, `podcast` |
| status | text | `in-progress`, `in-review`, `approved`, `published` |
| headline | text | Título del artículo |
| slug | text | URL-friendly del título (único) |
| final_url | text | URL final en msci.com |
| meta_description | text | Meta description (campo "Our latest research" del intake) |
| read_time | text | Tiempo de lectura |
| publish_date | date | Fecha de publicación (manual) |
| bullets | jsonb | Array de 3 bullet points |
| body_blocks | jsonb | Array de bloques de contenido (texto y exhibits) |
| footnotes | jsonb | Array de footnotes numerados |
| sharepoint_folder_url | text | URL de la carpeta en SharePoint |
| banner_paths | jsonb | Paths de banners por ratio |
| exhibit_paths | jsonb | Paths de exhibits con alt text y caption |
| tags | jsonb | Tags seleccionados por categoría |
| authors | jsonb | Autores con URL de contributor validada |
| related_resources | jsonb | Related content con CTA labels |
| export_json | jsonb | JSON exportable para futura integración AEM |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Última actualización (auto) |
| published_at | timestamp | Fecha de publicación |

#### `settings`
Configuración global de la plataforma.

| Key | Descripción |
|---|---|
| `link_rules` | Reglas de transformación de URLs para AEM |
| `tags_taxonomy` | Taxonomía completa de tags por categoría |
| `content_types_config` | Configuración por tipo de contenido |

---

## Autenticación y roles

### Login
- Email + contraseña via Supabase Auth
- SSO con Microsoft (Azure AD) — Fase 2

### Roles

| Rol | Permisos |
|---|---|
| `admin` | Acceso total + Settings + gestión de usuarios |
| `editor` | Crear, editar y eliminar sus propios artículos |

### Protección de rutas
La protección se maneja con el hook `useAuth` en cada página protegida:

```javascript
const { user, loading } = useAuth()
```

Si no hay sesión activa, redirige automáticamente a `/login`.

---

## Funcionalidades

### Dashboard
- Lista de todos los artículos en formato de tabla
- Búsqueda por título
- Filtros por tipo (Blog Post, Paper, Quick Take, Podcast)
- Filtros por estado (En proceso, En revisión, Aprobado, Publicado)
- Badges de color por tipo y estado
- Botón "+ New Article" para crear desde SharePoint link

### Crear artículo desde SharePoint
1. Pegar el link de la carpeta del proyecto en SharePoint
2. La app localiza el `.docx` con "package" en el nombre
3. Claude API parsea el documento y extrae todos los campos
4. La app busca banners en `/Banners/webp/` y exhibits en `/Charts/` y `/Exhibits/`
5. Claude genera alt text para cada imagen
6. Se validan URLs de contributor para cada autor
7. Se crea la entrada en Supabase y redirige a la vista del artículo

### Vista de artículo (6 tabs)

#### Tab: Overview
- Headline editable
- Slug (auto-generado del headline)
- URL final copiable con un click
- Meta description con contador de caracteres
- Read time
- Fecha de publicación (editable manualmente)
- Estado (dropdown para cambiar)
- Autores con badges de validación ✅ / ❌

#### Tab: Content
- Bullets copiables como grupo
- Body dividido en bloques de texto y exhibits
- Cada bloque de texto tiene botón "Copy HTML" para pegar directo en el RTE de AEM
- H2 y párrafos con estilos preservados
- Links transformados según reglas de AEM
- Footnotes como `<sup>N</sup>` inline en el texto
- Exhibits con título H3, imagen de SharePoint, alt text editable y caption
- Sección de footnotes al final con HTML copiable (cursivas y links preservados)

#### Tab: Tags
- Checkboxes organizados por categoría:
  - Asset Class
  - Format
  - Line of Business
  - Theme
  - Topic
  - Marketing Programs
  - Campaigns
  - Type
- Campo copiable con todos los tags seleccionados separados por coma
- Un solo click copia todos para pegarlos en el searchbox de AEM

#### Tab: Assets
- Grid de banners con su ratio (16x9, 1x1, 3x4, 4x3, 9x16)
- Path de SharePoint copiable por banner
- Lista de exhibits con alt text generado por Claude (editable)
- Botón para regenerar alt text con Claude

#### Tab: Related Content
- Cards con título, meta description, URL AEM y CTA label
- CTA label editable (Read more / Learn more / Explore more)
- URL AEM copiable por card
- Botón "Export JSON" — descarga el JSON completo del artículo

#### Tab: Preview
- Réplica visual fiel del blog post en msci.com
- Layout idéntico: breadcrumb, título, tipo, read time, autores, key findings, body, related resources, footnotes
- Toggle desktop / mobile
- Disclaimer legal al fondo

### Settings (solo Admin)
- **Link Rules** — tabla editable con reglas de transformación de URLs
- **Tags Taxonomy** — editor por categoría para agregar, editar y eliminar tags
- **Users** — lista de usuarios, cambiar roles, invitar por email

---

## Tipos de contenido

### Blog Post
- Sin PDF descargable
- URL: `/research-and-insights/blog-post/[slug]`
- Campos específicos: Read time, Three bullet points, Body copy completo

### Paper *(Fase 2)*
- Con PDF descargable
- URL: `/research-and-insights/paper/[slug]`
- Campos específicos: Intro copy (preview), PDF en SharePoint

### Quick Take *(Fase 3)*
- URL: `/research-and-insights/quick-take/[slug]`

### Podcast *(Fase 3)*
- URL: `/research-and-insights/podcast/[slug]`

---

## Reglas de links

Configurables desde Settings → Link Rules. Se aplican al procesar el body del artículo.

| Patrón | Transformación | Ejemplo |
|---|---|---|
| `msci.com/indexes/` (sin ID numérico) | Relativa `/content/ipc/us/en/indexes/` | `/content/ipc/us/en/indexes/private-asset-indexes/...` |
| Cualquier otra URL de `msci.com` | Relativa `/content/msci/us/en/` | `/content/msci/us/en/research-and-insights/...` |
| `msci.com/indexes/index/[ID]` | Absoluta | `https://www.msci.com/indexes/index/664204` |
| `support.msci.com` | Absoluta siempre | `https://support.msci.com/...` |
| URLs externas | Absoluta + `target="_blank"` | `https://www.wsj.com/...` |

---

## Integración con SharePoint

La app usa Microsoft Graph API para leer archivos de SharePoint sin descargarlos.

### Estructura de carpetas esperada
```
RE-XXXX-[tipo]-[título]/
├── Banners/
│   └── webp/
│       ├── 16x9_1600x900px-[nombre].webp
│       ├── 16x9_3200x1800px-[nombre].webp
│       ├── 1x1_900x900px-[nombre].webp
│       ├── 3x4_900x1200px-[nombre].webp
│       ├── 4x3_1200x900px-[nombre].webp
│       └── 9x16_900x1600px-[nombre].webp
├── Charts/                      # o Exhibits/
│   ├── exhibit1.svg
│   └── exhibit2.svg
└── [título] package [version].docx
```

### Configuración de Azure AD
1. Registrar app en Azure AD → App registrations
2. Agregar permisos: `Files.Read.All`, `Sites.Read.All`
3. Crear Client Secret
4. Guardar Client ID, Tenant ID y Client Secret en `.env.local`

---

## Integración con Claude API

Se usa `claude-sonnet-4-6` para tres funciones principales:

### 1. Parseo del documento de intake
Extrae todos los campos estructurados del `.docx` y los devuelve como JSON.

### 2. Generación de alt text
Para cada imagen de SharePoint genera una descripción accesible de máximo 125 caracteres.

### 3. Sugerencia de CTA labels
Para cada related resource determina el CTA más apropiado:
- `Read more` → blog posts y papers
- `Learn more` → podcasts y contenido educativo
- `Explore more` → productos, índices y frameworks

---

## Deploy en Vercel

### Primer deploy
1. Conectar el repositorio de GitHub en Vercel
2. Agregar todas las variables de entorno en Vercel → Settings → Environment Variables
3. Deploy automático en cada push a `main`

### URL de producción
La app está disponible en la URL de Vercel asignada al proyecto.

---

## Roadmap

### ✅ Fase 1 — Completada
- Setup del proyecto (Next.js, Supabase, Vercel)
- Sistema de login y roles
- Dashboard con filtros y búsqueda

### 🔄 Fase 2 — En desarrollo
- Integración con SharePoint via Microsoft Graph API
- Parseo automático del `.docx` con Claude API
- Vista de artículo completa (6 tabs)
- Preview fiel a msci.com
- Settings (Link Rules, Tags, Users)

### 📋 Fase 3 — Pendiente
- Soporte para Paper, Quick Take y Podcast
- QA post-publicación (análisis de URL publicada)
- SSO con Microsoft (Azure AD)
- Export JSON para integración directa con AEM

---

## Equipo

| Nombre | Rol | Email |
|---|---|---|
| Luis Benitez | Admin / Developer | luis.benitez@msci.com |
| Donato | Editor | - |

---

## Notas importantes

- Las imágenes **nunca se guardan** en la base de datos — solo se guardan los paths de SharePoint
- El archivo `.env.local` nunca debe subirse a GitHub
- El campo `export_json` en cada artículo contiene un snapshot completo listo para futura integración directa con AEM via API
- La fecha de publicación es siempre manual — el editor decide cuándo publicar