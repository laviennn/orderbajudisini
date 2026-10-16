import type { Metadata } from "next";
import { storeForShell } from "@/server/services/storefront";
import { site } from "@/lib/site";
import "@/styles/globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const store = await storeForShell();
  const defaultImage = store.seo?.defaultOgImage;
  return {
    metadataBase: new URL(site.origin),
    title: {
      default: store.seo?.siteTitle || store.name,
      template: store.seo?.titleTemplate || `%s | ${store.name}`,
    },
    description: store.seo?.defaultDescription || undefined,
    openGraph: {
      title: store.seo?.siteTitle || store.name,
      description: store.seo?.defaultDescription || undefined,
      url: site.origin,
      siteName: store.name,
      type: "website",
      ...(defaultImage && /^https?:\/\//.test(defaultImage)
        ? { images: [defaultImage] }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: store.seo?.siteTitle || store.name,
      description: store.seo?.defaultDescription || undefined,
      ...(defaultImage ? { images: [defaultImage] } : {}),
    },
    ...(store.details?.faviconUrl
      ? { icons: { icon: store.details.faviconUrl } }
      : {}),
  };
}
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>
        <a className="skip-link" href="#main-content">
          Langsung ke konten
        </a>
        {children}
      </body>
    </html>
  );
}
