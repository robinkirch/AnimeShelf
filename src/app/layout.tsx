import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { AnimeShelfProvider } from '@/contexts/AnimeShelfContext';
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'AnimeShelf',
  description: 'Manage and track your anime series.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}>
        <AnimeShelfProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow container mx-auto p-4 md:p-6">
              {children}
            </main>
            <footer className="py-6 text-center text-muted-foreground text-sm">
              © {new Date().getFullYear()} AnimeShelf. All rights reserved.
            </footer>
          </div>
          <Toaster />
        </AnimeShelfProvider>
      </body>
    </html>
  );
}
