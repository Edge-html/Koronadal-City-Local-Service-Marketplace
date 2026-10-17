import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ActivityProvider } from "@/context/ActivityContext";
import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

/** Substitutes for the FH Total Display didone used in the reference. */
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-display-face",
  display: "swap",
});

/** Substitutes for Geist: geometric, neutral, keeps the serif as the voice. */
const ui = Inter({
  subsets: ["latin"],
  variable: "--font-ui-face",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KoroHanap",
    template: "%s · KoroHanap",
  },
  description:
    "A verified marketplace connecting Koronadal City households with vetted, accountable blue-collar service professionals across ten essential service categories.",
  keywords: [
    "Koronadal",
    "local services",
    "carpentry",
    "plumbing",
    "electrical",
    "aircon repair",
    "masonry",
    "welding",
    "marketplace",
    "South Cotabato",
  ],
  applicationName: "KoroHanap",
  authors: [{ name: "KoroHanap" }],
  openGraph: {
    title: "KoroHanap",
    description:
      "Verified local trades. Transparent pricing. Direct payment to the worker.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ececea",
  width: "device-width",
  initialScale: 1,
};

/**
 * The system-ui stack is native, so it is exposed as a plain custom property
 * rather than a loaded webfont. Dense captions use it for tight -0.03em
 * tracking without paying for an extra font file.
 */
const systemFace = `--font-system-face: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable}`}>
      <head>
        {/* Set before paint so caption typography never flashes to a fallback. */}
        <style>{`:root{${systemFace}}`}</style>
      </head>
      <body style={{ fontVariationSettings: "normal" }}>
        <ErrorBoundary>
          <AuthProvider>
          <ActivityProvider>
            <div className="flex min-h-dvh flex-col">
              <SiteNav />
              <main className="flex-1">{children}</main>
              <SiteFooter />
            </div>
          </ActivityProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
