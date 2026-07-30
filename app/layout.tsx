import type { Metadata, Viewport } from "next";
import {
  EB_Garamond,
  Fira_Sans,
  Geist,
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
import localFont from "next/font/local";
import { ServiceWorker } from "./components/ServiceWorker";
import { assetPath } from "./lib/asset-path";
import "./globals.css";

/**
 * Only the interface font is preloaded. The 11 resume families below are
 * opt-in: `preload: false` emits the `@font-face` rule without a preload hint,
 * so a family is fetched the first time a user actually selects it instead of
 * costing every visitor ~560 KB on first paint.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

/**
 * The wordmark face, subset to just the glyphs in "Quicky Resume" (1.71 MB TTF
 * down to 16 KB woff2). Licence note: HVD Peace permits modification provided
 * the unmodified readme ships alongside it (see app/fonts/HvdPeace-Readme.txt)
 * and the designer attribution stays in the font metadata, which the subset
 * preserves.
 */
const hvdPeace = localFont({
  src: "./fonts/hvd-peace-wordmark.woff2",
  variable: "--font-hvd-peace",
  display: "swap",
  weight: "400",
  style: "normal",
});

const resumeInter = Inter({ subsets: ["latin"], preload: false, variable: "--font-resume-inter" });
const resumeLato = Lato({ subsets: ["latin"], preload: false, variable: "--font-resume-lato", weight: ["400", "700", "900"] });
const resumeRoboto = Roboto({ subsets: ["latin"], preload: false, variable: "--font-resume-roboto", weight: ["400", "500", "700", "900"] });
const resumeOpenSans = Open_Sans({ subsets: ["latin"], preload: false, variable: "--font-resume-open-sans" });
const resumeSourceSans = Source_Sans_3({ subsets: ["latin"], preload: false, variable: "--font-resume-source-sans" });
const resumeNotoSans = Noto_Sans({ subsets: ["latin"], preload: false, variable: "--font-resume-noto-sans" });
const resumeIbmPlex = IBM_Plex_Sans({ subsets: ["latin"], preload: false, variable: "--font-resume-ibm-plex", weight: ["400", "500", "600", "700"] });
const resumeFiraSans = Fira_Sans({ subsets: ["latin"], preload: false, variable: "--font-resume-fira-sans", weight: ["400", "500", "600", "700"] });
const resumeMerriweather = Merriweather({ subsets: ["latin"], preload: false, variable: "--font-resume-merriweather", weight: ["400", "700", "900"] });
const resumeLibreBaskerville = Libre_Baskerville({ subsets: ["latin"], preload: false, variable: "--font-resume-libre-baskerville", weight: ["400", "700"] });
const resumeEbGaramond = EB_Garamond({ subsets: ["latin"], preload: false, variable: "--font-resume-eb-garamond" });

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

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://quickyresume.com").replace(/\/$/, "");
const title = "Quicky Resume";
const description =
  "Build a clear, job-ready resume with five research-backed layouts, smart one-page fitting, keyword matching, and PDF, PNG, or JPG export. Everything stays in your browser.";
const socialImage = `${siteUrl}${assetPath("/og-editorial.jpg")}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: title,
  icons: { icon: [{ url: assetPath("/favicon.png"), sizes: "64x64", type: "image/png" }] },
  manifest: assetPath("/manifest.webmanifest"),
  openGraph: {
    title,
    description,
    type: "website",
    url: siteUrl,
    images: [{ url: socialImage, width: 1200, height: 628, alt: "The Quicky Resume editor" }],
  },
  twitter: { card: "summary_large_image", title, description, images: [socialImage] },
};

export const viewport: Viewport = {
  themeColor: "#28605d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta
          content="default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self'; img-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; media-src 'self' blob:"
          httpEquiv="Content-Security-Policy"
        />
        <meta content="no-referrer" name="referrer" />
      </head>
      <body className={`${geistSans.variable} ${hvdPeace.variable} ${resumeFontVariables}`}>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
