
"use client";

import React, { useState, useEffect, useRef } from 'react';
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AI_MODELS, AI_PROVIDER_LABELS, AI_STORAGE_KEYS, DEFAULT_AI_MODEL_ID, getAiModel, type AiProvider } from '@/ai/models';
import { useTheme } from '@/contexts/ThemeContext';
import { ImportExportModal } from '@/components/io/ImportExportModal';
import { KeyRound, Palette, ArrowRightLeft, Save, Moon, Sun, User, Image as ImageIcon, Upload } from 'lucide-react'; 
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils"; 
import { rendererLogger } from '@/lib/logger'; // Import renderer logger

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const AI_PROVIDERS = Object.keys(AI_PROVIDER_LABELS) as AiProvider[];
const API_KEY_HINTS: Record<AiProvider, string> = {
  gemini: 'Get a key at aistudio.google.com.',
  anthropic: 'Get a key at platform.claude.com.',
};

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { userProfile, updateUserProfile: contextUpdateUserProfile, userProfileInitialized } = useAnimeShelf();
  const { toast } = useToast();

  const [aiModelId, setAiModelId] = useState(DEFAULT_AI_MODEL_ID);
  const [apiKeys, setApiKeys] = useState<Record<AiProvider, string>>({ gemini: '', anthropic: '' });
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentProfilePic, setCurrentProfilePic] = useState<string | null>(null);
  const [newProfilePicFile, setNewProfilePicFile] = useState<File | null>(null);
  const [previewProfilePic, setPreviewProfilePic] = useState<string | null>(null);

  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      rendererLogger.info('SettingsModal opened.', { category: 'ui-event' });
      setAiModelId(getAiModel(localStorage.getItem(AI_STORAGE_KEYS.model))?.id ?? DEFAULT_AI_MODEL_ID);
      setApiKeys({
        gemini: localStorage.getItem(AI_STORAGE_KEYS.apiKey.gemini) ?? '',
        anthropic: localStorage.getItem(AI_STORAGE_KEYS.apiKey.anthropic) ?? '',
      });
      if (userProfileInitialized && userProfile) {
        setCurrentUsername(userProfile.username || '');
        setCurrentProfilePic(userProfile.profilePictureDataUri);
        setPreviewProfilePic(userProfile.profilePictureDataUri); 
      } else if (userProfileInitialized && !userProfile) {
        setCurrentUsername('');
        setCurrentProfilePic(null);
        setPreviewProfilePic(null);
      }
      setNewProfilePicFile(null); 
    }
  }, [isOpen, userProfile, userProfileInitialized]);

  const selectedAiModel = getAiModel(aiModelId) ?? getAiModel(DEFAULT_AI_MODEL_ID)!;
  const selectedProvider = selectedAiModel.provider;

  const handleSaveAiSettings = () => {
    localStorage.setItem(AI_STORAGE_KEYS.model, selectedAiModel.id);
    localStorage.setItem(AI_STORAGE_KEYS.apiKey[selectedProvider], apiKeys[selectedProvider].trim());
    rendererLogger.info('AI search settings saved.', { category: 'user-setting-change', setting: 'ai-search', model: selectedAiModel.id });
    toast({
      title: 'AI Settings Saved',
      description: `AI search now uses ${selectedAiModel.label}. Your ${AI_PROVIDER_LABELS[selectedProvider]} API key has been saved locally.`,
    });
  };

  const handleThemeChange = (isDark: boolean) => {
    const newTheme = isDark ? 'dark' : 'light';
    setTheme(newTheme);
    rendererLogger.info(`Theme changed to ${newTheme}.`, { category: 'user-setting-change', setting: 'theme', newTheme });
  };

  const handleProfilePicFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setNewProfilePicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
      rendererLogger.debug('New profile picture file selected for preview.', { category: 'ui-interaction', fileName: file.name, fileSize: file.size });
    } else if (file) {
      rendererLogger.warn('Invalid profile picture file type selected.', { category: 'user-input-error', fileName: file.name, fileType: file.type });
      toast({ variant: "destructive", title: "Invalid File", description: "Please select an image file." });
      setNewProfilePicFile(null);
      setPreviewProfilePic(currentProfilePic); 
    }
  };

  const handleSaveProfile = async () => {
    let newPicDataUri = currentProfilePic;
    if (newProfilePicFile) {
      newPicDataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(newProfilePicFile);
      });
    }
    
    await contextUpdateUserProfile({
      username: currentUsername.trim() || null, 
      profilePictureDataUri: newPicDataUri,
    });
    setCurrentProfilePic(newPicDataUri); 
    setNewProfilePicFile(null); 
    rendererLogger.info('User profile updated.', { category: 'user-setting-change', setting: 'profile', username: currentUsername.trim() || 'empty', hasNewPic: !!newProfilePicFile });
    toast({ title: "Profile Updated", description: "Your profile has been saved." });
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AS'; // AnimeShelf initials
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };

  const handleOpenImportExport = () => {
    rendererLogger.info('Import/Export modal opened from settings.', { category: 'ui-event' });
    onOpenChange(false); 
    setTimeout(() => setIsImportExportModalOpen(true), 150); 
  };


  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
               Application Settings
            </DialogTitle>
            <DialogDescription>
              Manage your profile, API key, theme, and data import/export settings.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="grow pr-3 -mr-3 my-2">
            <div className="space-y-6 py-2">
                {/* Profile Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><User className="h-5 w-5 text-primary" />Profile</h3>
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src={previewProfilePic || undefined} alt={currentUsername || "User"} />
                    <AvatarFallback className="text-2xl bg-muted">
                        {getInitials(currentUsername)}
                    </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 grow">
                    <Label htmlFor="profile-pic-upload">Profile Picture</Label>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full justify-start text-left">
                        <Upload className="mr-2 h-4 w-4" /> {newProfilePicFile ? newProfilePicFile.name : "Change Picture"}
                    </Button>
                    <Input 
                        id="profile-pic-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleProfilePicFileChange} 
                        className="hidden"
                        ref={fileInputRef}
                    />
                    <p className="text-xs text-muted-foreground">Click to upload an image (PNG, JPG, GIF).</p>
                    </div>
                </div>
                <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                    id="username"
                    value={currentUsername}
                    onChange={(e) => setCurrentUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="mt-1"
                    />
                </div>
                <Button onClick={handleSaveProfile} size="sm" className="w-full">
                    <Save className="mr-2 h-4 w-4" /> Save Profile
                </Button>
                </div>

                <Separator />

                {/* AI Search Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />AI Search</h3>
                <p className="text-xs text-muted-foreground">
                    Choose the AI model for the AI-powered search and enter the API key of its provider.
                    Keys are stored locally on this device and only sent to the selected provider.
                </p>
                <div className="space-y-1">
                    <Label htmlFor="ai-model">Model</Label>
                    <Select value={selectedAiModel.id} onValueChange={setAiModelId}>
                    <SelectTrigger id="ai-model"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {AI_PROVIDERS.map(provider => (
                        <SelectGroup key={provider}>
                            <SelectLabel>{AI_PROVIDER_LABELS[provider]}</SelectLabel>
                            {AI_MODELS.filter(model => model.provider === provider).map(model => (
                            <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
                            ))}
                        </SelectGroup>
                        ))}
                    </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{selectedAiModel.description}</p>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="api-key">{AI_PROVIDER_LABELS[selectedProvider]} API Key</Label>
                    <div className="flex items-center gap-2">
                    <Input
                        id="api-key"
                        type="password"
                        value={apiKeys[selectedProvider]}
                        onChange={(e) => setApiKeys(keys => ({ ...keys, [selectedProvider]: e.target.value }))}
                        placeholder={`Enter your ${AI_PROVIDER_LABELS[selectedProvider]} API key`}
                        className="grow"
                    />
                    <Button onClick={handleSaveAiSettings} size="sm">
                        <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{API_KEY_HINTS[selectedProvider]}</p>
                </div>
                </div>

                <Separator />

                {/* Theme Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
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
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />Data Management</h3>
                <p className="text-xs text-muted-foreground">
                    Import or export your anime shelf data using CSV files.
                </p>
                <Button
                    variant="outline"
                    onClick={handleOpenImportExport}
                    className="w-full"
                >
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> Open Import/Export
                </Button>
                </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onOpenChange={setIsImportExportModalOpen}
      />
    </>
  );
}

// Helper component for ScrollArea, can be co-located or imported
const ScrollArea = ({ className, children }: { className?: string; children: React.ReactNode }) => {
    return (
        <div className={cn("overflow-y-auto", className)}>
            {children}
        </div>
    );
};
