
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { ImportExportModal } from '@/components/io/ImportExportModal';
import { KeyRound, Palette, ArrowRightLeft, Save, Moon, Sun } from 'lucide-react'; // Changed ImportExport to ArrowRightLeft
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const API_KEY_STORAGE_KEY = 'geminiApiKey';

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [apiKey, setApiKey] = useState('');
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
    }
  }, [isOpen]);

  const handleSaveApiKey = () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    toast({
      title: 'API Key Saved',
      description: 'Your Gemini API key has been saved locally.',
    });
  };

  const handleThemeChange = (isDark: boolean) => {
    setTheme(isDark ? 'dark' : 'light');
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-6 w-6" /> Application Settings
            </DialogTitle>
            <DialogDescription>
              Manage your API key, theme, and data import/export settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* API Key Section */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
              <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />API Key</h3>
              <p className="text-xs text-muted-foreground">
                Enter your Google AI (Gemini) API key for features like AI-powered search.
                The key is stored locally in your browser and is not sent to any server other than Google AI.
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="api-key"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  className="flex-grow"
                />
                <Button onClick={handleSaveApiKey} size="sm">
                  <Save className="mr-2 h-4 w-4" /> Save Key
                </Button>
              </div>
            </div>

            <Separator />

            {/* Theme Section */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
              <h3 className="text-lg font-medium flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />Theme</h3>
              <div className="flex items-center justify-between">
                <Label htmlFor="theme-toggle" className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </Label>
                <Switch
                  id="theme-toggle"
                  checked={theme === 'dark'}
                  onCheckedChange={handleThemeChange}
                  aria-label="Toggle theme"
                />
              </div>
            </div>

            <Separator />

            {/* Data Management Section */}
            <div className="space-y-3 p-4 border rounded-lg shadow-sm">
              <h3 className="text-lg font-medium flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Data Management</h3>
              <p className="text-xs text-muted-foreground">
                Import or export your anime shelf data using CSV files.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  onOpenChange(false); // Close settings modal first
                  // Timeout to allow settings modal to close before opening import/export
                  setTimeout(() => setIsImportExportModalOpen(true), 150); 
                }}
                className="w-full"
              >
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Open Import/Export
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Render ImportExportModal separately, controlled by its own state */}
      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onOpenChange={setIsImportExportModalOpen}
      />
    </>
  );
}
