import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Add new formatter functions:

export const formatCurrency = (value: number | null | undefined, placeholder: string = "R$ 0,00"): string => {
  if (value == null || isNaN(Number(value))) { // Added isNaN check for robustness
    return placeholder;
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value)); // Ensure value is number
};

export const formatNumber = (value: number | null | undefined, placeholder: string = "0"): string => {
  if (value == null || isNaN(Number(value))) {
    return placeholder;
  }
  return new Intl.NumberFormat("pt-BR").format(Number(value));
};

export const formatDate = (dateString: string | Date | null | undefined, placeholder: string = "N/A"): string => {
  if (!dateString) {
    return placeholder;
  }
  try {
    // Handle both string and Date objects
    const date = typeof dateString === 'string' ? new Date(dateString.split('T')[0]) : new Date(dateString);
    
    // Check if the date is valid after parsing
    if (isNaN(date.getTime())) {
      return placeholder;
    }
    
    return date.toLocaleDateString("pt-BR", {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (error) {
    console.error("Error formatting date:", dateString, error);
    return placeholder; // Return placeholder on error
  }
};

export const formatMonthYear = (dateString: string | null | undefined, placeholder: string = "N/A"): string => {
  if (!dateString || typeof dateString !== 'string' || !dateString.includes('-')) { 
    // Added check for string and presence of '-' for "YYYY-MM"
    return placeholder; 
  }
  try {
    const [year, month] = dateString.split('-');
    // Ensure year and month are valid numbers after split
    const numYear = Number(year);
    const numMonth = Number(month);

    if (isNaN(numYear) || isNaN(numMonth) || numMonth < 1 || numMonth > 12) {
      return placeholder;
    }

    const date = new Date(numYear, numMonth - 1); // Month is 0-indexed in Date constructor
    if (isNaN(date.getTime())) {
      return placeholder;
    }
    return date.toLocaleDateString("pt-BR", { month: 'long', year: 'numeric' });
  } catch (error) {
    console.error("Error formatting month/year:", dateString, error);
    return placeholder;
  }
};
