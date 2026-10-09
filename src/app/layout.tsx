import type { Metadata } from "next";
import { storeForShell } from "@/server/services/storefront";
import { site } from "@/lib/site";
import "@/styles/globals.css";
export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const store = await storeForShell();
  return {
    metadataBase: new URL(site.origin),
    title: {
      default: store.seo?.siteTitle || store.name,
      template: store.seo?.titleTemplate || `%s | ${store.name}`,
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
