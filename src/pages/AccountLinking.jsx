import { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Те же значения, что в Login.jsx — вынесите в общий файл констант,
// чтобы не дублировать при следующем изменении.
const GOOGLE_CLIENT_ID = '893384076518-hvbeo0vsqrs42lepoj5ip57qgdnfe4jb.apps.googleusercontent.com'
const TELEGRAM_BOT_ID = '8814230092'

/**
 * Блок "Привязанные способы входа" для страницы настроек аккаунта.
 * Показывает текущее состояние (что уже привязано) и позволяет
 * привязать/отвязать Google и Telegram к УЖЕ залогиненному аккаунту.
 *
 * Важно: cookie с JWT шлётся автоматически (credentials: 'include'),
 * бэкенд сам достаёт, кто сейчас залогинен — специально передавать
 * login никуда не нужно и не следует.
 */
function AccountLinking() {
  const [providers, setProviders] = useState(null) // { has_password, has_google, has_telegram, email, telegram_username }
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const googleTokenClientRef = useRef(null)

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/account/providers`, {
        credentials: 'include'
      })
      if (res.ok) {
        setProviders(await res.json())
      }
    } catch (e) {
      setError('Не удалось загрузить статус привязок')
    }
  }

  useEffect(() => {
    loadProviders()
  }, [])

  // ─── Google: тот же initTokenClient, что и в Login.jsx ───
  useEffect(() => {
    const scriptId = 'google-identity-services'
    if (document.getElementById(scriptId)) {
      initGoogleClient()
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = initGoogleClient
    document.body.appendChild(script)

    function initGoogleClient() {
      if (!window.google?.accounts?.oauth2) return
      googleTokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          setGoogleLoading(true)
          setError('')
          try {
            const res = await fetch(`${API_BASE}/api/account/link/google`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accessToken: tokenResponse.access_token })
            })
            const text = await res.text()
            if (res.ok) {
              await loadProviders()
            } else {
              setError(text)
            }
          } catch (e) {
            setError('Сервер недоступен')
          } finally {
            setGoogleLoading(false)
          }
        }
      })
    }
  }, [])

  const handleLinkGoogle = () => {
    if (!googleTokenClientRef.current) return
    googleTokenClientRef.current.requestAccessToken()
  }

  const handleUnlinkGoogle = async () => {
    setError('')
    const res = await fetch(`${API_BASE}/api/account/unlink/google`, {
      method: 'POST',
      credentials: 'include'
    })
    const text = await res.text()
    if (res.ok) {
      await loadProviders()
    } else {
      setError(text)
    }
  }

  // ─── Telegram: тот же JS-метод Telegram.Login.auth(), что и в Login.jsx —
  // открывает попап, а кнопка на странице полностью наша (не рендерим
  // официальный iframe-виджет, чтобы не зависеть от его собственной вёрстки).
  useEffect(() => {
    const scriptId = 'telegram-widget-script'
    if (document.getElementById(scriptId)) return
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    document.body.appendChild(script)
  }, [])

  const handleLinkTelegram = () => {
    if (!window.Telegram || !window.Telegram.Login) {
      setError('Telegram ещё не готов, попробуйте через секунду')
      return
    }
    setError('')
    setTelegramLoading(true)
    window.Telegram.Login.auth(
      { bot_id: TELEGRAM_BOT_ID, request_access: 'write' },
      async (userData) => {
        if (!userData) {
          // Пользователь закрыл всплывающее окно, ничего не подтвердив.
          setTelegramLoading(false)
          return
        }
        try {
          const res = await fetch(`${API_BASE}/api/account/link/telegram`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
          })
          const text = await res.text()
          if (res.ok) {
            await loadProviders()
          } else {
            setError(text)
          }
        } catch (e) {
          setError('Сервер недоступен')
        } finally {
          setTelegramLoading(false)
        }
      }
    )
  }

  const handleUnlinkTelegram = async () => {
    setError('')
    const res = await fetch(`${API_BASE}/api/account/unlink/telegram`, {
      method: 'POST',
      credentials: 'include'
    })
    const text = await res.text()
    if (res.ok) {
      await loadProviders()
    } else {
      setError(text)
    }
  }

  if (!providers) return null

  return (
    <div>
      <h3 style={{ color: 'white', marginBottom: '12px' }}>Способы входа</h3>

      {error && (
        <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '10px' }}>{error}</p>
      )}

      {/* Google */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span style={{ color: 'white' }}>Google {providers.email ? `(${providers.email})` : ''}</span>
        {providers.has_google ? (
          <button onClick={handleUnlinkGoogle} className="login-btn-grad" style={{ padding: '6px 14px' }}>
            Отвязать
          </button>
        ) : (
          <button onClick={handleLinkGoogle} disabled={googleLoading} className="login-btn-grad" style={{ padding: '6px 14px' }}>
            {googleLoading ? 'Проверяем...' : 'Привязать'}
          </button>
        )}
      </div>

      {/* Telegram */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'white' }}>Telegram {providers.telegram_username ? `(@${providers.telegram_username})` : ''}</span>
        {providers.has_telegram ? (
          <button onClick={handleUnlinkTelegram} className="login-btn-grad" style={{ padding: '6px 14px' }}>
            Отвязать
          </button>
        ) : (
          <button onClick={handleLinkTelegram} disabled={telegramLoading} className="login-btn-grad" style={{ padding: '6px 14px' }}>
            {telegramLoading ? 'Проверяем...' : 'Привязать'}
          </button>
        )}
      </div>
    </div>
  )
}

export default AccountLinking
