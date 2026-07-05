import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ConfirmProvider } from "@/lib/confirm";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Garia Solutions Portal",
  description: "Garia Solutions client & admin portal",
};

const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem("garia_theme");if(t==="dark"||(!t&&false)){document.documentElement.classList.add("dark");}}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&family=JetBrains+Mono:wght@500&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="bg-bg-base text-text-main font-body-md min-h-screen overflow-x-hidden selection:bg-brand-green selection:text-on-brand-green transition-colors duration-200">
        <AuthProvider>
          <ConfirmProvider>
            {children}
            <Toaster />
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
