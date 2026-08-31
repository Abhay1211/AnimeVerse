import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Verse",
  description: "Discover your next story.",
};

// `viewport-fit=cover` is what makes the `env(safe-area-inset-*)` values
// used across the app (bottom nav, watch page, player controls) resolve to
// real numbers on notched iOS devices. It has no effect on desktop/Android
// without a cutout, so it introduces no extra spacing there.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
