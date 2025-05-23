"use client";
import Link from 'next/link';
import { Clapperboard, Moon, Sun, ArrowRightLeft, LineChart } from 'lucide-react'; // Added LineChart
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from 'react';
import { ImportExportModal } from '@/components/io/ImportExportModal';

export function Header() {
  const pathname = usePathname();
  const { getFilteredUpcomingSequelsCount } = useAnimeShelf();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);


  useEffect(() => {
    setMounted(true);
  }, []);

  const upcomingCount = getFilteredUpcomingSequelsCount();

  const navLinkClasses = (path: string) =>
    cn(
      "hover:text-accent-foreground transition-colors px-3 py-2 rounded-md text-sm font-medium relative",
      pathname === path ? "bg-accent text-accent-foreground" : "text-primary-foreground hover:bg-primary/80"
    );

  return (
    <>
      <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <Clapperboard size={28} className="text-accent-foreground" />
            <span>AnimeShelf</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/" className={navLinkClasses("/")}>
              My Shelf
            </Link>
            <Link href="/seasonal" className={navLinkClasses("/seasonal")}>
              Seasonal
            </Link>
            <Link href="/preview" className={navLinkClasses("/preview")}>
              Preview
              {upcomingCount > 0 && (
                <Badge variant="destructive" className="absolute -top-1 -right-2 h-5 min-w-[1.25rem] p-0 flex items-center justify-center text-xs">
                  {upcomingCount > 99 ? '99+' : upcomingCount}
                </Badge>
              )}
            </Link>
            <Link href="/stats" className={navLinkClasses("/stats")}> {/* Added Stats link */}
              Stats
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsImportExportModalOpen(true)}
              aria-label="Import/Export Data"
              className="text-primary-foreground hover:bg-primary/80 hover:text-accent-foreground ml-2"
            >
              <ArrowRightLeft size={20} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="text-primary-foreground hover:bg-primary/80 hover:text-accent-foreground ml-2"
            >
              {mounted ? (theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />) : <Moon size={20} /> }
            </Button>
          </nav>
        </div>
      </header>
      <ImportExportModal isOpen={isImportExportModalOpen} onOpenChange={setIsImportExportModalOpen} />
    </>
  );
}
