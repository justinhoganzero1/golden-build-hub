import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = "https://oraclelunar.com";
const DEFAULT_TITLE = "Oracle Lunar — AI Companion App with Voice, Story Writer & App Builder";
const DEFAULT_DESC =
  "Oracle Lunar is an AI companion app: talk to Oracle, your AI best friend, by voice, plus a story writer, app builder, pictures and music. Free download, 7-day trial.";
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
