import React, { createContext, useContext, useState, useEffect } from 'react';
import { getSavedLanguage, saveLanguage, getTranslation, getDateLocale } from '../locales';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState(getSavedLanguage);

  const changeLanguage = (newLanguage) => {
    setCurrentLanguage(newLanguage);
    saveLanguage(newLanguage);
  };

  const t = (key) => getTranslation(currentLanguage, key);

  const getLocale = () => getDateLocale(currentLanguage);

  const value = {
    currentLanguage,
    changeLanguage,
    t,
    getLocale
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};