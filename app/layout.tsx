import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tian-resume-studio.skylab.chatgpt.site").replace(
  /\/$/,
  "",
);
const title = "Quicky Resume";
const description =
  "Build a clear, job-ready resume with five research-backed layouts, smart one-page fitting, and PDF, PNG, or JPG export.";
const socialImage = `${siteUrl}/og.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  icons: {
    icon: [{ url: "/favicon.png", sizes: "64x64", type: "image/png" }],
  },
  openGraph: {
    title,
    description,
    type: "website",
    images: [{ url: socialImage, width: 1731, height: 909, alt: "Quicky Resume and its five professional layouts" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [socialImage],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
