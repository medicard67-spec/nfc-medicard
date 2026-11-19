import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { UnreadProvider } from "./context/UnreadContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext.jsx";
import { getLanguage, loadLanguage } from "./i18n/index.js";
import "./index.css";

// Re-mount the app when the language changes so every screen redraws in the new language.
function LocalisedApp() {
  const { lang } = useLanguage();
  return <App key={lang} />;
}

// Draw once the chosen language's phrases are in (instant for English).
loadLanguage(getLanguage()).catch(() => {}).finally(() => ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <UnreadProvider>
                <NotificationsProvider>
                  <LocalisedApp />
                </NotificationsProvider>
              </UnreadProvider>
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>
));
