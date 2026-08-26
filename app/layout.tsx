import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://markneville.github.io/trusted-webmcp-actions/";
const title = "Trusted WebMCP Actions";
const description =
  "Verifiable authority for consequential browser-agent actions: bounded mandates, policy decisions, and auditable receipts.";
const socialImageUrl = `${siteUrl}social-preview.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: title,
    title,
    description,
    images: [
      {
        url: socialImageUrl,
        width: 1200,
        height: 630,
        alt: "Trusted WebMCP Actions authority flow with allowed and denied receipts",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [
      {
        url: socialImageUrl,
        alt: "Trusted WebMCP Actions authority flow with allowed and denied receipts",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
