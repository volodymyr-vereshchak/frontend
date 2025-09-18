import { ru } from './ru.js';
import { uk } from './uk.js';

export const translations = {
  ru,
  uk
};

export const defaultLanguage = 'ru';

export const languages = [
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'uk', name: 'Українська', flag: '🇺🇦' }
];

// Get translation function
export const getTranslation = (language, key) => {
  const lang = translations[language] || translations[defaultLanguage];
  return lang[key] || key;
};

// Get browser language or default
export const getBrowserLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;

  if (browserLang.startsWith('uk')) return 'uk';
  if (browserLang.startsWith('ru')) return 'ru';

  return defaultLanguage;
};

// Get saved language from localStorage or browser
export const getSavedLanguage = () => {
  const saved = localStorage.getItem('hlviewer-language');
  if (saved && translations[saved]) {
    return saved;
  }
  return getBrowserLanguage();
};

// Save language to localStorage
export const saveLanguage = (language) => {
  localStorage.setItem('hlviewer-language', language);
};

// Get locale for date formatting
export const getDateLocale = (language) => {
  switch (language) {
    case 'uk': return 'uk-UA';
    case 'ru': return 'ru-RU';
    default: return 'ru-RU';
  }
};