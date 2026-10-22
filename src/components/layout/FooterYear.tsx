
"use client";

import { useState, useEffect } from 'react';
import { useI18n } from '@/i18n/I18nContext';

export function FooterYear() {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  if (year === null) {
    // Return null or a placeholder before client-side hydration and effect runs
    // This avoids content mismatch between server and client initial render
    return null; 
  }

  return <>{year}</>;
}

// The layout is a server component, so the translated footer text lives here.
export function Footer() {
  const { t } = useI18n();
  return (
    <footer className="py-6 text-center text-muted-foreground text-sm">
      © <FooterYear /> AnimeShelf. {t('layout.allRightsReserved')}
    </footer>
  );
}
