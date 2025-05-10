
"use client";
import Link from 'next/link';
import { Clapperboard } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Badge } from "@/components/ui/badge";
import React from 'react';

export function Header() {
  const pathname = usePathname();
  const { getFilteredUpcomingSequelsCount } = useAnimeShelf(); 

  const upcomingCount = getFilteredUpcomingSequelsCount();


  const navLinkClasses = (path: string) =>
    cn(
      "hover:text-accent-foreground transition-colors px-3 py-2 rounded-md text-sm font-medium relative",
      pathname === path ? "bg-accent text-accent-foreground" : "text-primary-foreground hover:bg-primary/80"
    );

  return (
    <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:text-xl">
          <Clapperboard size={28} className="text-accent-foreground" />
          <span>AnimeShelf</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
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
        </nav>
      </div>
    </header>
  );
}

