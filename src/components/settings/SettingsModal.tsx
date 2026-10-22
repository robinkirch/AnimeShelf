
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
import { useI18n, type MessageKey } from '@/i18n/I18nContext';
import { getSecret, setSecret } from '@/lib/secrets';
import { LANGUAGES, LANGUAGE_LABELS, type Language } from '@/i18n/config';
import { useTheme } from '@/contexts/ThemeContext';
import { ImportExportModal } from '@/components/io/ImportExportModal';
import { KeyRound, Languages, Palette, ArrowRightLeft, Save, Moon, Sun, User, Image as ImageIcon, Upload } from 'lucide-react'; 
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
const API_KEY_HINT_KEYS: Record<AiProvider, MessageKey> = {
  gemini: 'settings.ai.keyHintGemini',
  anthropic: 'settings.ai.keyHintAnthropic',
};

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { userProfile, updateUserProfile: contextUpdateUserProfile, userProfileInitialized } = useAnimeShelf();
  const { toast } = useToast();
  const { t, language, setLanguage } = useI18n();

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
      // API keys are decrypted in the main process (safeStorage) and loaded asynchronously.
      Promise.all([getSecret(AI_STORAGE_KEYS.apiKey.gemini), getSecret(AI_STORAGE_KEYS.apiKey.anthropic)])
        .then(([gemini, anthropic]) => setApiKeys({ gemini: gemini ?? '', anthropic: anthropic ?? '' }))
        .catch(error => rendererLogger.error('Failed to load API keys.', { category: 'user-setting-error', error: String(error) }));
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

  const handleSaveAiSettings = async () => {
    try {
      await setSecret(AI_STORAGE_KEYS.apiKey[selectedProvider], apiKeys[selectedProvider].trim());
    } catch (error) {
      rendererLogger.error('Failed to store API key encrypted.', { category: 'user-setting-error', error: String(error) });
      toast({ variant: 'destructive', title: t('settings.ai.saveFailedTitle'), description: t('settings.ai.saveFailedDescription') });
      return;
    }
    localStorage.setItem(AI_STORAGE_KEYS.model, selectedAiModel.id);
    rendererLogger.info('AI search settings saved.', { category: 'user-setting-change', setting: 'ai-search', model: selectedAiModel.id });
    toast({
      title: t('settings.ai.savedTitle'),
      description: t('settings.ai.savedDescription', { model: selectedAiModel.label, provider: AI_PROVIDER_LABELS[selectedProvider] }),
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
      toast({ variant: "destructive", title: t('settings.profile.invalidFileTitle'), description: t('settings.profile.invalidFileDescription') });
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
    toast({ title: t('settings.profile.savedTitle'), description: t('settings.profile.savedDescription') });
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
               {t('settings.title')}
            </DialogTitle>
            <DialogDescription>
              {t('settings.description')}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="grow pr-3 -mr-3 my-2">
            <div className="space-y-6 py-2">
                {/* Profile Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><User className="h-5 w-5 text-primary" />{t('settings.profile.title')}</h3>
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src={previewProfilePic || undefined} alt={currentUsername || t('layout.userFallback')} />
                    <AvatarFallback className="text-2xl bg-muted">
                        {getInitials(currentUsername)}
                    </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 grow">
                    <Label htmlFor="profile-pic-upload">{t('settings.profile.picture')}</Label>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="w-full justify-start text-left">
                        <Upload className="mr-2 h-4 w-4" /> {newProfilePicFile ? newProfilePicFile.name : t('settings.profile.changePicture')}
                    </Button>
                    <Input 
                        id="profile-pic-upload" 
                        type="file" 
                        accept="image/*" 
                        onChange={handleProfilePicFileChange} 
                        className="hidden"
                        ref={fileInputRef}
                    />
                    <p className="text-xs text-muted-foreground">{t('settings.profile.pictureHint')}</p>
                    </div>
                </div>
                <div>
                    <Label htmlFor="username">{t('settings.profile.username')}</Label>
                    <Input
                    id="username"
                    value={currentUsername}
                    onChange={(e) => setCurrentUsername(e.target.value)}
                    placeholder={t('settings.profile.usernamePlaceholder')}
                    className="mt-1"
                    />
                </div>
                <Button onClick={handleSaveProfile} size="sm" className="w-full">
                    <Save className="mr-2 h-4 w-4" /> {t('settings.profile.save')}
                </Button>
                </div>

                <Separator />

                {/* AI Search Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />{t('settings.ai.title')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t('settings.ai.description')}
                </p>
                <div className="space-y-1">
                    <Label htmlFor="ai-model">{t('settings.ai.model')}</Label>
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
                    <p className="text-xs text-muted-foreground">{t(`settings.aiModelDescriptions.${selectedAiModel.descriptionKey}`)}</p>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="api-key">{t('settings.ai.apiKeyLabel', { provider: AI_PROVIDER_LABELS[selectedProvider] })}</Label>
                    <div className="flex items-center gap-2">
                    <Input
                        id="api-key"
                        type="password"
                        value={apiKeys[selectedProvider]}
                        onChange={(e) => setApiKeys(keys => ({ ...keys, [selectedProvider]: e.target.value }))}
                        placeholder={t('settings.ai.apiKeyPlaceholder', { provider: AI_PROVIDER_LABELS[selectedProvider] })}
                        className="grow"
                    />
                    <Button onClick={handleSaveAiSettings} size="sm">
                        <Save className="mr-2 h-4 w-4" /> {t('common.save')}
                    </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t(API_KEY_HINT_KEYS[selectedProvider])}</p>
                </div>
                </div>

                <Separator />

                {/* Language Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><Languages className="h-5 w-5 text-primary" />{t('settings.language.title')}</h3>
                <p className="text-xs text-muted-foreground">{t('settings.language.description')}</p>
                <div className="space-y-1">
                    <Label htmlFor="app-language">{t('settings.language.label')}</Label>
                    <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
                    <SelectTrigger id="app-language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {/* Language names are shown in their own language so they are recognizable in any UI language. */}
                        {LANGUAGES.map(lang => <SelectItem key={lang} value={lang}>{LANGUAGE_LABELS[lang]}</SelectItem>)}
                    </SelectContent>
                    </Select>
                </div>
                </div>

                <Separator />

                {/* Theme Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><Palette className="h-5 w-5 text-primary" />{t('settings.theme.title')}</h3>
                <div className="flex items-center justify-between">
                    <Label htmlFor="theme-toggle" className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                    <span>{theme === 'dark' ? t('settings.theme.dark') : t('settings.theme.light')}</span>
                    </Label>
                    <Switch
                    id="theme-toggle"
                    checked={theme === 'dark'}
                    onCheckedChange={handleThemeChange}
                    aria-label={t('settings.theme.toggle')}
                    />
                </div>
                </div>

                <Separator />

                {/* Data Management Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-xs">
                <h3 className="text-lg font-medium flex items-center gap-2"><ArrowRightLeft className="h-5 w-5 text-primary" />{t('settings.data.title')}</h3>
                <p className="text-xs text-muted-foreground">
                    {t('settings.data.description')}
                </p>
                <Button
                    variant="outline"
                    onClick={handleOpenImportExport}
                    className="w-full"
                >
                    <ArrowRightLeft className="mr-2 h-4 w-4" /> {t('settings.data.open')}
                </Button>
                </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-auto pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.close')}
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
