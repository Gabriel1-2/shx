import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SolanaProvider } from "@/components/SolanaProvider";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";

const mono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SHX Exchange | Swap Anything on Solana",
  description: "The agent-native DEX on Solana. Best routes, lowest fees, zero KYC. Swap, earn yield, and trade — powered by Jupiter Ultra.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SHX",
  },
  openGraph: {
    title: "SHX Exchange",
    description: "The agent-native DEX on Solana. Best routes, lowest fees, zero KYC.",
    type: "website",
    url: "https://shx.exchange",
  },
  twitter: {
    card: "summary",
    title: "SHX Exchange",
    description: "Swap anything on Solana with the lowest fees.",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#22c55e",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={mono.className} suppressHydrationWarning>
        <SolanaProvider>
          <ToastProvider>
            <Header />
            {children}
            <ServiceWorkerRegistration />
          </ToastProvider>
        </SolanaProvider>
      </body>
    </html>
  );
}
