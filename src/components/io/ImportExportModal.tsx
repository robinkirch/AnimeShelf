
'use client';
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExportSection } from './ExportSection';
import { ImportCsvSection } from './ImportCsvSection';
import { ArrowLeft } from 'lucide-react';

interface ImportExportModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type ModalView = 'main' | 'import' | 'export';

export function ImportExportModal({ isOpen, onOpenChange }: ImportExportModalProps) {
  const [view, setView] = useState<ModalView>('main');

  const handleClose = () => {
    onOpenChange(false);
    // Delay resetting view to allow dialog close animation to finish
    setTimeout(() => setView('main'), 300); 
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {view === 'main' && 'Import / Export Data'}
            {view === 'import' && 'Import from CSV'}
            {view === 'export' && 'Export to CSV'}
          </DialogTitle>
          <DialogDescription>
            {view === 'main' && 'Choose an action to manage your anime shelf data.'}
            {view === 'import' && 'Upload a CSV file to import anime to your shelf.'}
            {view === 'export' && 'Download your current anime shelf as a CSV file.'}
          </DialogDescription>
        </DialogHeader>

        {view === 'main' && (
          <div className="grid gap-4 py-4">
            <Button onClick={() => setView('import')} variant="outline" className="w-full">Import Data</Button>
            <Button onClick={() => setView('export')} variant="outline" className="w-full">Export Data</Button>
          </div>
        )}

        {view === 'import' && <ImportCsvSection onImported={() => { /* Future: Show success message or auto-close */ }} />}
        {view === 'export' && <ExportSection />}

        <DialogFooter className="mt-4">
          {view !== 'main' && (
            <Button variant="ghost" onClick={() => setView('main')} className="mr-auto">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            {view === 'main' ? 'Close' : (view === 'import' && 'Done') || 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
