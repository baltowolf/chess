import { signal } from '@angular/core';

export type Language = 'ru' | 'en';

const currentLang = signal<Language>(
  (typeof localStorage !== 'undefined' && localStorage.getItem('app-lang') as Language) || 'ru'
);

export const language = {
  get: () => currentLang(),
  set: (lang: Language) => {
    currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('app-lang', lang);
    }
  },
  toggle: () => {
    const next = currentLang() === 'ru' ? 'en' : 'ru';
    language.set(next);
  },
  isRu: () => currentLang() === 'ru',
  isEn: () => currentLang() === 'en',
  
  // Translation helper
  t: (ru: string, en: string) => {
    return currentLang() === 'ru' ? ru : en;
  }
};
