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
import { useI18n } from '@/i18n/I18nContext';

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
  const { t } = useI18n();

  const isPrimaryLoading = primary.status === 'loading';

  const handleIgnorePreview = (mal_id: number, title: string) => {
    addIgnoredPreviewAnime(mal_id);
    toast({
      title: t('preview.hiddenToastTitle'),
      description: t('preview.hiddenToastDescription', { title }),
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
          <h3 className="mt-2 text-xl font-semibold text-muted-foreground">{t('preview.noAnimeFound')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      )}
    </section>
  );

  const renderTenraiStatus = () => {
    const progressValue = tenrai.total > 0 ? (tenrai.checked / tenrai.total) * 100 : 0;
    const failedNote = tenrai.failedCount > 0 ? t('preview.tenrai.failedNote', { count: tenrai.failedCount }) : '';
    let content: React.ReactNode;
    switch (tenrai.status) {
      case 'seasons':
        content = <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />{t('preview.tenrai.loadingSeasons')}</span>;
        break;
      case 'running':
        content = (
          <div className="space-y-2">
            <div className="flex justify-between gap-4">
              <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 shrink-0 animate-spin" />{t('preview.tenrai.progress', { checked: tenrai.checked, total: tenrai.total })}</span>
              <span className="shrink-0 font-medium text-foreground">{t('preview.tenrai.newFound', { count: tenrai.newCount })}</span>
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
              {t('preview.tenrai.complete', { count: tenrai.newCount })}
              {tenrai.upgradeCount > 0 && t('preview.tenrai.fullData', { count: tenrai.upgradeCount })}{failedNote}.
            </span>
            {hasChanges && (
              <Button size="sm" onClick={applyTenraiResults}>
                <RefreshCw className="mr-2 h-4 w-4" /> {t('preview.tenrai.update')}
              </Button>
            )}
          </div>
        );
        break;
      }
      case 'applied':
        content = <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-accent" />{t('preview.tenrai.upToDate')}{failedNote}.</span>;
        break;
      case 'error':
        content = (
          <span className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-destructive" />{t('preview.tenrai.failed')}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={retry}>{t('preview.tenrai.tryAgain')}</Button>
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
        <h2 className="text-3xl font-semibold mb-3">{t('preview.emptyShelfTitle')}</h2>
        <p className="text-lg text-muted-foreground mb-6 max-w-md">
          {t('preview.emptyShelfDescription')}
        </p>
        <Button asChild size="lg">
          <a href="/">{t('preview.goToShelf')}</a>
        </Button>
      </div>
    );
  }

  const summaryItems = [
    { id: SECTION_IDS.currentUpcoming, label: t('preview.summary.currentUpcoming'), detail: t('preview.summary.airingNow', { count: airingCount }), count: currentUpcoming.length, icon: CalendarDays, loading: isPrimaryLoading },
    { id: SECTION_IDS.past, label: t('preview.summary.past'), detail: t('preview.summary.alreadyAired'), count: past.length, icon: History, loading: isPrimaryLoading },
    { id: SECTION_IDS.ignored, label: t('preview.summary.ignored'), detail: t('preview.summary.hidden'), count: ignoredPreviewAnimeMalIds.length, icon: ArchiveRestore, loading: false },
  ];

  return (
    <div className="space-y-10">
      <header className="pb-2">
        <h1 className="text-4xl font-bold tracking-tight text-primary mb-2">{t('preview.title')}</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          {t('preview.subtitle')}
        </p>
      </header>

      <div className="space-y-3">
        <nav aria-label={t('preview.sectionsLabel')} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            {t('preview.findingViaAniList')}
{primary.totalBatches > 0 && ` (${primary.doneBatches} / ${primary.totalBatches})`}
          </div>
        )}

        {enrichProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('preview.loadingFullData', { done: enrichProgress.done, total: enrichProgress.total })}
          </div>
        )}

        {primary.status === 'error' && (
          <Alert variant="destructive">
            <HelpCircle className="h-5 w-5" />
            <AlertTitle>{t('preview.aniListUnreachableTitle')}</AlertTitle>
            <AlertDescription>{t('preview.aniListUnreachableDescription')}</AlertDescription>
          </Alert>
        )}

        {renderTenraiStatus()}
      </div>

      {renderSection(
        SECTION_IDS.currentUpcoming,
        t('preview.currentUpcoming.title'),
        t('preview.currentUpcoming.description'),
        CalendarDays,
        currentUpcoming,
        t('preview.currentUpcoming.empty'),
      )}

      <Separator className="my-10" />

      {renderSection(
        SECTION_IDS.past,
        t('preview.past.title'),
        t('preview.past.description'),
        History,
        past,
        t('preview.past.empty'),
      )}

      <Separator className="my-12" />

      <section id={SECTION_IDS.ignored} className="scroll-mt-24">
        <div className="flex items-center gap-3 mb-6">
          <ArchiveRestore className="h-8 w-8 text-primary" />
          <h2 className="text-2xl font-semibold text-primary">{t('preview.ignoredTitle', { count: ignoredPreviewAnimeMalIds.length })}</h2>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          {t('preview.ignoredDescription')}
        </p>
        <IgnoredPreviewList />
      </section>
    </div>
  );
}
