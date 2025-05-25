
"use client";
import Link from 'next/link';
import { Clapperboard, Settings, UserCircle2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from 'react';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Header() {
  const pathname = usePathname();
  const { getFilteredUpcomingSequelsCount, userProfile, userProfileInitialized } = useAnimeShelf();
  const [mounted, setMounted] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const upcomingCount = getFilteredUpcomingSequelsCount();

  const navLinkClasses = (path: string) =>
    cn(
      "hover:text-accent-foreground transition-colors px-3 py-2 rounded-md text-sm font-medium relative",
      pathname === path ? "bg-accent text-accent-foreground" : "text-primary-foreground hover:bg-primary/80"
    );
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '';
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };


  if (!mounted || !userProfileInitialized) {
    // Render a placeholder or skeleton while waiting for client-side mount and profile initialization
    return (
      <header className="bg-primary text-primary-foreground sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold md:text-xl">
            <Clapperboard size={28} className="text-accent-foreground" />
            <span>AnimeShelf</span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Placeholder for nav links */}
            <div className="h-8 w-20 bg-primary/50 rounded-md animate-pulse"></div>
            <div className="h-8 w-24 bg-primary/50 rounded-md animate-pulse"></div>
            <div className="h-8 w-20 bg-primary/50 rounded-md animate-pulse"></div>
            <div className="h-8 w-16 bg-primary/50 rounded-md animate-pulse"></div>
            {/* Placeholder for settings and profile */}
            <div className="h-8 w-8 bg-primary/50 rounded-full animate-pulse ml-2"></div>
            <div className="h-8 w-8 bg-primary/50 rounded-full animate-pulse"></div>
          </div>
        </div>
      </header>
    );
  }


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
            <Link href="/stats" className={navLinkClasses("/stats")}>
              Stats
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSettingsModalOpen(true)}
              aria-label="Open Settings"
              className="text-primary-foreground hover:bg-primary/80 hover:text-accent-foreground ml-2"
            >
              <Settings size={20} />
            </Button>
            <div className="flex items-center gap-2 pl-2 border-l border-primary-foreground/30 ml-2">
                <Avatar className="h-8 w-8 cursor-pointer" onClick={() => setIsSettingsModalOpen(true)}>
                    <AvatarImage src={userProfile?.profilePictureDataUri || undefined} alt={userProfile?.username || "User"} />
                    <AvatarFallback className="bg-primary/70 text-xs">
                        {userProfile?.username ? getInitials(userProfile.username) : <UserCircle2 size={20}/>}
                    </AvatarFallback>
                </Avatar>
                {userProfile?.username && (
                    <span className="text-sm font-medium hidden md:inline cursor-pointer" onClick={() => setIsSettingsModalOpen(true)}>
                        {userProfile.username}
                    </span>
                )}
            </div>
          </nav>
        </div>
      </header>
      <SettingsModal isOpen={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen} />
    </>
  );
}
