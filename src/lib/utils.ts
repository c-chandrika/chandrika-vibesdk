import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getPreviewUrl(previewURL?: string, tunnelURL?: string): string {
    // Prefer tunnel URL if available (especially for local dev with USE_TUNNEL_FOR_PREVIEW=true)
    // Tunnel URLs work reliably, while previewURL from exposePort() may not match routing patterns
    if (tunnelURL) {
        return tunnelURL;
    }
    return previewURL || '';
}

export function capitalizeFirstLetter(str: string) {
  if (typeof str !== 'string' || str.length === 0) {
    return str; // Handle non-string input or empty string
  }
  return str.charAt(0).toUpperCase() + str.slice(1);
}