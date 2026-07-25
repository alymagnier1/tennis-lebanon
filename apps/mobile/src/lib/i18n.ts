import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_LOCALE, resources } from "@tennis-lebanon/i18n";

const i18next = createInstance();

i18next.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  interpolation: { escapeValue: false },
  compatibilityJSON: "v4",
});

export { i18next };
