import { useState, useEffect, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Те же значения, что в Login.jsx — вынесите в общий файл констант,
// чтобы не дублировать при следующем изменении.
const GOOGLE_CLIENT_ID = '893384076518-hvbeo0vsqrs42lepoj5ip57qgdnfe4jb.apps.googleusercontent.com'
const TELEGRAM_BOT_USERNAME = 'MiniAppMon_bot'

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
  const [providers, setProviders] = useState(null) // { has_password, has_google, has_telegram, email }
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const googleTokenClientRef = useRef(null)
  const telegramContainerRef = useRef(null)

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

  // ─── Telegram: официальный виджет, рендерим его сами в этот div,
  // callback шлём на /link/telegram, а не на /oauth/telegram ───
  useEffect(() => {
    if (providers?.has_telegram) return // уже привязан — виджет не нужен
    if (!telegramContainerRef.current) return
    telegramContainerRef.current.innerHTML = ''

    window.onTelegramLinkAuth = async (userData) => {
      setError('')
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
      }
    }

    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.setAttribute('data-telegram-login', TELEGRAM_BOT_USERNAME)
    script.setAttribute('data-size', 'medium')
    script.setAttribute('data-onauth', 'onTelegramLinkAuth(user)')
    script.setAttribute('data-request-access', 'write')
    script.async = true
    telegramContainerRef.current.appendChild(script)
  }, [providers?.has_telegram])

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
        <span style={{ color: 'white' }}>Telegram</span>
        {providers.has_telegram ? (
          <button onClick={handleUnlinkTelegram} className="login-btn-grad" style={{ padding: '6px 14px' }}>
            Отвязать
          </button>
        ) : (
          <div ref={telegramContainerRef} />
        )}
      </div>
    </div>
  )
}

export default AccountLinking
