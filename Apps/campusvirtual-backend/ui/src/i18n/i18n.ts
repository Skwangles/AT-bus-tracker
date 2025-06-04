import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import zhCNCommon from './locales/zh-CN/common.json';
import zhTWCommon from './locales/zh-TW/common.json';
import daCommon from './locales/da/common.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
      },
      es: {
        common: esCommon,
      },
      'zh-CN': {
        common: zhCNCommon,
      },
      'zh-TW': {
        common: zhTWCommon,
      },
      da: {
        common: daCommon,
      }
    },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n; 