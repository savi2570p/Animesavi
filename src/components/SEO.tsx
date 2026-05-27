import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description?: string;
  path?: string; // route path starting with "/"
  image?: string;
  type?: "website" | "article" | "video.episode" | "video.tv_show";
  jsonLd?: Record<string, any> | Record<string, any>[];
}

const SITE = "https://animesavi.com";

export function SEO({ title, description, path = "/", image, type = "website", jsonLd }: SEOProps) {
  const url = `${SITE}${path}`;
  const desc =
    description ??
    "Watch your favorite anime in official Hindi DUB on AnimeSavi. Episodes updated same day as release.";
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      {image && <meta property="og:image" content={image} />}
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={desc} />
      {image && <meta name="twitter:image" content={image} />}
      {ld &&
        ld.map((obj, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(obj)}
          </script>
        ))}
    </Helmet>
  );
}
