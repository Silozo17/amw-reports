import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Strips country code prefix from a phone number and returns local format.
 * E.g. "+44 7911 123456" → "7911 123456", "+1 (555) 123-4567" → "(555) 123-4567"
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  // Remove the leading + and country code (1-3 digits followed by space/dash)
  const stripped = phone.replace(/^\+\d{1,3}[\s\-]?/, '').trim();
  return stripped || phone;
}
