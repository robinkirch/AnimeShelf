import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Local cover shown when an anime has no image (works offline; remote placeholders would need next.config remotePatterns). */
export const COVER_PLACEHOLDER = '/cover-placeholder.svg';
