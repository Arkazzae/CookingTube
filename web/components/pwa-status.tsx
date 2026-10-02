"use client";
import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { useAppLocale } from "@/hooks/use-app-locale";
import "./recipe-features.css";
type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaStatus() {
  const locale = useAppLocale();
  const copy = pwaCopy[locale];
  const [offline, setOffline] = useState(false);
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [help, setHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [workerError, setWorkerError] = useState(false);
  useEffect(() => {
    const update = () => { setOffline(!navigator.onLine); setInstalled(matchMedia("(display-mode: standalone)").matches); };
    const ready = (event: Event) => { event.preventDefault(); setInstall(event as InstallEvent); };
    const done = () => { setInstalled(true); setInstall(null); };
    update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", ready); window.addEventListener("appinstalled", done);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => setWorkerError(true));
    }
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); window.removeEventListener("beforeinstallprompt", ready); window.removeEventListener("appinstalled", done); };
  }, []);
  async function requestInstall() {
    if (!install) { setHelp(value => !value); return; }
    try { await install.prompt(); await install.userChoice; setInstall(null); }
    catch { setHelp(true); }
  }
  return <div className="pwa-status">
    {offline && <p role="status"><WifiOff size={16} /> {copy.offline}</p>}
    {!installed && <button className="text-action" onClick={() => void requestInstall()}><Download size={16} /> {copy.install}</button>}
    {help && <p role="status">{copy.help}</p>}
    {workerError && <p role="status">{copy.error}</p>}
  </div>;
}

const pwaCopy = {
 pl: { offline: "Jesteś offline. Zapisane przepisy są dostępne na urządzeniu. Film i głosowanie wymagają internetu.", install: "Zainstaluj aplikację", help: "Na iPhonie wybierz Udostępnij → Dodaj do ekranu początkowego w Safari. Na Androidzie i komputerze wybierz Zainstaluj aplikację w menu przeglądarki, jeśli ta opcja jest dostępna.", error: "Nie udało się włączyć trybu offline. Odśwież stronę, gdy masz połączenie z internetem." },
 en: { offline: "You're offline. Saved recipes are available on this device. Videos and voting need an internet connection.", install: "Install app", help: "On iPhone, choose Share → Add to Home Screen in Safari. On Android and desktop, choose Install app in your browser menu if available.", error: "Offline mode could not be enabled. Refresh the page when you have an internet connection." },
};
