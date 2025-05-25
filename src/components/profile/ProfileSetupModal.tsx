
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAnimeShelf } from '@/contexts/AnimeShelfContext';
import { useToast } from '@/hooks/use-toast';
import { User, Upload, Save } from 'lucide-react';

interface ProfileSetupModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void; // To allow context to close it
}

export function ProfileSetupModal({ isOpen, onOpenChange }: ProfileSetupModalProps) {
  const { updateUserProfile, markProfileSetupComplete } = useAnimeShelf();
  const { toast } = useToast();

  const [username, setUsername] = useState('');
  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [previewProfilePic, setPreviewProfilePic] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProfilePicFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setProfilePicFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else if (file) {
      toast({ variant: "destructive", title: "Invalid File", description: "Please select an image file." });
      setProfilePicFile(null);
      setPreviewProfilePic(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!username.trim()) {
      toast({ variant: "destructive", title: "Username Required", description: "Please enter a username." });
      return;
    }

    let picDataUri: string | null = null;
    if (profilePicFile) {
      picDataUri = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(profilePicFile);
      });
    }

    try {
      await updateUserProfile({
        username: username.trim(),
        profilePictureDataUri: picDataUri,
      });
      await markProfileSetupComplete();
      toast({ title: "Profile Setup Complete!", description: "Welcome to AnimeShelf!" });
      onOpenChange(false); // Close the modal
    } catch (error) {
      console.error("Error saving profile:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not save your profile. Please try again." });
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'AN';
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        // Prevent closing via overlay click or Escape key if setup isn't "complete" yet
        // This modal is controlled by ProfileSetupManager based on context state.
        // If the user *must* complete setup, onOpenChange(false) should only be called on save.
        // For now, allow normal close, context will re-open if needed.
        if (!open) onOpenChange(false);
    }}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><User className="h-6 w-6 text-primary" />Welcome to AnimeShelf!</DialogTitle>
          <DialogDescription>
            Let's set up your profile. You can change these details later in Settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-24 w-24">
              <AvatarImage src={previewProfilePic || undefined} alt={username || "User"} />
              <AvatarFallback className="text-3xl bg-muted">
                {username ? getInitials(username) : <User size={40}/>}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> {profilePicFile ? profilePicFile.name : "Upload Picture"}
            </Button>
            <Input 
              id="profile-pic-upload-setup" 
              type="file" 
              accept="image/*" 
              onChange={handleProfilePicFileChange} 
              className="hidden"
              ref={fileInputRef}
            />
          </div>
          <div>
            <Label htmlFor="username-setup">Username <span className="text-destructive">*</span></Label>
            <Input
              id="username-setup"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSaveProfile} className="w-full">
            <Save className="mr-2 h-4 w-4" /> Save Profile & Get Started
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// This new component will manage the visibility of ProfileSetupModal
// It should be placed in your layout or a top-level client component.
export function ProfileSetupManager() {
  const { userProfile, userProfileInitialized } = useAnimeShelf();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (userProfileInitialized && userProfile && !userProfile.profileSetupComplete) {
      setIsModalOpen(true);
    } else {
      setIsModalOpen(false);
    }
  }, [userProfile, userProfileInitialized]);

  return <ProfileSetupModal isOpen={isModalOpen} onOpenChange={setIsModalOpen} />;
}
