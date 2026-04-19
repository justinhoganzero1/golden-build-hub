import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = "https://oracle-lunar.online";
const DEFAULT_TITLE = "ORACLE LUNAR — AI Companion App for Wellness, Safety & Productivity";
const DEFAULT_DESC =
  "ORACLE LUNAR is the all-in-one AI companion app: voice oracle, AI tutor, mind hub, crisis support, photography, marketing, and more. Free to start.";
const DEFAULT_IMAGE = `${SITE}/icons/icon-512.png`;

export default function SEO({
  title,
  description = DEFAULT_DESC,
  path = "/",
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
}: SEOProps) {
  const fullTitle = title ? `${title} | ORACLE LUNAR` : DEFAULT_TITLE;
  const url = `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="ORACLE LUNAR" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
