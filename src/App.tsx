import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { loadSettings } from './github/storage'
import type { GithubSettings } from './github/types'
import { HomePage } from './pages/HomePage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  // Bootstrap: silent localStorage read — no modal interrupt
  const [settings, setSettings] = useState<GithubSettings>(() => loadSettings())

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<HomePage settings={settings} />} />
        <Route
          path="/settings"
          element={<SettingsPage settings={settings} onSaved={setSettings} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
