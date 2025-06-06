
import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { AnimeShelfProvider } from '@/contexts/AnimeShelfContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FooterYear } from '@/components/layout/FooterYear';
import { Toaster } from "@/components/ui/toaster";
import { ProfileSetupManager } from '@/components/profile/ProfileSetupModal'; 
import { rendererLogger } from '@/lib/logger'; // Import renderer logger

export const metadata: Metadata = {
  title: 'AnimeShelf',
  description: 'Manage and track your anime series.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      rendererLogger.error('Unhandled Renderer Error:', { 
        category: 'renderer-error', 
        message: event.message, 
        filename: event.filename, 
        lineno: event.lineno, 
        colno: event.colno,
        error: event.error?.toString(),
        stack: event.error?.stack 
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      rendererLogger.error('Unhandled Renderer Rejection:', { 
        category: 'renderer-rejection', 
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });
  }


  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <ThemeProvider>
          <AnimeShelfProvider>
            <ProfileSetupManager /> 
            <div className="flex flex-col min-h-screen">
              <Header />
              <main className="flex-grow container mx-auto p-4 md:p-6">
                {children}
              </main>
              <footer className="py-6 text-center text-muted-foreground text-sm">
                © <FooterYear /> AnimeShelf. All rights reserved.
              </footer>
            </div>
            <Toaster />
          </AnimeShelfProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
