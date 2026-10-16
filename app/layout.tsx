import type { Metadata } from "next";
import "../src/styles/globals.css";
export const metadata: Metadata = { title: "AI Signal", description: "A quiet reader for your Gmail newsletters.", manifest: "/manifest.webmanifest", icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" } };
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#fcfbf8' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}<script src="https://accounts.google.com/gsi/client" async defer/><script src="/registerSW.js" defer/></body></html>; }
