"use client";

import React from 'react';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { usePreview } from '@/contexts/PreviewContext';
import { RelatedAnimeCard } from '@/components/preview/RelatedAnimeCard';
import type { RelatedEntry } from '@/types/preview';
import { Loader2, CalendarDays, History, HelpCircle, ArchiveRestore, ListFilter, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { IgnoredPreviewList } from '@/components/preview/IgnoredPreviewList';

const LOADING_SKELETON_COUNT = 4;

const SECTION_IDS = {
  currentUpcoming: 'preview-current-upcoming',
  past: 'preview-past',
  ignored: 'preview-ignored',
} as const;

// The lookup itself runs globally in PreviewContext (from app start); this page only displays its state.
export default function PreviewPage() {
  const {
    shelf,
    isInitialized: shelfInitialized,
    ignoredPreviewAnimeMalIds,
    addIgnoredPreviewAnime,
    ignoredPreviewAnimeMalIdsInitialized
  } = useAnimeShelf();
  const { currentUpcoming, past, airingCount, primary, tenrai, enrichProgress, applyTenraiResults, retry } = usePreview();
  const { toast } = useToast();

  const isPrimaryLoading = primary.status === 'loading';

  const handleIgnorePreview = (mal_id: number, title: string) => {
    addIgnoredPreviewAnime(mal_id);
    toast({
      title: "Anime Hidden in Preview",
      description: `"${title}" will no longer be shown on this page.`,
    });
  };

  // Instant jump on purpose: during a smooth scroll the cards above still grow (covers, relation buttons),
  // which moves the target. After an instant jump the browser's scroll anchoring keeps the section in place.
  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'auto', block: 'start' });
  };

  // Skeletons fill exactly one grid row (1/2/3/4 columns depending on the breakpoint).
  const skeletonVisibility = ['', 'hidden sm:block', 'hidden md:block', 'hidden lg:block'];
  const renderSkeletons = (count: number) => (
    Array.from({ length: count }).map((_, index) => (
      <div key={index} className={`border rounded-lg p-4 space-y-3 bg-card shadow-sm ${skeletonVisibility[index] ?? ''}`}>
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full mt-2" />
      </div>
    ))
  );

  const renderSection = (id: string, title: string, description: string, IconComponent: React.ElementType, list: RelatedEntry[], emptyMessage: string) => (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-2">
        <IconComponent className="h-8 w-8 text-primary" />
        <h2 className="text-2xl font-semibold text-primary">
          {title} ({list.length}{isPrimaryLoading ? '+' : ''})
        </h2>
        {isPrimaryLoading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-sm text-muted-foreground mb-6">{description}</p>
      {list.length > 0 || isPrimaryLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {list.map(entry => (
            // The key includes whether full data is present, so applied Tenrai data replaces the card.
            <RelatedAnimeCard key={`${entry.mal_id}-${entry.details ? 'full' : 'light'}`} entry={entry} onIgnorePreview={handleIgnorePreview} />
          ))}
          {isPrimaryLoading && renderSkeletons(LOADING_SKELETON_COUNT)}
        </div>
      ) : (
        <div className="text-center py-10 bg-card p-6 rounded-lg shadow-xs border border-dashed">
          <ListFilter className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="mt-2 text-xl font-semibold text-muted-foreground">No Anime Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  );

  const renderTenraiStatus = () => {
    const progressValue = tenrai.total > 0 ? (tenrai.checked / tenrai.total) * 100 : 0;
    const failedNote = tenrai.failedCount > 0 ? ` (${tenrai.failedCount} could not be checked)` : '';
    let content: React.ReactNode;
    switch (tenrai.status) {
      case 'seasons':
        content = <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Tenrai cross-check: loading current and upcoming seasons...</span>;
        break;
      case 'running':
        content = (
          <div className="space-y-2">
            <div className="flex justify-between gap-4">
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />Tenrai cross-check: {tenrai.checked} / {tenrai.total} checked</span>
              <span className="shrink-0 font-medium text-foreground">{tenrai.newCount} new found</span>
            </div>
            <Progress value={progressValue} className="h-1.5" />
          </div>
        );
        break;
      case 'done': {
        const hasChanges = tenrai.newCount > 0 || tenrai.upgradeCount > 0;
        content = (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Tenrai cross-check complete: {tenrai.newCount} new {tenrai.newCount === 1 ? 'entry' : 'entries'} found
              {tenrai.upgradeCount > 0 && `, full data for ${tenrai.upgradeCount} current/upcoming`}{failedNote}.
            </span>
            {hasChanges && (
              <Button size="sm" onClick={applyTenraiResults}>
                <RefreshCw className="mr-2 h-4 w-4" /> Update
              </Button>
            )}
          </div>
        );
        break;
      }
      case 'applied':
        content = <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" />Tenrai cross-check complete, list is up to date{failedNote}.</span>;
        break;
      case 'error':
        content = (
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-destructive" />Tenrai cross-check failed.
            <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>Try again</Button>
          </span>
        );
        break;
    }
    return <div className="rounded-lg border bg-card p-3 text-sm text-muted-foreground" aria-live="polite">{content}</div>;
  };

  if (!shelfInitialized || !ignoredPreviewAnimeMalIdsInitialized) {
    return (
      <div className="space-y-10">
        <div className="flex items-center gap-3 mb-6"> <Skeleton className="h-8 w-8 rounded-full" /> <Skeleton className="h-8 w-56" /> </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">{renderSkeletons(4)}</div>
      </div>
    );
  }

  if (shelf.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center p-8 bg-card rounded-xl shadow-lg">
        <History className="h-20 w-20 text-primary mb-8" />
        <h2 className="text-3xl font-semibold mb-3">Your Shelf is Empty</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">
          Add some anime to your shelf first. Then, this page will show you exciting previews of upcoming seasons and other related shows!
        </p>
        <Button asChild size="lg">
          <a href="/">Go to My Shelf</a>
        </Button>
      </div>
    );
  }

  const summaryItems = [
    { id: SECTION_IDS.currentUpcoming, label: 'Current & Upcoming', detail: `${airingCount} airing now`, count: currentUpcoming.length, icon: CalendarDays, loading: isPrimaryLoading },
    { id: SECTION_IDS.past, label: 'Past Related', detail: 'already aired', count: past.length, icon: History, loading: isPrimaryLoading },
    { id: SECTION_IDS.ignored, label: 'Ignored', detail: 'hidden from preview', count: ignoredPreviewAnimeMalIds.length, icon: ArchiveRestore, loading: false },
  ];

  return (
    <div className="space-y-10">
      <header className="pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">Anime Preview</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Discover future seasons and other continuations for anime you're tracking. Add them to your plan-to-watch list or hide them from this view.
        </p>
      </header>

      <div className="space-y-3">
        <nav aria-label="Preview sections" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {summaryItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollToSection(item.id)}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-xs transition-colors hover:border-primary hover:bg-accent/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            >
              <item.icon className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0">
                <div className="text-2xl font-bold leading-none">
                  {item.count}{item.loading ? '+' : ''}
                </div>
                <div className="mt-1 text-sm font-medium">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              </div>
            </button>
          ))}
        </nav>

        {isPrimaryLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            Finding related anime via AniList...
            {primary.totalBatches > 0 && ` (${primary.doneBatches} / ${primary.totalBatches})`}
          </div>
        )}

        {enrichProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading full data for current & upcoming anime... ({enrichProgress.done} / {enrichProgress.total})
          </div>
        )}

        {primary.status === 'error' && (
          <Alert variant="destructive">
            <HelpCircle className="h-5 w-5" />
            <AlertTitle>AniList is not reachable</AlertTitle>
            <AlertDescription>Results will be shown as soon as the Tenrai cross-check below is complete.</AlertDescription>
          </Alert>
        )}

        {renderTenraiStatus()}
      </div>

      {renderSection(
        SECTION_IDS.currentUpcoming,
        'Current & Upcoming',
        'Related anime that are airing this season or have been announced (including entries without a date yet).',
        CalendarDays,
        currentUpcoming,
        'No related anime airing now or announced (or all are hidden).',
      )}

      <Separator className="my-10" />

      {renderSection(
        SECTION_IDS.past,
        'Past Related',
        'Already aired sequels, prequels and side stories you have not added yet. Load details to add one to your shelf.',
        History,
        past,
        'No past related anime found (or all are hidden).',
      )}

      <Separator className="my-12" />

      <section id={SECTION_IDS.ignored} className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-6">
          <ArchiveRestore className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-semibold text-primary">Ignored in Preview ({ignoredPreviewAnimeMalIds.length})</h2>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          Anime you've chosen to hide from the main preview sections. They will still appear in "My Shelf" and "Seasonal" if applicable.
        </p>
        <IgnoredPreviewList />
      </section>
    </div>
  );
}
