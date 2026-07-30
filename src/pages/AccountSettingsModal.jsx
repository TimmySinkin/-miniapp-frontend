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
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [currentPasswordFocused, setCurrentPasswordFocused] = useState(false)
  const [newPasswordFocused, setNewPasswordFocused] = useState(false)
  const [showPasswordFields, setShowPasswordFields] = useState(false)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordInfo, setPasswordInfo] = useState('')

  // ─── Имя ("как к вам обращаться") ───
  const [name, setName] = useState('')
  const [nameFocused, setNameFocused] = useState(false)
  const [nameSaving, setNameSaving] = useState(false)
  const [nameError, setNameError] = useState('')

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
      if (res.ok) {
        const data = await res.json()
        setProviders(data)
        setName(data.name || '')
      }
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
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowPasswordFields(false)
      setPasswordError('')
      setPasswordInfo('')
      setAvatarError('')
      setNameError('')
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

  // ─── Имя: сохраняем по потере фокуса или по Enter, без отдельной кнопки —
  // так же, как аватар, чтобы не плодить лишний UI ради одного поля.
  const handleSaveName = async () => {
    if (nameSaving) return
    if (providers && name === (providers.name || '')) return // не менялось — не дёргаем сервер
    setNameError('')
    setNameSaving(true)
    try {
      const res = await fetch(`${API_BASE}/api/account/name`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      const text = await res.text()
      if (res.ok) {
        setProviders(p => ({ ...p, name }))
      } else {
        setNameError(text)
      }
    } catch (e) {
      setNameError('Сервер недоступен')
    } finally {
      setNameSaving(false)
    }
  }

  // ─── Смена пароля ───
  const handleChangePassword = async () => {
    if (passwordSubmitting) return
    if (providers.has_password && !currentPassword) {
      setPasswordError('Введите текущий пароль')
      return
    }
    if (!newPasswordOk) {
      setPasswordError('Новый пароль не соответствует требованиям ниже')
      return
    }
    if (providers.has_password && newPassword === currentPassword) {
      setPasswordError('Новый пароль должен отличаться от текущего')
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
        setPasswordInfo(providers.has_password ? 'Пароль изменён' : 'Пароль добавлен')
        setCurrentPassword('')
        setNewPassword('')
        setShowPasswordFields(false)
        await loadProviders() // has_password теперь true — при следующем открытии покажем "Изменить" и поле "Текущий пароль"
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
        <style>{`
          .asm-input-group { position: relative; margin-bottom: 10px; }
          .asm-glass-input {
            width: 100%; box-sizing: border-box;
            border: 1.5px solid #e0e2eb;
            border-radius: 12px;
            background: #efedff;
            padding: 16px 40px 8px 14px;
            font-size: 13.5px; font-weight: 600;
            color: #1e2130;
            outline: none;
            font-family: inherit;
            transition: border-color 150ms cubic-bezier(0.4,0,0.2,1);
          }
          .asm-glass-input:focus { border-color: #6a5cf5; }
          /* Браузер красит автозаполненные поля своим фоном (обычно серым/жёлтым),
             который обычным background не перебить — нужен именно этот трюк
             с огромной inset-тенью цвета нашего инпута. */
          .asm-glass-input:-webkit-autofill,
          .asm-glass-input:-webkit-autofill:hover,
          .asm-glass-input:-webkit-autofill:focus {
            -webkit-text-fill-color: #1e2130;
            -webkit-box-shadow: 0 0 0px 1000px #efedff inset;
            box-shadow: 0 0 0px 1000px #efedff inset;
            transition: background-color 9999s ease-in-out 0s;
          }
          .asm-glass-input.asm-readonly:-webkit-autofill {
            -webkit-box-shadow: 0 0 0px 1000px #f4f5f9 inset;
            box-shadow: 0 0 0px 1000px #f4f5f9 inset;
          }
          .asm-glass-input.asm-readonly { background: #f4f5f9; font-weight: 600; cursor: default; }
          .asm-glass-input.asm-notched {
            border-top-left-radius: 0;
            clip-path: polygon(14px 0, 100% 0, 100% 100%, 0 100%, 0 14px);
          }
          .asm-floating-label {
            position: absolute; left: 14px; top: 50%;
            transform: translateY(-50%);
            color: #8b8fa3;
            pointer-events: none;
            transition: 150ms cubic-bezier(0.4,0,0.2,1);
            font-size: 13.5px;
          }
          .asm-floating-label.asm-floated {
            top: 0; left: 10px;
            transform: translateY(-50%) scale(0.82);
            padding: 0 6px; border-radius: 6px;
            color: #6a5cf5;
            background: white;
          }
          .asm-field-icon-btn {
            position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
            background: none; border: none; padding: 4px; cursor: pointer;
            opacity: 0.6; transition: opacity 0.15s;
            display: flex; align-items: center; justify-content: center; color: #8b8fa3;
          }
          .asm-field-icon-btn:hover { opacity: 1; }
          .asm-btn {
            border: none; background: transparent; border-radius: 8px;
            padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
            transition: background 150ms ease, color 150ms ease;
            outline: none; box-shadow: none; -webkit-appearance: none; appearance: none;
          }
          .asm-btn:focus { outline: none; box-shadow: none; }
          .asm-btn-save { color: #1e2130; }
          .asm-btn-save:hover:not(:disabled) { background: transparent; color: #6a5cf5; }
          .asm-btn-save:disabled { color: #8b8fa3; cursor: default; }
          .asm-btn-cancel { color: #8b8fa3; }
          .asm-btn-cancel:hover { background: #f4f5f9; color: #1e2130; }
        `}</style>
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

            {/* Как к вам обращаться (редактируется) + Логин (только отображение), в два столбца */}
            <div style={{ display: 'flex', gap: '18px', padding: '0 0 18px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#8b8fa3', marginBottom: '6px' }}>Как к вам обращаться</div>
                <div className="asm-input-group">
                  <input
                    id="asm-name-field"
                    className="asm-glass-input asm-notched"
                    type="text"
                    autoComplete="off"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setNameFocused(true)}
                    onBlur={() => { setNameFocused(false); handleSaveName() }}
                    onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  />
                  <label className={'asm-floating-label' + (nameFocused || name ? ' asm-floated' : '')} htmlFor="asm-name-field">
                    Имя
                  </label>
                </div>
                {nameSaving && (
                  <div style={{ fontSize: '11px', color: '#8b8fa3', marginTop: '4px' }}>Сохраняем...</div>
                )}
                {nameError && (
                  <div style={{ color: '#d64545', fontSize: '12px', marginTop: '4px' }}>{nameError}</div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#8b8fa3', marginBottom: '6px' }}>Логин</div>
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1e2130', padding: '9px 0' }}>
                  {providers.login}
                </div>
              </div>
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
                    {providers.has_password ? 'Изменить' : 'Добавить'}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '14px', color: '#1e2130', fontWeight: '500', marginBottom: '10px' }}>
                    {providers.has_password ? 'Смена пароля' : 'Добавление пароля'}
                  </div>
                  {providers.has_password && (
                    <div className="asm-input-group">
                      <input
                        id="asm-current-password-field"
                        className="asm-glass-input"
                        type={showCurrentPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        name="current-password"
                        value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        onFocus={() => setCurrentPasswordFocused(true)}
                        onBlur={() => setCurrentPasswordFocused(false)}
                        style={{ paddingRight: '38px' }}
                      />
                      <label className={'asm-floating-label' + (currentPasswordFocused || currentPassword ? ' asm-floated' : '')} htmlFor="asm-current-password-field">
                        Текущий пароль
                      </label>
                      <button
                        type="button"
                        className="asm-field-icon-btn"
                        onClick={() => setShowCurrentPassword(v => !v)}
                        title={showCurrentPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      >
                        {showCurrentPassword ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8fa3" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8fa3" strokeWidth="2">
                            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        )}
                      </button>
                    </div>
                  )}
                  <div className="asm-input-group">
                    <input
                      id="asm-new-password-field"
                      className="asm-glass-input"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      name="new-password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      onFocus={() => setNewPasswordFocused(true)}
                      onBlur={() => setNewPasswordFocused(false)}
                      onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                      style={{ paddingRight: '38px' }}
                    />
                    <label className={'asm-floating-label' + (newPasswordFocused || newPassword ? ' asm-floated' : '')} htmlFor="asm-new-password-field">
                      Новый пароль
                    </label>
                    <button
                      type="button"
                      className="asm-field-icon-btn"
                      onClick={() => setShowNewPassword(v => !v)}
                      title={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      {showNewPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8fa3" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b8fa3" strokeWidth="2">
                          <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
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
                    <button onClick={handleChangePassword} disabled={passwordSubmitting} className="asm-btn asm-btn-save">
                      {passwordSubmitting ? 'Сохраняем...' : 'Сохранить'}
                    </button>
                    <button
                      onClick={() => { setShowPasswordFields(false); setCurrentPassword(''); setNewPassword(''); setPasswordError('') }}
                      className="asm-btn asm-btn-cancel"
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

export default AccountSettingsModal