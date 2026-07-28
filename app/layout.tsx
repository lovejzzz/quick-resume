import type { Metadata } from "next";
import {
  EB_Garamond,
  Fira_Sans,
  Geist,
  Geist_Mono,
  IBM_Plex_Sans,
  Inter,
  Lato,
  Libre_Baskerville,
  Merriweather,
  Noto_Sans,
  Open_Sans,
  Roboto,
  Source_Sans_3,
} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const resumeInter = Inter({ variable: "--font-resume-inter", subsets: ["latin"] });
const resumeLato = Lato({ variable: "--font-resume-lato", subsets: ["latin"], weight: ["400", "700", "900"] });
const resumeRoboto = Roboto({ variable: "--font-resume-roboto", subsets: ["latin"], weight: ["400", "500", "700", "900"] });
const resumeOpenSans = Open_Sans({ variable: "--font-resume-open-sans", subsets: ["latin"] });
const resumeSourceSans = Source_Sans_3({ variable: "--font-resume-source-sans", subsets: ["latin"] });
const resumeNotoSans = Noto_Sans({ variable: "--font-resume-noto-sans", subsets: ["latin"] });
const resumeIbmPlex = IBM_Plex_Sans({ variable: "--font-resume-ibm-plex", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const resumeFiraSans = Fira_Sans({ variable: "--font-resume-fira-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const resumeMerriweather = Merriweather({ variable: "--font-resume-merriweather", subsets: ["latin"], weight: ["400", "700", "900"] });
const resumeLibreBaskerville = Libre_Baskerville({ variable: "--font-resume-libre-baskerville", subsets: ["latin"], weight: ["400", "700"] });
const resumeEbGaramond = EB_Garamond({ variable: "--font-resume-eb-garamond", subsets: ["latin"] });

const resumeFontVariables = [
  resumeInter.variable,
  resumeLato.variable,
  resumeRoboto.variable,
  resumeOpenSans.variable,
  resumeSourceSans.variable,
  resumeNotoSans.variable,
  resumeIbmPlex.variable,
  resumeFiraSans.variable,
  resumeMerriweather.variable,
  resumeLibreBaskerville.variable,
  resumeEbGaramond.variable,
].join(" ");

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://tian-resume-studio.skylab.chatgpt.site").replace(
  /\/$/,
  "",
);
const title = "Quicky Resume";
const description =
  "Build a clear, job-ready resume with five research-backed layouts, smart one-page fitting, and PDF, PNG, or JPG export.";
const socialImage = `${siteUrl}/og-editorial.png`;

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
    images: [{ url: socialImage, width: 1734, height: 907, alt: "Quicky Resume editorial glass resume editor" }],
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
      <body className={`${geistSans.variable} ${geistMono.variable} ${resumeFontVariables}`}>{children}</body>
    </html>
  );
}
