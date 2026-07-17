import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import AI from './pages/AI'
import Stats from './pages/Stats'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Раньше "/" безусловно редиректил на "/login" — поэтому даже с активной
// сессией (кука есть) вы всегда попадали на форму входа при заходе на
// голый домен. Теперь сначала спрашиваем /api/me: если сессия жива —
// ведём на /home, если нет — на /login. Именно поэтому /home работал
// правильно (там такая проверка уже была), а "/" — нет.
function RootRedirect() {
  const [dest, setDest] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me`, { credentials: 'include' })
      .then(res => {
        if (cancelled) return
        setDest(res.ok ? '/home' : '/login')
      })
      .catch(() => {
        if (!cancelled) setDest('/login')
      })
    return () => { cancelled = true }
  }, [])

  if (!dest) return null // короткая пауза на один сетевой запрос, не критично
  return <Navigate to={dest} replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/home" element={<Home />} />
        <Route path="/ai" element={<AI />} />
        <Route path="/stats" element={<Stats />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
