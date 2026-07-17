import { useState } from 'react'
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

  const allPasswordRulesPass = PASSWORD_RULES.every(r => r.test(password))

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

  const handleVerify = async () => {
    if (codeSubmitting) return
    if (!code || code.trim().length !== 4) {
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
        body: JSON.stringify({ login, code: code.trim(), rememberMe: true })
      })
      if (res.ok) {
        navigate('/home')
      } else {
        setCodeError(await res.text())
      }
    } catch (e) {
      setCodeError('Сервер недоступен')
    } finally {
      setCodeSubmitting(false)
    }
  }

  const handleResend = async () => {
    setResendMsg('')
    setCodeError('')
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
          <div style={{ maxWidth: '420px' }}>
            <h1 style={{
              color: 'white', fontSize: '24px', fontWeight: '700',
              lineHeight: '1.2', marginBottom: '0.75rem'
            }}>
              Подтвердите почту
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', marginBottom: '1.5rem' }}>
              Мы отправили 4-значный код на {email}. Введите его ниже — код действителен 10 минут.
            </p>

            <input
              className="reg-input"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="0000"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              autoComplete="one-time-code"
              style={{
                width: '100%', padding: '16px', marginBottom: '12px',
                borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.07)',
                fontSize: '22px', letterSpacing: '10px', textAlign: 'center',
                boxSizing: 'border-box'
              }}
            />

            {codeError && (
              <p style={{ color: '#ffaaaa', fontSize: '13px', marginBottom: '8px' }}>{codeError}</p>
            )}
            {resendMsg && !codeError && (
              <p style={{ color: '#7ee787', fontSize: '13px', marginBottom: '8px' }}>{resendMsg}</p>
            )}

            <button
              onClick={handleVerify}
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
          </div>
        )}
      </div>
    </div>
  )
}

export default Register
