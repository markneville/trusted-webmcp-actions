import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trusted WebMCP Actions",
  description: "A clean-room reference control room for bounded WebMCP actions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
