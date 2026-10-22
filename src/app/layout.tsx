
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Header } from '@/components/layout/Header';
import { AnimeShelfProvider } from '@/contexts/AnimeShelfContext';
import { PreviewProvider } from '@/contexts/PreviewContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Footer } from '@/components/layout/FooterYear';
import { I18nProvider } from '@/i18n/I18nContext';
import { LANGUAGE_COOKIE, normalizeLanguage } from '@/i18n/config';
import { Toaster } from "@/components/ui/toaster";
import { UpdateNotifier } from '@/components/layout/UpdateNotifier';
import { ProfileSetupManager } from '@/components/profile/ProfileSetupModal'; 
import { GlobalErrorListeners } from '@/components/layout/GlobalErrorListeners';

export const metadata: Metadata = {
  title: 'AnimeShelf',
  description: 'Manage and track your anime series.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The language is read from a cookie on the server so the app renders in the saved language right away
  // (no flash of English on start). Missing or unknown values fall back to English.
  const language = normalizeLanguage((await cookies()).get(LANGUAGE_COOKIE)?.value);

  return (
    <html lang={language} suppressHydrationWarning>
      <body className={`${GeistSans.variable} font-sans antialiased`}>
        <GlobalErrorListeners />
        <I18nProvider initialLanguage={language}>
        <ThemeProvider>
          <AnimeShelfProvider>
            {/* Runs the related-anime lookup globally in the background (preview page + header badge). */}
            <PreviewProvider>
              <ProfileSetupManager /> 
              <div className="flex flex-col min-h-screen">
                <Header />
                <main className="grow container mx-auto p-4 md:p-6">
                  {children}
                </main>
                <Footer />
              </div>
              <Toaster />
              <UpdateNotifier />
            </PreviewProvider>
          </AnimeShelfProvider>
        </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
