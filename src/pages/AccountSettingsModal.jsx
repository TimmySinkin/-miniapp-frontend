import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Вынесите в общий src/config.js вместе с копией из Login.jsx, чтобы не
// держать одно и то же значение в нескольких файлах.
const GOOGLE_CLIENT_ID = '893384076518-hvbeo0vsqrs42lepoj5ip57qgdnfe4jb.apps.googleusercontent.com'
const TELEGRAM_BOT_USERNAME = 'MiniAppMon_bot'

/**
 * Модалка со списком способов входа и кнопками привязать/отвязать
 * Google и Telegram к ТЕКУЩЕМУ (уже залогиненному) аккаунту.
 * Открывается по клику на шестерёнку в шапке — см. Home.jsx / AI.jsx / Stats.jsx.
 */
function AccountSettingsModal({ open, onClose }) {
  const [providers, setProviders] = useState(null)
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [telegramWidgetFailed, setTelegramWidgetFailed] = useState(false)
  const googleTokenClientRef = useRef(null)
  const telegramContainerRef = useRef(null)

  const loadProviders = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/account/providers`, { credentials: 'include' })
      if (res.ok) setProviders(await res.json())
    } catch (e) {
      setError('Не удалось загрузить статус привязок')
    }
  }

  useEffect(() => {
    if (open) loadProviders()
  }, [open])

  // Esc закрывает модалку
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // ─── Google ───
  useEffect(() => {
    if (!open) return
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
            if (res.ok) await loadProviders()
            else setError(text)
          } catch (e) {
            setError('Сервер недоступен')
          } finally {
            setGoogleLoading(false)
          }
        }
      })
    }
  }, [open])

  const handleLinkGoogle = () => {
    if (!googleTokenClientRef.current) return
    googleTokenClientRef.current.requestAccessToken()
  }

  const handleUnlinkGoogle = async () => {
    setError('')
    const res = await fetch(`${API_BASE}/api/account/unlink/google`, { method: 'POST', credentials: 'include' })
    const text = await res.text()
    if (res.ok) await loadProviders()
    else setError(text)
  }

  // ─── Telegram ───
  useEffect(() => {
    if (!open || providers?.has_telegram) return
    if (!telegramContainerRef.current) return
    telegramContainerRef.current.innerHTML = ''
    setTelegramWidgetFailed(false)

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
        if (res.ok) await loadProviders()
        else setError(text)
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

    // Виджет Telegram подменяет себя на iframe только если домен сайта
    // привязан к боту через @BotFather → /setdomain (и никогда не работает
    // на localhost). Если это не настроено, виджет молча остаётся пустым —
    // без этой проверки кнопка просто "пропадает" без всякого объяснения.
    const timeoutId = setTimeout(() => {
      const hasIframe = telegramContainerRef.current?.querySelector('iframe')
      if (!hasIframe) setTelegramWidgetFailed(true)
    }, 3000)

    return () => clearTimeout(timeoutId)
  }, [open, providers?.has_telegram])

  const handleUnlinkTelegram = async () => {
    setError('')
    const res = await fetch(`${API_BASE}/api/account/unlink/telegram`, { method: 'POST', credentials: 'include' })
    const text = await res.text()
    if (res.ok) await loadProviders()
    else setError(text)
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white', borderRadius: '16px', padding: '28px',
          width: '380px', maxWidth: '90vw', boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e2130' }}>Настройки аккаунта</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#8b8fa3' }}>
            <X size={20} />
          </button>
        </div>

        {!providers ? (
          <p style={{ color: '#8b8fa3', fontSize: '13px' }}>Загрузка...</p>
        ) : (
          <>
            {error && (
              <p style={{ color: '#d64545', fontSize: '13px', marginBottom: '12px' }}>{error}</p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500' }}>Google</div>
                {providers.email && <div style={{ fontSize: '12px', color: '#8b8fa3' }}>{providers.email}</div>}
              </div>
              {providers.has_google ? (
                <button onClick={handleUnlinkGoogle} style={btnStyle('#f4f5f9', '#1e2130')}>Отвязать</button>
              ) : (
                <button onClick={handleLinkGoogle} disabled={googleLoading} style={btnStyle('#efedff', '#6a5cf5')}>
                  {googleLoading ? 'Проверяем...' : 'Привязать'}
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
              <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500' }}>Telegram</div>
              {providers.has_telegram ? (
                <button onClick={handleUnlinkTelegram} style={btnStyle('#f4f5f9', '#1e2130')}>Отвязать</button>
              ) : (
                <div style={{ textAlign: 'right' }}>
                  <div ref={telegramContainerRef} />
                  {telegramWidgetFailed && (
                    <div style={{ fontSize: '11px', color: '#d64545', maxWidth: '170px' }}>
                      Виджет Telegram не загрузился. Проверьте, что домен сайта привязан к боту через /setdomain у @BotFather (на localhost виджет не работает).
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function btnStyle(bg, color) {
  return {
    border: 'none', background: bg, color, borderRadius: '8px',
    padding: '7px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer'
  }
}

export default AccountSettingsModal
