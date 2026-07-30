import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Вынесите в общий src/config.js вместе с копией из Login.jsx, чтобы не
// держать одно и то же значение в нескольких файлах.
const GOOGLE_CLIENT_ID = '893384076518-hvbeo0vsqrs42lepoj5ip57qgdnfe4jb.apps.googleusercontent.com'
const TELEGRAM_BOT_ID = '8814230092'

/**
 * Модалка со списком способов входа и кнопками привязать/отвязать
 * Google и Telegram к ТЕКУЩЕМУ (уже залогиненному) аккаунту.
 * Открывается по клику на шестерёнку в шапке — см. Home.jsx / AI.jsx / Stats.jsx.
 */
function AccountSettingsModal({ open, onClose }) {
  const [providers, setProviders] = useState(null)
  const [error, setError] = useState('')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [telegramLoading, setTelegramLoading] = useState(false)
  const googleTokenClientRef = useRef(null)

  // ─── Аватар ───
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const avatarInputRef = useRef(null)

  // ─── Смена пароля ───
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordInfo, setPasswordInfo] = useState('')

  // Те же правила, что в Login.jsx для сброса пароля — держим одинаковыми,
  // иначе бэкенд отклонит пароль, который фронт считает валидным.
  const PASSWORD_RULES = [
    { key: 'length', label: 'Минимум 6 символов', test: (p) => p.length >= 6 },
    { key: 'upper', label: 'Начинается с заглавной буквы', test: (p) => /^[A-Z]/.test(p) },
    { key: 'digitOrSpecial', label: 'Содержит цифру или спецсимвол', test: (p) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(p) },
    { key: 'latinOnly', label: 'Только латиница (без кириллицы)', test: (p) => p.length === 0 || /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]*$/.test(p) },
  ]
  const newPasswordOk = PASSWORD_RULES.every(r => r.test(newPassword))

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
    else {
      // Модалку закрыли — не тащим введённый пароль и ошибки в следующее открытие.
      setCurrentPassword('')
      setNewPassword('')
      setShowPasswordFields(false)
      setPasswordError('')
      setPasswordInfo('')
      setAvatarError('')
    }
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

  // ─── Telegram: тот же JS-метод Telegram.Login.auth(), что и в Login.jsx —
  // открывает попап, а кнопка на странице полностью наша, оформленная так же,
  // как кнопка Google (вместо авторендера официального iframe-виджета, который
  // молча пропадал без объяснений, если домен не привязан через @BotFather).
  useEffect(() => {
    if (!open) return
    const scriptId = 'telegram-widget-script'
    if (document.getElementById(scriptId)) return
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    document.body.appendChild(script)
  }, [open])

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
          if (res.ok) await loadProviders()
          else setError(text)
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
    const res = await fetch(`${API_BASE}/api/account/unlink/telegram`, { method: 'POST', credentials: 'include' })
    const text = await res.text()
    if (res.ok) await loadProviders()
    else setError(text)
  }

  // ─── Аватар: файл сразу грузим на сервер по выбору, без отдельной
  // кнопки "Сохранить" — так проще, а превью показываем оптимистично,
  // пока идёт запрос.
  const handleAvatarPick = () => {
    avatarInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // чтобы повторный выбор того же файла тоже сработал
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarError('Можно загрузить только изображение')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Файл слишком большой (максимум 5 МБ)')
      return
    }

    setAvatarError('')
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const res = await fetch(`${API_BASE}/api/account/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData // без Content-Type — браузер сам проставит multipart-границу
      })
      const text = await res.text()
      if (res.ok) {
        await loadProviders()
      } else {
        setAvatarError(text)
      }
    } catch (e) {
      setAvatarError('Сервер недоступен')
    } finally {
      setAvatarUploading(false)
    }
  }

  // ─── Смена пароля ───
  const handleChangePassword = async () => {
    if (passwordSubmitting) return
    if (!currentPassword) {
      setPasswordError('Введите текущий пароль')
      return
    }
    if (!newPasswordOk) {
      setPasswordError('Новый пароль не соответствует требованиям ниже')
      return
    }
    setPasswordError('')
    setPasswordInfo('')
    setPasswordSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/account/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      })
      const text = await res.text()
      if (res.ok) {
        setPasswordInfo('Пароль изменён')
        setCurrentPassword('')
        setNewPassword('')
        setShowPasswordFields(false)
      } else {
        setPasswordError(text)
      }
    } catch (e) {
      setPasswordError('Сервер недоступен')
    } finally {
      setPasswordSubmitting(false)
    }
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
          <h3 style={{ margin: 0, fontSize: '18px', color: '#1e2130' }}>Редактирование профиля</h3>
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

            {/* Аватар */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0 18px' }}>
              <div
                onClick={handleAvatarPick}
                style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: providers.avatar_url ? `url(${providers.avatar_url}) center/cover` : '#efedff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden',
                  color: '#6a5cf5', fontSize: '20px', fontWeight: '600'
                }}
                title="Сменить аватар"
              >
                {!providers.avatar_url && (providers.login ? providers.login[0].toUpperCase() : '?')}
                {avatarUploading && (
                  <div style={{
                    position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#6a5cf5'
                  }}>
                    ...
                  </div>
                )}
              </div>
              <div>
                <button onClick={handleAvatarPick} disabled={avatarUploading} style={btnStyle('#f4f5f9', '#1e2130')}>
                  {avatarUploading ? 'Загружаем...' : 'Сменить фото'}
                </button>
                {avatarError && (
                  <div style={{ color: '#d64545', fontSize: '12px', marginTop: '6px' }}>{avatarError}</div>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee', borderTop: '1px solid #eee' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div>
                <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500' }}>Telegram</div>
                {providers.telegram_username && <div style={{ fontSize: '12px', color: '#8b8fa3' }}>@{providers.telegram_username}</div>}
              </div>
              {providers.has_telegram ? (
                <button onClick={handleUnlinkTelegram} style={btnStyle('#f4f5f9', '#1e2130')}>Отвязать</button>
              ) : (
                <button onClick={handleLinkTelegram} disabled={telegramLoading} style={btnStyle('#efedff', '#6a5cf5')}>
                  {telegramLoading ? 'Проверяем...' : 'Привязать'}
                </button>
              )}
            </div>

            {/* Смена пароля */}
            <div style={{ padding: '12px 0 0' }}>
              {!showPasswordFields ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500' }}>Пароль</div>
                  <button onClick={() => { setShowPasswordFields(true); setPasswordInfo('') }} style={btnStyle('#f4f5f9', '#1e2130')}>
                    Изменить
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500', marginBottom: '10px' }}>Смена пароля</div>
                  <input
                    type="password"
                    placeholder="Текущий пароль"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    style={inputStyle}
                  />
                  <input
                    type="password"
                    placeholder="Новый пароль"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                    style={inputStyle}
                  />
                  {newPassword.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px 0' }}>
                      {PASSWORD_RULES.map(rule => {
                        const pass = rule.test(newPassword)
                        return (
                          <li key={rule.key} style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            fontSize: '12px', marginBottom: '3px',
                            color: pass ? '#1a9e6a' : '#8b8fa3'
                          }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '14px', height: '14px', borderRadius: '50%',
                              border: pass ? 'none' : '1px solid #ccc',
                              background: pass ? '#1a9e6a' : 'transparent',
                              color: 'white', fontSize: '9px', flexShrink: 0
                            }}>
                              {pass ? '✓' : ''}
                            </span>
                            {rule.label}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  {passwordError && (
                    <p style={{ color: '#d64545', fontSize: '12px', marginBottom: '8px' }}>{passwordError}</p>
                  )}
                  {passwordInfo && !passwordError && (
                    <p style={{ color: '#1a9e6a', fontSize: '12px', marginBottom: '8px' }}>{passwordInfo}</p>
                  )}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={handleChangePassword} disabled={passwordSubmitting} style={btnStyle('#efedff', '#6a5cf5')}>
                      {passwordSubmitting ? 'Сохраняем...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => { setShowPasswordFields(false); setCurrentPassword(''); setNewPassword(''); setPasswordError('') }}
                      style={btnStyle('#f4f5f9', '#1e2130')}
                    >
                      Отмена
                    </button>
                  </div>
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

const inputStyle = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', marginBottom: '8px',
  border: '1px solid #e0e2eb', borderRadius: '8px', fontSize: '13px',
  color: '#1e2130', outline: 'none', fontFamily: 'inherit'
}

export default AccountSettingsModal