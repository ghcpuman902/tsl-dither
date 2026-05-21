import { siteConfig } from "@/lib/site";

type JsonLdProps = {
  path?: string;
};

export const JsonLd = ({ path = "/" }: JsonLdProps) => {
  const url = `${siteConfig.url}${path === "/" ? "" : path}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    description: siteConfig.description,
    url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "In-browser image pipeline",
      "White-noise RGB dithering",
      "Tone and histogram controls",
      "Web Worker processing",
      "PNG export",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
};
