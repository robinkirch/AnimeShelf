
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
import { useTheme } from '@/contexts/ThemeContext';
import { ImportExportModal } from '@/components/io/ImportExportModal';
import { KeyRound, Palette, ArrowRightLeft, Save, Moon, Sun, User, Image as ImageIcon, Upload } from 'lucide-react'; 
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils"; // Import cn utility

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const API_KEY_STORAGE_KEY = 'geminiApiKey';

export function SettingsModal({ isOpen, onOpenChange }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const { userProfile, updateUserProfile: contextUpdateUserProfile, userProfileInitialized } = useAnimeShelf();
  const { toast } = useToast();

  const [apiKey, setApiKey] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentProfilePic, setCurrentProfilePic] = useState<string | null>(null);
  const [newProfilePicFile, setNewProfilePicFile] = useState<File | null>(null);
  const [previewProfilePic, setPreviewProfilePic] = useState<string | null>(null);

  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const storedApiKey = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (storedApiKey) {
        setApiKey(storedApiKey);
      }
      if (userProfileInitialized && userProfile) {
        setCurrentUsername(userProfile.username || '');
        setCurrentProfilePic(userProfile.profilePictureDataUri);
        setPreviewProfilePic(userProfile.profilePictureDataUri); // Initialize preview
      } else if (userProfileInitialized && !userProfile) {
        // Handle case where profile is initialized but null (e.g. first load error)
        setCurrentUsername('');
        setCurrentProfilePic(null);
        setPreviewProfilePic(null);
      }
      setNewProfilePicFile(null); // Reset file input on open
    }
  }, [isOpen, userProfile, userProfileInitialized]);

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

  const handleProfilePicFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setNewProfilePicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast({ variant: "destructive", title: "Invalid File", description: "Please select an image file." });
      setNewProfilePicFile(null);
      // Reset preview to current if invalid file is chosen
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
      username: currentUsername.trim() || null, // Store null if empty string
      profilePictureDataUri: newPicDataUri,
    });
    setCurrentProfilePic(newPicDataUri); // Update local state for current pic
    setNewProfilePicFile(null); // Clear staged file
    toast({ title: "Profile Updated", description: "Your profile has been saved." });
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AN'; // AnimeShelf initials
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
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

          <ScrollArea className="flex-grow pr-3 -mr-3 my-2">
            <div className="space-y-6 py-2">
                {/* Profile Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium flex items-center gap-2"><User className="h-5 w-5 text-primary" />Profile</h3>
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                    <AvatarImage src={previewProfilePic || undefined} alt={currentUsername || "User"} />
                    <AvatarFallback className="text-2xl bg-muted">
                        {getInitials(currentUsername)}
                    </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1 flex-grow">
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

                {/* API Key Section */}
                <div className="space-y-3 p-4 border rounded-lg shadow-sm">
                <h3 className="text-lg font-medium flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />API Key</h3>
                <p className="text-xs text-muted-foreground">
                    Enter your Google AI (Gemini) API key for features like AI-powered search.
                    The key is stored locally in your browser.
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
                    onOpenChange(false); 
                    setTimeout(() => setIsImportExportModalOpen(true), 150); 
                    }}
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

