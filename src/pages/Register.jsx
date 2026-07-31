import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// Те же правила, что и на бэке (RegisterController.validatePassword) —
// дублируем на фронте только для мгновенной обратной связи (галочки),
// финальное решение всё равно принимает сервер.
const PASSWORD_RULES = [
  { key: 'length', label: 'Минимум 6 символов', test: (p) => p.length >= 6 },
  { key: 'upper', label: 'Начинается с заглавной буквы', test: (p) => /^[A-Z]/.test(p) },
  { key: 'digitOrSpecial', label: 'Содержит цифру или спецсимвол', test: (p) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(p) },
  { key: 'latinOnly', label: 'Только латиница (без кириллицы)', test: (p) => p.length === 0 || /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]*$/.test(p) },
]

function Register() {
  const [login, setLogin] = useState('')
  const [loginFocused, setLoginFocused] = useState(false)
  const [email, setEmail] = useState('')
  const [emailFocused, setEmailFocused] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const [awaitingCode, setAwaitingCode] = useState(false)
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeSubmitting, setCodeSubmitting] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  // Экран "Готово" перед переходом на /home — как финальный зелёный кадр
  // в анимации-референсе (иначе успех проскакивает мгновенно и незаметно).
  const [verified, setVerified] = useState(false)
  const digitRefs = useRef([])

  const allPasswordRulesPass = PASSWORD_RULES.every(r => r.test(password))

  useEffect(() => {
    if (awaitingCode) {
      digitRefs.current[0]?.focus()
    }
  }, [awaitingCode])

  const handleSubmit = async () => {
    if (!login || !email || !password) {
      setError('Заполните все поля')
      return
    }
    if (!allPasswordRulesPass) {
      setError('Пароль не соответствует требованиям ниже')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch(`${API_BASE}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password, name: login, email })
      })
      if (response.ok) {
        setAwaitingCode(true)
      } else {
        const errorText = await response.text()
        setError(errorText)
      }
    } catch (e) {
      setError('Сервер недоступен')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (codeOverride) => {
    if (codeSubmitting) return
    const codeToSend = (codeOverride ?? code).trim()
    if (!codeToSend || codeToSend.length !== 4) {
      setCodeError('Введите 4-значный код из письма')
      return
    }
    setCodeError('')
    setCodeSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/api/register/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ login, code: codeToSend, rememberMe: true })
      })
      if (res.ok) {
        // Даём кадру "Готово" реально показаться, а не мигнуть между
        // "Проверяем..." и мгновенным редиректом.
        setVerified(true)
        setTimeout(() => navigate('/home'), 1300)
      } else {
        setCodeError(await res.text())
      }
    } catch (e) {
      setCodeError('Сервер недоступен')
    } finally {
      setCodeSubmitting(false)
    }
  }

  // Ввод одной цифры в конкретную ячейку — обновляет общий code, переводит
  // фокус на следующую ячейку, а после заполнения всех 4 отправляет код
  // автоматически (как "It'll auto-verify once entered" в референсе).
  const handleDigitChange = (index, rawValue) => {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const chars = code.split('')
    while (chars.length < 4) chars.push('')
    chars[index] = digit
    const next = chars.join('').slice(0, 4)
    setCode(next)
    setCodeError('')

    if (digit && index < 3) {
      digitRefs.current[index + 1]?.focus()
    }
    if (next.length === 4 && chars.every(c => c !== '')) {
      handleVerify(next)
    }
  }

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      digitRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      handleVerify()
    }
  }

  const handleResend = async () => {
    setResendMsg('')
    setCodeError('')
    setCode('')
    digitRefs.current[0]?.focus()
    try {
      const res = await fetch(`${API_BASE}/api/register/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login })
      })
      const text = await res.text()
      if (res.ok) {
        setResendMsg('Код отправлен повторно')
      } else {
        setCodeError(text)
      }
    } catch (e) {
      setCodeError('Сервер недоступен')
    }
  }

  return (
    <div style={{
      height: '100vh', display: 'flex',
      background: '#0a0a0a', overflow: 'hidden'
    }}>
      <style>{`
        .reg-input::placeholder { color: rgba(255,255,255,0.35); }
        .reg-input { color: white; }
        .reg-input:focus { border-color: rgba(255,255,255,0.5) !important; outline: none; }
        .reg-input-group { position: relative; margin-bottom: 12px; }
        .reg-glass-input {
          width: 100%; box-sizing: border-box;
          border: 1.5px solid rgba(255,255,255,0.2);
          border-radius: 10px;
          background: rgba(255,255,255,0.07);
          padding: 16px; font-size: 15px; color: white;
          outline: none; font-family: inherit;
          transition: border-color 150ms cubic-bezier(0.4,0,0.2,1);
        }
        .reg-glass-input:focus { border-color: rgba(255,255,255,0.5); }
        .reg-floating-label {
          position: absolute; left: 16px; top: 50%;
          transform: translateY(-50%);
          color: rgba(255,255,255,0.4);
          pointer-events: none;
          transition: 150ms cubic-bezier(0.4,0,0.2,1);
          font-size: 15px;
        }
        .reg-floating-label.floated {
          top: 0; left: 12px;
          transform: translateY(-50%) scale(0.82);
          padding: 0 6px;
          border-radius: 6px;
          color: rgba(255,255,255,0.85);
          background: #0a0a0a;
        }

        /* --- Анимация подтверждения кода (по референсу) --- */
        @keyframes otpPulse {
          0%, 100% { box-shadow: 0 0 22px var(--otp-glow, rgba(245,166,35,0.35)); }
          50% { box-shadow: 0 0 38px var(--otp-glow, rgba(245,166,35,0.6)); }
        }
        @keyframes otpSpin { to { transform: rotate(360deg); } }
        @keyframes otpPopIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes otpFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        .otp-phone {
          width: 180px; margin: 0 auto 28px; padding: 26px 14px 20px;
          border-radius: 30px; background: #0d0d10;
          border: 2px solid var(--otp-border, rgba(245,166,35,0.55));
          animation: otpPulse 2.2s ease-in-out infinite;
          transition: border-color 0.4s ease;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .otp-phone.verifying { animation: otpPulse 0.9s ease-in-out infinite; }
        .otp-lock-ring {
          width: 46px; height: 46px; border-radius: 50%;
          border: 2px dashed var(--otp-icon, #f5a623);
          display: flex; align-items: center; justify-content: center;
          color: var(--otp-icon, #f5a623);
          transition: color 0.4s ease, border-color 0.4s ease;
        }
        .otp-lock-ring.verifying svg { animation: otpSpin 1.1s linear infinite; transform-origin: center; }
        .otp-dots { display: flex; gap: 8px; }
        .otp-dot { font-size: 13px; color: var(--otp-icon, #f5a623); opacity: 0.35; transition: opacity 0.3s ease, color 0.3s ease; }
        .otp-dot.filled { opacity: 1; }
        .otp-status-pill {
          width: 100%; padding: 9px 0; border-radius: 8px; text-align: center;
          font-size: 12.5px; font-weight: 700; letter-spacing: 0.02em;
          background: var(--otp-icon, #f5a623); color: #1a1200;
          transition: background 0.4s ease;
        }
        .otp-digit-box {
          width: 56px; height: 62px; border-radius: 12px; text-align: center;
          font-size: 24px; font-weight: 700; color: white;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.18);
          outline: none; font-family: inherit;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .otp-digit-box:focus {
          border-color: var(--otp-icon, #f5a623);
          box-shadow: 0 0 16px var(--otp-glow, rgba(245,166,35,0.5));
        }
        .otp-success-check {
          width: 60px; height: 60px; border-radius: 50%;
          background: #1d9e75; color: white;
          display: flex; align-items: center; justify-content: center;
          margin: 6px auto 0; animation: otpPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }
      `}</style>

      <div style={{
        width: '45%', position: 'relative', overflow: 'hidden',
        borderRadius: '0 24px 24px 0', flexShrink: 0
      }}>
        <img src="/bg-register.jpg" style={{
          width: '100%', height: '100%', objectFit: 'cover',
          objectPosition: 'center top'
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to right, transparent, #0a0a0a)'
        }} />
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '2rem 4rem', overflow: 'hidden'
      }}>

        {!awaitingCode ? (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '16px',
              marginBottom: '1.5rem'
            }}>
              <button
                onClick={() => navigate('/login')}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'white', cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: '16px'
                }}
              >⬅︎</button>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
                Уже есть аккаунт?
              </span>
              <Link to="/login" style={{
                color: 'white', fontSize: '14px', fontWeight: '500',
                border: '1px solid rgba(255,255,255,0.25)', borderRadius: '8px',
                padding: '4px 14px', textDecoration: 'none'
              }}>
                Войти
              </Link>
            </div>

            <h1 style={{
              color: 'white', fontSize: '26px', fontWeight: '700',
              lineHeight: '1.2', marginBottom: '1.5rem', maxWidth: '420px'
            }}>
              Создай аккаунт и начни достигать целей
            </h1>

            <div style={{ maxWidth: '460px' }}>
            <div className="reg-input-group">
                <input
                  id="reg-login-field"
                  className="reg-glass-input"
                  type="text"
                  value={login}
                  onChange={e => setLogin(e.target.value)}
                  onFocus={() => setLoginFocused(true)}
                  onBlur={() => setLoginFocused(false)}
                  autoComplete="off"
                  name="reg-login-nofill"
                />
                <label
                  className={'reg-floating-label' + (loginFocused || login ? ' floated' : '')}
                  htmlFor="reg-login-field"
                >
                  Имя
                </label>
              </div>

              <div className="reg-input-group">
                <input
                  id="reg-email-field"
                  className="reg-glass-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  autoComplete="off"
                  name="reg-email-nofill"
                />
                <label
                  className={'reg-floating-label' + (emailFocused || email ? ' floated' : '')}
                  htmlFor="reg-email-field"
                >
                  Email
                </label>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', margin: '-6px 0 12px 4px' }}>
                На него придёт код подтверждения
              </p>

              <div className="reg-input-group" style={{ marginBottom: '8px' }}>
                <input
                  id="reg-password-field"
                  className="reg-glass-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  autoComplete="new-password"
                  name="reg-password-nofill"
                  style={{ paddingRight: '48px' }}
                />
                <label
                  className={'reg-floating-label' + (passwordFocused || password ? ' floated' : '')}
                  htmlFor="reg-password-field"
                >
                  Пароль
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', padding: '4px', cursor: 'pointer',
                    opacity: 0.6, transition: 'opacity 0.15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
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

              {(passwordFocused || password.length > 0) && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 12px 0' }}>
                  {PASSWORD_RULES.map(rule => {
                    const pass = rule.test(password)
                    return (
                      <li key={rule.key} style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '13px', marginBottom: '4px',
                        color: pass ? '#7ee787' : 'rgba(255,255,255,0.45)'
                      }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: '16px', height: '16px', borderRadius: '50%',
                          border: pass ? 'none' : '1px solid rgba(255,255,255,0.3)',
                          background: pass ? '#1d9e75' : 'transparent',
                          color: 'white', fontSize: '11px', flexShrink: 0
                        }}>
                          {pass ? '✓' : ''}
                        </span>
                        {rule.label}
                      </li>
                    )
                  })}
                </ul>
              )}

              {error && (
                <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '8px' }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  width: '100%', padding: '16px',
                  borderRadius: '10px', border: 'none',
                  background: 'rgba(255,255,255,0.15)', color: 'white',
                  fontSize: '16px', fontWeight: '500', cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px', marginTop: '4px'
                }}
              >
                {submitting ? 'Отправляем письмо…' : 'Начать'}
                {!submitting && (
                  <span style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>➡︎</span>
                )}
              </button>

              <p style={{
                color: 'rgba(255,255,255,0.3)', fontSize: '12px',
                marginTop: '16px', lineHeight: '1.6'
              }}>
                Регистрируясь, вы соглашаетесь с{' '}
                <span style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  условиями использования
                </span>{' '}
                и{' '}
                <span style={{ color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}>
                  политикой конфиденциальности
                </span>
              </p>
            </div>
          </>
        ) : (
          <div style={{ maxWidth: '420px', width: '100%' }}>
            {!verified ? (
              <>
                {/* Иллюстрация телефона — состояние синхронизировано с реальным
                    процессом проверки: жёлтый (ждём ввод/проверяем) → зелёный (успех) */}
                <div
                  className={'otp-phone' + (codeSubmitting ? ' verifying' : '')}
                  style={{
                    '--otp-border': codeError ? 'rgba(255,107,107,0.6)' : 'rgba(245,166,35,0.55)',
                    '--otp-icon': codeError ? '#ff6b6b' : '#f5a623',
                    '--otp-glow': codeError ? 'rgba(255,107,107,0.45)' : 'rgba(245,166,35,0.45)',
                  }}
                >
                  <div className={'otp-lock-ring' + (codeSubmitting ? ' verifying' : '')}>
                    {codeSubmitting ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="11" width="14" height="9" rx="2" />
                        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                      </svg>
                    )}
                  </div>
                  <div className="otp-dots">
                    {[0, 1, 2, 3].map(i => (
                      <span key={i} className={'otp-dot' + (code[i] ? ' filled' : '')}>
                        {code[i] ? '✓' : '✦'}
                      </span>
                    ))}
                  </div>
                  <div className="otp-status-pill">
                    {codeSubmitting ? 'Проверяем…' : 'Ждём код'}
                  </div>
                </div>

                <h1 style={{
                  color: 'white', fontSize: '24px', fontWeight: '700',
                  lineHeight: '1.2', marginBottom: '0.75rem', textAlign: 'center'
                }}>
                  {codeSubmitting ? 'Проверяем код…' : 'Подтвердите почту'}
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '1.5rem', textAlign: 'center' }}>
                  Мы отправили 4-значный код на {email}. Код подставится автоматически, как только вы введёте все 4 цифры.
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '14px' }}>
                  {[0, 1, 2, 3].map(i => (
                    <input
                      key={i}
                      ref={el => (digitRefs.current[i] = el)}
                      className="otp-digit-box"
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code[i] || ''}
                      disabled={codeSubmitting}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleDigitKeyDown(i, e)}
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    />
                  ))}
                </div>

                {codeError && (
                  <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '8px', textAlign: 'center' }}>{codeError}</p>
                )}
                {resendMsg && !codeError && (
                  <p style={{ color: '#7ee787', fontSize: '13px', marginBottom: '8px', textAlign: 'center' }}>{resendMsg}</p>
                )}

                <button
                  onClick={() => handleVerify()}
                  disabled={codeSubmitting}
                  style={{
                    width: '100%', padding: '16px',
                    borderRadius: '10px', border: 'none',
                    background: 'rgba(255,255,255,0.15)', color: 'white',
                    fontSize: '16px', fontWeight: '500', cursor: codeSubmitting ? 'default' : 'pointer',
                    opacity: codeSubmitting ? 0.6 : 1,
                    marginTop: '4px', marginBottom: '12px'
                  }}
                >
                  {codeSubmitting ? 'Проверяем…' : 'Подтвердить'}
                </button>

                <button
                  onClick={handleResend}
                  type="button"
                  style={{
                    width: '100%', padding: '10px', background: 'transparent',
                    border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    cursor: 'pointer', textDecoration: 'underline'
                  }}
                >
                  Отправить код ещё раз
                </button>
              </>
            ) : (
              // Финальный зелёный кадр — держится ~1.3с (см. setTimeout в
              // handleVerify), затем автоматически уходим на /home.
              <div style={{ textAlign: 'center', animation: 'otpFadeUp 0.3s ease' }}>
                <div
                  className="otp-phone"
                  style={{
                    '--otp-border': 'rgba(29,158,117,0.65)',
                    '--otp-icon': '#1d9e75',
                    '--otp-glow': 'rgba(29,158,117,0.5)',
                  }}
                >
                  <div className="otp-lock-ring">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="5" y="11" width="14" height="9" rx="2" />
                      <path d="M8 11V8a4 4 0 0 1 3-3.87" />
                      <path d="M16 11V8" />
                    </svg>
                  </div>
                  <div className="otp-dots">
                    {[0, 1, 2, 3].map(i => (
                      <span key={i} className="otp-dot filled">✓</span>
                    ))}
                  </div>
                  <div className="otp-status-pill">Подтверждено ✓</div>
                </div>
                <div className="otp-success-check">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                    <path d="M4 12l5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h1 style={{ color: '#7ee787', fontSize: '22px', fontWeight: '700', marginTop: '18px' }}>
                  Почта подтверждена!
                </h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginTop: '6px' }}>
                  Переносим вас в приложение…
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Register