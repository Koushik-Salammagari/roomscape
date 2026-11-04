import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/jetbrains-mono/index.css";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { FreshBuild } from "@/components/FreshBuild";

export const metadata: Metadata = {
  title: "Roomscape",
  description:
    "Scan any room and Roomscape turns it into a treasure hunt, with clues hidden in your own things.",
  applicationName: "Roomscape",
  appleWebApp: { capable: true, title: "Roomscape", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#141a3a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="lost-treasure">
      <body className="antialiased">
        <ToastProvider>
          <FreshBuild />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
