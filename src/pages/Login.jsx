import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
/*const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'*/
const API_BASE = import.meta.env.VITE_API_URL || 'https://miapp-backend-srx6.onrender.com'

// Вставьте сюда Client ID из Google Cloud Console (APIs & Services → Credentials).
// Это публичный идентификатор — его наличие в клиентском коде не проблема безопасности,
// в отличие от Client Secret, который тут не нужен вообще.
const GOOGLE_CLIENT_ID = '893384076518-hvbeo0vsqrs42lepoj5ip57qgdnfe4jb.apps.googleusercontent.com'
// Имя бота БЕЗ "@" — публичное, можно смело хранить во фронтенд-коде
// (это не токен). Замените на username вашего бота из @BotFather.
// Имя бота больше не нужно для кастомной кнопки (это было только для
// встроенного iframe-виджета). bot_id — числовая часть токена бота
// (публичная информация, не секрет, использовать во фронтенде безопасно).
const TELEGRAM_BOT_ID = '8814230092'

function Login() {
    const [login, setLogin] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loginFocused, setLoginFocused] = useState(false)
    const [passwordFocused, setPasswordFocused] = useState(false)
    const [rememberMe, setRememberMe] = useState(true)
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGoogleLoading] = useState(false)
    const [error, setError] = useState('')
    const navigate = useNavigate()
    const googleTokenClientRef = useRef(null)
    const googleAccessTokenRef = useRef(null)
    const telegramAuthDataRef = useRef(null)
    const [telegramLoading, setTelegramLoading] = useState(false)

    // Если это первый вход через Google/Telegram — вместо автогенерации логина
    // вида "google_1071206192" спрашиваем у пользователя, как к нему обращаться.
    const [onboarding, setOnboarding] = useState(false)
    const [onboardingProvider, setOnboardingProvider] = useState('google') // 'google' | 'telegram'
    const [onboardingLogin, setOnboardingLogin] = useState('')
    const [onboardingError, setOnboardingError] = useState('')
    const [onboardingSubmitting, setOnboardingSubmitting] = useState(false)

    // "Забыли пароль": шаг 1 — вводим логин/email и запрашиваем код,
    // шаг 2 — вводим код + новый пароль.
    const [forgotOpen, setForgotOpen] = useState(false)
    const [forgotStep, setForgotStep] = useState(1)
    const [forgotIdentifier, setForgotIdentifier] = useState('')
    const [forgotCode, setForgotCode] = useState('')
    const [forgotNewPassword, setForgotNewPassword] = useState('')
    const [forgotShowPassword, setForgotShowPassword] = useState(false)
    const [forgotError, setForgotError] = useState('')
    const [forgotInfo, setForgotInfo] = useState('')
    const [forgotSubmitting, setForgotSubmitting] = useState(false)

    const FORGOT_PASSWORD_RULES = [
        { key: 'length', label: 'Минимум 6 символов', test: (p) => p.length >= 6 },
        { key: 'upper', label: 'Начинается с заглавной буквы', test: (p) => /^[A-Z]/.test(p) },
        { key: 'digitOrSpecial', label: 'Содержит цифру или спецсимвол', test: (p) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(p) },
        { key: 'latinOnly', label: 'Только латиница (без кириллицы)', test: (p) => p.length === 0 || /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]*$/.test(p) },
    ]
    const forgotPasswordOk = FORGOT_PASSWORD_RULES.every(r => r.test(forgotNewPassword))

    const openForgot = () => {
        setForgotOpen(true)
        setForgotStep(1)
        setForgotIdentifier(login) // подставляем то, что уже ввели в форму логина, если есть
        setForgotCode('')
        setForgotNewPassword('')
        setForgotError('')
        setForgotInfo('')
    }

    const handleForgotRequest = async () => {
        if (forgotSubmitting) return
        if (!forgotIdentifier.trim()) {
            setForgotError('Введите логин или email')
            return
        }
        setForgotError('')
        setForgotSubmitting(true)
        try {
            const res = await fetch(`${API_BASE}/api/password-reset/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: forgotIdentifier.trim() })
            })
            const text = await res.text()
            if (res.ok) {
                setForgotInfo(text)
                setForgotStep(2)
            } else {
                setForgotError(text)
            }
        } catch (e) {
            setForgotError('Сервер недоступен')
        } finally {
            setForgotSubmitting(false)
        }
    }

    const handleForgotConfirm = async () => {
        if (forgotSubmitting) return
        if (!forgotCode.trim() || forgotCode.trim().length !== 4) {
            setForgotError('Введите 4-значный код из письма')
            return
        }
        if (!forgotPasswordOk) {
            setForgotError('Пароль не соответствует требованиям ниже')
            return
        }
        setForgotError('')
        setForgotSubmitting(true)
        try {
            const res = await fetch(`${API_BASE}/api/password-reset/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    identifier: forgotIdentifier.trim(),
                    code: forgotCode.trim(),
                    newPassword: forgotNewPassword
                })
            })
            const text = await res.text()
            if (res.ok) {
                setForgotStep(3) // экран успеха
                setLogin(forgotIdentifier.trim()) // подставляем в форму логина для удобства
            } else {
                setForgotError(text)
            }
        } catch (e) {
            setForgotError('Сервер недоступен')
        } finally {
            setForgotSubmitting(false)
        }
    }

    const handleForgotResend = async () => {
        setForgotError('')
        setForgotInfo('')
        try {
            const res = await fetch(`${API_BASE}/api/password-reset/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: forgotIdentifier.trim() })
            })
            const text = await res.text()
            if (res.ok) {
                setForgotInfo('Код отправлен повторно')
            } else {
                setForgotError(text)
            }
        } catch (e) {
            setForgotError('Сервер недоступен')
        }
    }

    // Esc закрывает модалку "Забыли пароль" (кроме шага успеха — там достаточно
    // кнопки "Войти", но Esc тоже логично закрывает).
    useEffect(() => {
        if (!forgotOpen) return
        const onKeyDown = (e) => {
            if (e.key === 'Escape') setForgotOpen(false)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [forgotOpen])

    // Подгружаем Google Identity Services один раз при монтировании и
    // инициализируем OAuth2 token client — он открывает попап Google по клику
    // на нашу СВОЮ кнопку (в отличие от официального рендер-виджета Google,
    // так кнопка остаётся оформленной под наш дизайн).
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
                    if (tokenResponse.error) {
                        setGoogleLoading(false)
                        setError('Не удалось войти через Google')
                        return
                    }
                    googleAccessTokenRef.current = tokenResponse.access_token
                    try {
                        const res = await fetch(`${API_BASE}/api/oauth/google`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            credentials: 'include',
                            body: JSON.stringify({
                                accessToken: tokenResponse.access_token,
                                rememberMe: String(rememberMe)
                            })
                        })
                        if (res.ok) {
                            const data = await res.json()
                            if (data.status === 'needsOnboarding') {
                                // Первый вход этим Google-аккаунтом — просим выбрать логин,
                                // вместо того чтобы молча создать "google_<id>".
                                setOnboardingProvider('google')
                                setOnboardingLogin(data.suggestedLogin || '')
                                setOnboarding(true)
                            } else {
                                // Логин сервер уже "запомнил" через httpOnly cookie (её длительность
                                // как раз зависит от rememberMe) — в localStorage больше не пишем,
                                // иначе сессия жила бы вечно независимо от галочки.
                                navigate('/home')
                            }
                        } else {
                            setError(await res.text())
                        }
                    } catch (e) {
                        setError('Сервер недоступен')
                    } finally {
                        setGoogleLoading(false)
                    }
                }
            })
        }
    }, [navigate])

    // Вместо встроенного iframe-виджета (который сам решает, что показывать —
    // например, "Войти как Имя", если в браузере уже открыта сессия
    // telegram.org, и это никак не перестилизовать) используем официальный
    // JS-метод Telegram.Login.auth() — он открывает всплывающее окно, а сама
    // кнопка на странице полностью наша, как и у Google.
    useEffect(() => {
        const scriptId = 'telegram-widget-script'
        if (document.getElementById(scriptId)) return
        const script = document.createElement('script')
        script.id = scriptId
        script.src = 'https://telegram.org/js/telegram-widget.js?22'
        script.async = true
        document.body.appendChild(script)
    }, [])

    const handleTelegramLogin = () => {
        if (!window.Telegram || !window.Telegram.Login) {
            setError('Telegram ещё не готов, попробуйте через секунду')
            return
        }
        setError('')
        setTelegramLoading(true)
        window.Telegram.Login.auth(
            { bot_id: TELEGRAM_BOT_ID, request_access: 'write' },
            async (user) => {
                if (!user) {
                    // Пользователь закрыл всплывающее окно, ничего не подтвердив.
                    setTelegramLoading(false)
                    return
                }
                telegramAuthDataRef.current = user
                try {
                    const res = await fetch(`${API_BASE}/api/oauth/telegram`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ ...user, rememberMe: String(rememberMe) })
                    })
                    if (res.ok) {
                        const data = await res.json()
                        if (data.status === 'needsOnboarding') {
                            setOnboardingProvider('telegram')
                            setOnboardingLogin(data.suggestedLogin || '')
                            setOnboarding(true)
                        } else {
                            navigate('/home')
                        }
                    } else {
                        setError(await res.text())
                    }
                } catch (e) {
                    setError('Сервер недоступен')
                } finally {
                    setTelegramLoading(false)
                }
            }
        )
    }

    const handleGoogleLogin = () => {
        if (!googleTokenClientRef.current) {
            setError('Google ещё не готов, попробуйте через секунду')
            return
        }
        setError('')
        setGoogleLoading(true)
        googleTokenClientRef.current.requestAccessToken()
    }

    // Подтверждение выбранного логина на шаге онбординга после первого входа
    // через Google/Telegram — отдельным запросом, где данные снова проверяются
    // на сервере (нельзя просто довериться логину без повторной проверки).
    const handleOnboardingSubmit = async () => {
        if (onboardingSubmitting) return
        const trimmed = onboardingLogin.trim()
        if (!trimmed) {
            setOnboardingError('Введите, как к вам обращаться')
            return
        }
        setOnboardingError('')
        setOnboardingSubmitting(true)
        try {
            const url = onboardingProvider === 'telegram'
                ? `${API_BASE}/api/oauth/telegram/complete`
                : `${API_BASE}/api/oauth/google/complete`
            const payload = onboardingProvider === 'telegram'
                ? { ...telegramAuthDataRef.current, login: trimmed, rememberMe: String(rememberMe) }
                : { accessToken: googleAccessTokenRef.current, login: trimmed, rememberMe: String(rememberMe) }

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload)
            })
            if (res.ok) {
                const data = await res.json()
                navigate('/home')
            } else {
                setOnboardingError(await res.text())
            }
        } catch (e) {
            setOnboardingError('Сервер недоступен')
        } finally {
            setOnboardingSubmitting(false)
        }
    }

    const handleSubmit = async () => {
        if (loading) return
        setError('')
        setLoading(true)
        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ login, password, rememberMe })
            })
            if (response.ok) {
                // Длительность сессии теперь реально зависит от "Запомнить меня" —
                // это решает бэкенд, выставляя httpOnly cookie с JWT нужного TTL
                // (persistent cookie на 30 дней, либо session cookie до закрытия
                // браузера). В localStorage логин больше не пишем: остальные страницы
                // получают его через /api/me, проверяя куку на сервере.
                navigate('/home')
            } else {
                const errorText = await response.text()
                setError(errorText)
            }
        } catch (e) {
            setError('Сервер недоступен')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            width: '100vw',
            background: 'url("/bg-login.jpg") center/cover no-repeat',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: 0, padding: 0
        }}>
            <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .input-group { position: relative; margin-bottom: 18px; }
        .glass-input2 {
          width: 100%; box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.35);
          border-radius: 14px;
          background: transparent;
          padding: 15px 44px 15px 16px;
          font-size: 15.5px;
          color: white;
          outline: none;
          font-family: inherit;
          transition: border-color 150ms cubic-bezier(0.4,0,0.2,1);
        }
        .glass-input2:focus { border-color: rgba(255,255,255,0.75); }
        .glass-input2:-webkit-autofill,
        .glass-input2:-webkit-autofill:hover,
        .glass-input2:-webkit-autofill:focus {
          -webkit-text-fill-color: white;
          -webkit-box-shadow: 0 0 0 1000px rgba(255,255,255,0.1) inset;
          box-shadow: 0 0 0 1000px rgba(255,255,255,0.1) inset;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: white;
        }
        .floating-label {
          position: absolute; left: 16px; top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.55);
          pointer-events: none;
          transition: 150ms cubic-bezier(0.4,0,0.2,1);
          font-size: 15.5px;
        }
        .floating-label.floated {
          top: 0; left: 12px;
          transform: translateY(-50%) scale(0.82);
          padding: 0 6px;
          border-radius: 6px;
          color: rgba(255,255,255,0.9);
          background: #2b2b2e;
        }
        .field-icon-btn { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.6; transition: opacity 0.15s;
          display: flex; align-items: center; justify-content: center; }
        .field-icon-btn:hover { opacity: 1; }
        .remember-checkbox { width: 16px; height: 16px; border-radius: 4px; cursor: pointer; accent-color: #888; }
        .forgot-link { color: rgba(255,255,255,0.65); font-size: 13px; cursor: pointer; background: none; border: none; padding: 0; }
        .forgot-link:hover { color: white; }
        .login-btn-grad {
          background: linear-gradient(90deg, #e4e4e4, #ffffff);
          transition: filter 0.15s, opacity 0.15s;
        }
        .login-btn-grad:hover:not(:disabled) { filter: brightness(0.95); }
        .login-btn-grad:disabled { opacity: 0.85; cursor: default; }
        .spinner {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(0,0,0,0.25); border-top-color: #1a1a1a;
          animation: spin 0.7s linear infinite;
        }
        .divider-row { display: flex; align-items: center; gap: 10px; margin: 18px 0 16px; }
        .divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.18); }
        .social-btn-wide {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 0; border-radius: 12px; border: 1px solid rgba(255,255,255,0.22);
          background: rgba(255,255,255,0.1); color: white; font-size: 13.5px; font-weight: 500;
          cursor: not-allowed; opacity: 0.65; transition: background 0.15s;
        }
        .social-btn-wide:hover { background: rgba(255,255,255,0.16); }

        /* --- Адаптив --- */
        .login-card {
          width: 400px;
          max-width: 90vw;
          padding: 2.75rem 2.25rem;
          box-sizing: border-box;
        }
        .login-title { font-size: 30px; }
        .modal-card {
          padding: 2rem;
          max-width: 90vw;
          box-sizing: border-box;
          max-height: 90vh;
          overflow-y: auto;
        }
        .modal-card.onboarding { width: 360px; }
        .modal-card.forgot { width: 380px; }

        @media (max-width: 480px) {
          .login-card { padding: 2rem 1.25rem; border-radius: 18px; }
          .login-title { font-size: 24px; }
          .modal-card { padding: 1.5rem 1.25rem; border-radius: 16px; }
          .social-btn-wide { font-size: 12.5px; padding: 10px 0; }
          .divider-row span { font-size: 11.5px; }
        }

        /* Узкие смартфоны (~390-400px, напр. iPhone/Pixel в портрете) */
        @media (max-width: 400px) {
          .login-card { padding: 1.75rem 1rem; }
          .login-title { font-size: 21px; }
          .glass-input2 { padding: 13px 40px 13px 14px; font-size: 14.5px; }
          .floating-label { font-size: 14.5px; }
          .social-btn-wide { font-size: 11.5px; padding: 9px 0; gap: 6px; }
          .modal-card { padding: 1.25rem 1rem; }
          .modal-card.onboarding, .modal-card.forgot { width: 100%; }
        }
      `}</style>

            <div style={{
                position: 'fixed', inset: 0,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)'
            }} />

            <div className="login-card" style={{
                position: 'relative', zIndex: 1,
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: '1px solid rgba(255,255,255,0.22)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.3)'
            }}>

                <h2 className="login-title" style={{
                    color: 'white', textAlign: 'left',
                    fontWeight: '700',
                    marginBottom: '6px', fontFamily: 'Georgia, serif'
                }}>
                    Добро пожаловать
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', marginBottom: '1.75rem' }}>
                    Войдите, чтобы продолжить
                </p>

                {/* Логин */}
                <div className="input-group">
                    <input
                        id="login-field"
                        name="login-field-nofill"
                        className="glass-input2"
                        type="text"
                        autoComplete="off"
                        value={login}
                        onChange={e => setLogin(e.target.value)}
                        onFocus={() => setLoginFocused(true)}
                        onBlur={() => setLoginFocused(false)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                    <label className={'floating-label' + (loginFocused || login ? ' floated' : '')} htmlFor="login-field">Логин</label>
                    <span className="field-icon-btn" style={{ cursor: 'default' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
                </div>

                {/* Пароль */}
                <div className="input-group">
                    <input
                        id="password-field"
                        name="password-field-nofill"
                        className="glass-input2"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onFocus={() => setPasswordFocused(true)}
                        onBlur={() => setPasswordFocused(false)}
                        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                    />
                    <label className={'floating-label' + (passwordFocused || password ? ' floated' : '')} htmlFor="password-field">Пароль</label>
                    <button
                        type="button"
                        className="field-icon-btn"
                        onClick={() => setShowPassword(v => !v)}
                        title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                        {showPassword ? (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                            </svg>
                        ) : (
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                <line x1="1" y1="1" x2="23" y2="23" />
                            </svg>
                        )}
                    </button>
                </div>

                {error && (
                    <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '6px' }}>{error}</p>
                )}

                {/* Запомнить меня / Забыли пароль */}
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: '20px', marginTop: '10px'
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.75)', fontSize: '13px', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            className="remember-checkbox"
                            checked={rememberMe}
                            onChange={e => setRememberMe(e.target.checked)}
                        />
                        Запомнить меня
                    </label>
                    <button type="button" className="forgot-link" onClick={openForgot}>Забыли пароль?</button>
                </div>

                {/* Кнопка входа */}
                <button
                    className="login-btn-grad"
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '14px',
                        borderRadius: '12px', border: 'none', color: '#1a1a1a',
                        fontSize: '16px', fontWeight: '600', cursor: loading ? 'default' : 'pointer',
                        letterSpacing: '0.02em',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                    }}
                >
                    {loading ? (<><span className="spinner" />Входим...</>) : 'Войти'}
                </button>

                {/* Разделитель */}
                <div className="divider-row">
                    <div className="divider-line" />
                    <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12.5px' }}>или войти через</span>
                    <div className="divider-line" />
                </div>

                {/* Соцсети */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <button
                        type="button"
                        className="social-btn-wide"
                        onClick={handleGoogleLogin}
                        disabled={googleLoading}
                        style={{ cursor: googleLoading ? 'default' : 'pointer', opacity: googleLoading ? 0.5 : 1 }}
                        title="Войти через Google"
                    >
                        <img src="/google.png" alt="Google" width="18" height="18" />
                        {googleLoading ? 'Входим...' : 'Google'}
                    </button>
                    <button
                        type="button"
                        className="social-btn-wide"
                        onClick={handleTelegramLogin}
                        disabled={telegramLoading}
                        style={{ cursor: telegramLoading ? 'default' : 'pointer', opacity: telegramLoading ? 0.5 : 1 }}
                        title="Войти через Telegram"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="12" fill="#29A9EA" />
                            <path d="M17.5 7.2L15.6 17.1c-.14.63-.5.78-1.02.49l-2.82-2.08-1.36 1.31c-.15.15-.28.28-.57.28l.2-2.87 5.23-4.72c.23-.2-.05-.32-.35-.11l-6.46 4.07-2.78-.87c-.6-.19-.62-.6.13-.89l10.87-4.19c.5-.19.94.12.78.88z" fill="white" />
                        </svg>
                        {telegramLoading ? 'Входим...' : 'Telegram'}
                    </button>
                </div>

                {/* Нет аккаунта */}
                <p style={{
                    textAlign: 'center', fontSize: '14px',
                    color: 'rgba(255,255,255,0.7)', margin: 0
                }}>
                    Нет аккаунта?{' '}
                    <Link to="/register" style={{ color: 'white', fontWeight: '600' }}>
                        Зарегистрироваться
                    </Link>
                </p>
            </div>

            {onboarding && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 10,
                    background: 'rgba(0,0,0,0.55)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', boxSizing: 'border-box'
                }}>
                    <div className="modal-card onboarding" style={{
                        background: 'rgba(30,30,32,0.95)',
                        backdropFilter: 'blur(12px)',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.5)'
                    }}>
                        <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                            Пропишите ваш будующий логин.
                        </h3>
                        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13.5px', marginBottom: '20px' }}>
                            Это будет ваша часть данных для входа в приложение — можно оставить предложенный вариант или придумать свой.
                        </p>
                        <div className="input-group" style={{ marginBottom: '8px' }}>
                            <input
                                className="glass-input2"
                                type="text"
                                autoFocus
                                value={onboardingLogin}
                                onChange={e => setOnboardingLogin(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleOnboardingSubmit()}
                                style={{ paddingRight: '16px' }}
                            />
                        </div>
                        {onboardingError && (
                            <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '10px' }}>{onboardingError}</p>
                        )}
                        <button
                            className="login-btn-grad"
                            onClick={handleOnboardingSubmit}
                            disabled={onboardingSubmitting}
                            style={{
                                width: '100%', padding: '13px', marginTop: '10px',
                                borderRadius: '12px', border: 'none', color: '#1a1a1a',
                                fontSize: '15px', fontWeight: '600', cursor: onboardingSubmitting ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                            }}
                        >
                            {onboardingSubmitting ? (<><span className="spinner" />Сохраняем...</>) : 'Продолжить'}
                        </button>
                    </div>
                </div>
            )}
            {forgotOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10,
                        background: 'rgba(0,0,0,0.55)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '16px', boxSizing: 'border-box'
                    }}
                    onClick={() => setForgotOpen(false)}
                >
                    <div
                        className="modal-card forgot"
                        style={{
                            position: 'relative',
                            background: 'rgba(30,30,32,0.95)',
                            backdropFilter: 'blur(12px)',
                            borderRadius: '20px',
                            border: '1px solid rgba(255,255,255,0.15)',
                            boxShadow: '0 12px 48px rgba(0,0,0,0.5)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={() => setForgotOpen(false)}
                            title="Закрыть (Esc)"
                            style={{
                                position: 'absolute', top: '14px', right: '14px',
                                width: '28px', height: '28px', borderRadius: '50%',
                                background: 'rgba(255,255,255,0.08)', border: 'none',
                                color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '15px', lineHeight: 1, transition: 'background 0.15s, color 0.15s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = 'white' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)' }}
                        >
                            ✕
                        </button>
                        {forgotStep === 1 && (
                            <>
                                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                                    Забыли пароль?
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13.5px', marginBottom: '20px' }}>
                                    Введите логин или email — пришлём код для сброса пароля.
                                </p>
                                <div className="input-group" style={{ marginBottom: '8px' }}>
                                    <input
                                        className="glass-input2"
                                        type="text"
                                        autoFocus
                                        value={forgotIdentifier}
                                        onChange={e => setForgotIdentifier(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleForgotRequest()}
                                        style={{ paddingRight: '16px' }}
                                    />
                                </div>
                                {forgotError && (
                                    <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '10px' }}>{forgotError}</p>
                                )}
                                <button
                                    className="login-btn-grad"
                                    onClick={handleForgotRequest}
                                    disabled={forgotSubmitting}
                                    style={{
                                        width: '100%', padding: '13px', marginTop: '10px',
                                        borderRadius: '12px', border: 'none', color: '#1a1a1a',
                                        fontSize: '15px', fontWeight: '600', cursor: forgotSubmitting ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    {forgotSubmitting ? (<><span className="spinner" />Отправляем...</>) : 'Отправить код'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setForgotOpen(false)}
                                    style={{
                                        width: '100%', padding: '10px', marginTop: '8px', background: 'transparent',
                                        border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px', cursor: 'pointer'
                                    }}
                                >
                                    Отмена
                                </button>
                            </>
                        )}

                        {forgotStep === 2 && (
                            <>
                                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                                    Введите код и новый пароль
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13.5px', marginBottom: '20px' }}>
                                    Код отправлен на почту, привязанную к аккаунту. Действителен 10 минут.
                                </p>
                                <div className="input-group" style={{ marginBottom: '8px' }}>
                                    <input
                                        className="glass-input2"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={4}
                                        placeholder="0000"
                                        autoFocus
                                        value={forgotCode}
                                        onChange={e => setForgotCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        style={{ paddingRight: '16px', fontSize: '20px', letterSpacing: '8px', textAlign: 'center' }}
                                    />
                                </div>
                                <div className="input-group" style={{ marginBottom: '4px' }}>
                                    <input
                                        className="glass-input2"
                                        type={forgotShowPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        placeholder="Новый пароль"
                                        value={forgotNewPassword}
                                        onChange={e => setForgotNewPassword(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleForgotConfirm()}
                                    />
                                    <button
                                        type="button"
                                        className="field-icon-btn"
                                        onClick={() => setForgotShowPassword(v => !v)}
                                        title={forgotShowPassword ? 'Скрыть пароль' : 'Показать пароль'}
                                    >
                                        {forgotShowPassword ? (
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        ) : (
                                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.9 18.9 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        )}
                                    </button>
                                </div>

                                {forgotNewPassword.length > 0 && (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 10px 0' }}>
                                        {FORGOT_PASSWORD_RULES.map(rule => {
                                            const pass = rule.test(forgotNewPassword)
                                            return (
                                                <li key={rule.key} style={{
                                                    display: 'flex', alignItems: 'center', gap: '8px',
                                                    fontSize: '12.5px', marginBottom: '3px',
                                                    color: pass ? '#7ee787' : 'rgba(255,255,255,0.45)'
                                                }}>
                          <span style={{
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: '15px', height: '15px', borderRadius: '50%',
                              border: pass ? 'none' : '1px solid rgba(255,255,255,0.3)',
                              background: pass ? '#1d9e75' : 'transparent',
                              color: 'white', fontSize: '10px', flexShrink: 0
                          }}>
                            {pass ? '✓' : ''}
                          </span>
                                                    {rule.label}
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}

                                {forgotError && (
                                    <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '10px' }}>{forgotError}</p>
                                )}
                                {forgotInfo && !forgotError && (
                                    <p style={{ color: '#7ee787', fontSize: '13px', marginBottom: '10px' }}>{forgotInfo}</p>
                                )}

                                <button
                                    className="login-btn-grad"
                                    onClick={handleForgotConfirm}
                                    disabled={forgotSubmitting}
                                    style={{
                                        width: '100%', padding: '13px', marginTop: '6px',
                                        borderRadius: '12px', border: 'none', color: '#1a1a1a',
                                        fontSize: '15px', fontWeight: '600', cursor: forgotSubmitting ? 'default' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                                    }}
                                >
                                    {forgotSubmitting ? (<><span className="spinner" />Сохраняем...</>) : 'Сбросить пароль'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleForgotResend}
                                    style={{
                                        width: '100%', padding: '10px', marginTop: '6px', background: 'transparent',
                                        border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                                        cursor: 'pointer', textDecoration: 'underline'
                                    }}
                                >
                                    Отправить код ещё раз
                                </button>
                            </>
                        )}

                        {forgotStep === 3 && (
                            <>
                                <h3 style={{ color: 'white', fontSize: '20px', fontWeight: '700', marginBottom: '6px', fontFamily: 'Georgia, serif' }}>
                                    Готово!
                                </h3>
                                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13.5px', marginBottom: '20px' }}>
                                    Пароль обновлён. Теперь можно войти с новым паролем.
                                </p>
                                <button
                                    className="login-btn-grad"
                                    onClick={() => setForgotOpen(false)}
                                    style={{
                                        width: '100%', padding: '13px',
                                        borderRadius: '12px', border: 'none', color: '#1a1a1a',
                                        fontSize: '15px', fontWeight: '600', cursor: 'pointer'
                                    }}
                                >
                                    Войти
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default Login