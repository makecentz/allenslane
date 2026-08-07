import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const socialImage = `${protocol}://${host}/og.png`;
  const siteUrl = `${protocol}://${host}`;
  const title = "Allens Lane Art Center | Inspiring Creativity and Culture";
  const description = "Classes, performances, exhibitions, summer camp, and community arts in Mount Airy, Philadelphia.";

  return {
    metadataBase: new URL(siteUrl),
    title,
    description,
    icons: { icon: "/images/logo-footer.png" },
    alternates: { canonical: "/" },
    openGraph: { title, description, type: "website", url: siteUrl, siteName: "Allens Lane Art Center", images: [{ url: socialImage, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [socialImage] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
