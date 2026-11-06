import { useEffect, useState } from "react";
import { loadSettings, saveSettings, type AppSettings } from "./lib/storage";
import { HomeScreen } from "./screens/HomeScreen";
import { NewSessionScreen } from "./screens/NewSessionScreen";
import { SessionScreen } from "./screens/SessionScreen";
import { SettingsScreen } from "./screens/SettingsScreen";

function useHashRoute(): string {
  const [route, setRoute] = useState(() => location.hash.slice(1) || "/");
  useEffect(() => {
    const onChange = () => {
      setRoute(location.hash.slice(1) || "/");
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  location.hash = path;
}

export function App() {
  const route = useHashRoute();
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const updateSettings = (s: AppSettings) => {
    saveSettings(s);
    setSettings(s);
  };

  let screen;
  const sessionMatch = route.match(/^\/session\/([\w-]+)$/);
  if (route === "/new") screen = <NewSessionScreen settings={settings} />;
  else if (route === "/settings") screen = <SettingsScreen settings={settings} onSave={updateSettings} />;
  else if (sessionMatch) screen = <SessionScreen key={sessionMatch[1]} id={sessionMatch[1]} settings={settings} />;
  else screen = <HomeScreen settings={settings} />;

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">
          <img src="icon.svg" alt="" width={28} height={28} />
          HabitWrite
        </a>
        <nav>
          <a href="#/new" className={route === "/new" ? "active" : ""}>Latihan baru</a>
          <a href="#/settings" className={route === "/settings" ? "active" : ""}>Pengaturan</a>
        </nav>
      </header>
      <main>{screen}</main>
    </div>
  );
}
