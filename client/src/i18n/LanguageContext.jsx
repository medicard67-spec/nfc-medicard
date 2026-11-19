import { createContext, useContext, useState } from "react";
import { getLanguage, loadLanguage, setLanguageValue } from "./index.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(getLanguage);

  // fetch the language's phrases first, then switch (stays on the current language if offline)
  const changeLanguage = async (code) => {
    try {
      await loadLanguage(code);
    } catch {
      return;
    }
    setLanguageValue(code);
    setLang(code);
  };

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
