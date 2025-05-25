
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

  const handleImportFinished = () => {
    // This function can be used to potentially switch the view or close the modal
    // For now, we'll just keep the import view open so the user can see results.
    // User can click "Done" or "Back" to navigate.
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl lg:max-w-2xl flex flex-col max-h-[90vh]">
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
        
        <div className={`flex-grow overflow-y-auto ${view !== 'main' ? 'py-2' : ''}`}>
            {view === 'import' && <ImportCsvSection onImported={handleImportFinished} />}
            {view === 'export' && <ExportSection />}
        </div>


        <DialogFooter className="mt-auto pt-4 border-t">
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

