import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge/dist/index";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
