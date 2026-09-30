/** Runtime configuration (Vite injects VITE_* variables at build time). */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
