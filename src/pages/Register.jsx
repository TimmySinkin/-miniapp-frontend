import { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
/*const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'*/
const API_BASE = import.meta.env.VITE_API_URL || 'https://miapp-backend-srx6.onrender.com'

// Те же правила, что и на бэке (RegisterController.validatePassword) —
// дублируем на фронте только для мгновенной обратной связи (галочки),
// финальное решение всё равно принимает сервер.
const PASSWORD_RULES = [
  { key: 'length', label: 'Минимум 6 символов', test: (p) => p.length >= 6 },
  { key: 'upper', label: 'Начинается с заглавной буквы', test: (p) => /^[A-Z]/.test(p) },
  { key: 'digitOrSpecial', label: 'Содержит цифру или спецсимвол', test: (p) => /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/.test(p) },
  { key: 'latinOnly', label: 'Только латиница (без кириллицы)', test: (p) => p.length === 0 || /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]*$/.test(p) },
]

// Иллюстрация телефона из референса (otp-verify-animation.html), адаптированная
// под управление реальным состоянием формы вместо демо-таймлайна:
// stage: 'typing' (ждём код) | 'verifying' (идёт проверка) | 'success' (подтверждено)
function OtpPhoneMockup({ stage, filledCount = 0, colors, time = '9:41', isError = false }) {
  const isSuccess = stage === 'success'
  const cssVars = {
    '--otp-border': colors?.border ?? 'rgba(245,166,35,0.55)',
    '--otp-icon': colors?.icon ?? '#f5a623',
    '--otp-glow': colors?.glow ?? 'rgba(245,166,35,0.45)',
  }
  return (
    <div className={'otp-stage-wrap ' + stage + (isError ? ' error' : '')} style={cssVars}>
      <div className="otp-icon-shield">
        <svg width="46" height="54" viewBox="0 0 24 28" fill="none" stroke="#3ea6ff" strokeWidth="1.8">
          <path d="M12 2 L21 5.5 V13 C21 19 17 23.5 12 26 C7 23.5 3 19 3 13 V5.5 Z" strokeLinejoin="round" />
          <path d="M8.2 13.2 L11 16 L16 10.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="otp-icon-mail">
        <svg width="54" height="42" viewBox="0 0 32 24" fill="none">
          <rect x="1" y="1" width="30" height="22" rx="3" fill="#ffffff" stroke="#d93025" strokeWidth="1.5" />
          <path d="M2 3 L16 14 L30 3" stroke="#d93025" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <div className="otp-phone-wrap">
        <div className="otp-ring otp-ring-warm"></div>
        <div className="otp-ring otp-ring-error"></div>
        <div className="otp-ring otp-ring-cool"></div>
        <div className="otp-side-btn action"></div>
        <div className="otp-side-btn vol-up"></div>
        <div className="otp-side-btn vol-down"></div>
        <div className="otp-side-btn power"></div>
        <div className="otp-phone">
          <div className="otp-dynamic-island"></div>
          <div className="otp-statusbar">
            <span>{time}</span>
            <div className="right">
              <span>5G</span>
              <span className="otp-battery"></span>
            </div>
          </div>

          <div className="otp-lock-ring">
            {isSuccess ? (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 7-2.65" />
              </svg>
            ) : (
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
            )}
          </div>

          <div className="otp-dots">
            {[0, 1, 2, 3].map(i => (
              <span key={i} className={isSuccess || i < filledCount ? 'pop' : ''}>
                {isSuccess ? '✓' : '✦'}
              </span>
            ))}
          </div>

          <div className="otp-pill">
            {isSuccess ? 'Подтверждено ✓' : stage === 'verifying' ? 'Проверяем…' : 'Ждём код'}
          </div>
          <div className="otp-home-indicator"></div>
        </div>
      </div>
    </div>
  )
}

// Локальное время устройства пользователя для статус-бара телефона в
// иллюстрации (формат как в статус-баре iOS: часы без ведущего нуля,
// минуты — с ним, напр. "9:05" или "15:24").
function formatPhoneTime(date) {
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${date.getHours()}:${minutes}`
}

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
  // Таймер на кнопке "Отправить код ещё раз" — повторный запрос кода
  // доступен не чаще раза в минуту.
  const [resendCooldown, setResendCooldown] = useState(0)
  // Экран "Готово" перед переходом на /home — как финальный зелёный кадр
  // в анимации-референсе (иначе успех проскакивает мгновенно и незаметно).
  const [verified, setVerified] = useState(false)
  const digitRefs = useRef([])
  // Время устройства для статус-бара телефона в иллюстрации OTP — реальное,
  // а не захардкоженное "9:41", обновляется раз в минуту.
  const [currentTime, setCurrentTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Таймер повторной отправки: старт сразу после того, как код был впервые
  // отправлен (при переходе на экран подтверждения), и каждый раз заново
  // после успешного "Отправить код ещё раз".
  useEffect(() => {
    if (awaitingCode) {
      setResendCooldown(60)
    }
  }, [awaitingCode])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown(s => (s > 0 ? s - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown > 0])

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
    if (resendCooldown > 0) return
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
        setResendCooldown(60)
      } else {
        setCodeError(text)
      }
    } catch (e) {
      setCodeError('Сервер недоступен')
    }
  }

  return (
    <div className="register-page" style={{
      display: 'flex',
      background: '#0a0a0a'
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

        /* --- Анимация подтверждения кода (полная версия по референсу) --- */
        @property --otp-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        @keyframes otpRotateAngle { to { --otp-angle: 360deg; } }
        @keyframes otpBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes otpDotPop {
          0%   { transform: scale(0.4); opacity: .4; }
          55%  { transform: scale(1.35); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes otpPopIn { from { transform: scale(0.6); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        @keyframes otpFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes otpDrawOutline { to { stroke-dashoffset: 0; } }
        @keyframes otpFillIn { to { opacity: 1; } }
        @keyframes otpHoleShrink { to { r: 0px; } }
        @keyframes otpDrawCheck { to { stroke-dashoffset: 0; } }

        /* floating icons around the phone */
        .otp-stage-wrap { position: relative; width: 380px; margin: 0 auto 8px; }
        .otp-icon-shield, .otp-icon-mail { position: absolute; animation: otpBob 3.2s ease-in-out infinite; }
        .otp-icon-shield { top: 40px; right: 2px; animation-delay: .3s; }
        .otp-icon-mail { top: 240px; left: -10px; animation-delay: 0s; }

        /* rotating gradient ring around the phone frame */
        .otp-phone-wrap { position: relative; width: 264px; margin: 0 auto; border-radius: 50px; }
        .otp-ring {
          position: absolute; inset: -4px; border-radius: 50px; padding: 4px; z-index: 0;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: otpRotateAngle 2.6s linear infinite;
          opacity: 0; transition: opacity .6s ease;
        }
        .otp-ring-warm {
          background: conic-gradient(from var(--otp-angle),
            transparent 0deg, transparent 250deg,
            #f5a623 278deg, #ff8a3d 298deg, #ff6b6b 316deg,
            #ff4fa3 334deg, #b06bff 350deg, transparent 360deg);
          filter: drop-shadow(0 0 8px rgba(245,166,35,0.5));
        }
        .otp-stage-wrap.typing .otp-ring-warm,
        .otp-stage-wrap.verifying .otp-ring-warm { opacity: 1; }
        .otp-stage-wrap.error .otp-ring-warm { opacity: 0; }
        .otp-ring-error {
          background: conic-gradient(from var(--otp-angle),
            transparent 0deg, transparent 250deg,
            #ff3b3b 278deg, #ff0844 298deg, #ff4d6d 316deg,
            #ff0844 334deg, #b8003a 350deg, transparent 360deg);
          filter: drop-shadow(0 0 9px rgba(255,59,59,0.55));
        }
        .otp-stage-wrap.error .otp-ring-error { opacity: 1; }
        .otp-ring-cool {
          background: conic-gradient(from var(--otp-angle),
            transparent 0deg, transparent 250deg,
            #1d9e75 278deg, #2ecc71 298deg, #6ef2a3 316deg,
            #2ecc71 334deg, #1d9e75 350deg, transparent 360deg);
          filter: drop-shadow(0 0 9px rgba(46,204,113,0.5));
        }
        .otp-stage-wrap.success .otp-ring-cool { opacity: 1; }

        .otp-phone {
          position: relative; z-index: 1; margin: 4px;
          padding: 52px 24px 26px; border-radius: 42px;
          background: #0d0d10; display: flex; flex-direction: column;
          align-items: center; gap: 24px; min-height: 560px; overflow: hidden;
        }
        .otp-dynamic-island {
          position: absolute; top: 16px; left: 50%; transform: translateX(-50%);
          width: 92px; height: 28px; background: #000; border-radius: 16px; z-index: 3;
          display: flex; align-items: center; justify-content: flex-end; padding-right: 8px;
        }
        .otp-dynamic-island::after {
          content: ''; width: 9px; height: 9px; border-radius: 50%;
          background: radial-gradient(circle at 35% 35%, #4a4a4c, #000 72%);
        }
        .otp-side-btn { position: absolute; background: linear-gradient(180deg, #3c3c40, #19191b); z-index: 2; }
        .otp-side-btn.action   { left: -3px; top: 118px; width: 3px; height: 26px; border-radius: 3px 0 0 3px; }
        .otp-side-btn.vol-up   { left: -3px; top: 172px; width: 3px; height: 48px; border-radius: 3px 0 0 3px; }
        .otp-side-btn.vol-down { left: -3px; top: 228px; width: 3px; height: 48px; border-radius: 3px 0 0 3px; }
        .otp-side-btn.power    { right: -3px; top: 186px; width: 3px; height: 74px; border-radius: 0 3px 3px 0; }
        .otp-statusbar {
          width: 100%; display: flex; justify-content: space-between; align-items: center;
          font-size: 19px; color: rgba(255,255,255,0.85); font-weight: 600; padding: 0 8px;
        }
        .otp-statusbar .right { display: flex; align-items: center; gap: 6px; }
        .otp-battery {
          width: 28px; height: 15px; border: 2px solid rgba(255,255,255,0.7);
          border-radius: 4px; position: relative; display: inline-block;
        }
        .otp-battery::after {
          content: ''; position: absolute; right: -5px; top: 4px;
          width: 4px; height: 5px; background: rgba(255,255,255,0.7); border-radius: 0 1px 1px 0;
        }
        .otp-battery::before { content: ''; position: absolute; inset: 2px; right: 5px; background: rgba(255,255,255,0.8); }

        .otp-lock-ring {
          width: 82px; height: 82px; border-radius: 50%;
          border: 3px dashed var(--otp-icon, #f5a623);
          display: flex; align-items: center; justify-content: center;
          color: var(--otp-icon, #f5a623);
          margin-top: 10px;
          transition: color 0.4s ease, border-color 0.4s ease;
        }
        .otp-dots { display: flex; gap: 17px; height: 26px; align-items: center; }
        .otp-dots span {
          font-size: 23px; color: var(--otp-icon, #f5a623); display: inline-block;
          transition: color .3s ease;
        }
        .otp-dots span.pop { animation: otpDotPop .45s cubic-bezier(.34,1.56,.64,1); }
        .otp-pill {
          width: 100%; padding: 17px 0; border-radius: 14px; text-align: center;
          font-size: 19px; font-weight: 700; letter-spacing: .02em;
          background: var(--otp-icon, #f5a623); color: #1a1200;
          margin-top: auto;
          transition: background .4s ease, color .4s ease;
        }
        .otp-home-indicator { width: 58px; height: 5px; border-radius: 3px; background: rgba(255,255,255,0.35); margin-top: 6px; }

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

        /* success loader: outline draws -> fills inward -> checkmark reveals (pure CSS, plays on mount) */
        .otp-loader-wrap { height: 78px; display: flex; align-items: center; justify-content: center; margin-bottom: 4px; }
        .otp-outline-circle {
          fill: none; stroke: #2ecc71; stroke-width: 6; stroke-linecap: round;
          stroke-dasharray: 100; stroke-dashoffset: 100;
          transform: rotate(-90deg); transform-origin: 50px 50px;
          animation: otpDrawOutline .6s ease .15s forwards;
        }
        .otp-fill-circle { fill: #2ecc71; opacity: 0; animation: otpFillIn .1s ease .8s forwards; }
        .otp-hole-circle { fill: #0a0a0a; r: 44px; animation: otpHoleShrink .55s cubic-bezier(.45,0,.55,1) .8s forwards; }
        .otp-check-path {
          fill: none; stroke: #06210f; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round;
          stroke-dasharray: 100; stroke-dashoffset: 100;
          animation: otpDrawCheck .3s ease 1.3s forwards;
        }
        .otp-success-check {
          width: 60px; height: 60px; border-radius: 50%;
          background: #1d9e75; color: white;
          display: flex; align-items: center; justify-content: center;
          margin: 6px auto 0; animation: otpPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }

        /* --- Адаптив --- */
        .register-page {
          height: 100vh;
          overflow: hidden;
        }
        .register-image-panel {
          width: 45%;
          flex-shrink: 0;
        }
        .register-form-panel {
          padding: 2rem 4rem;
          box-sizing: border-box;
          min-width: 0;
        }

        /* Ниже 900px — картинка скрывается, форма растягивается на всю ширину */
        @media (max-width: 900px) {
          .register-page { height: auto; min-height: 100vh; flex-direction: column; overflow-y: auto; }
          .register-image-panel { display: none; }
          .register-form-panel { padding: 2.5rem 2rem; width: 100%; overflow: visible; }
        }

        @media (max-width: 480px) {
          .register-form-panel { padding: 2rem 1.25rem; }
          .otp-stage-wrap { width: 100%; max-width: 280px; }
          .otp-phone-wrap { width: 100%; max-width: 220px; }
          .otp-phone { min-height: 460px; padding: 44px 18px 22px; }
          .otp-digit-box { width: 48px; height: 54px; font-size: 20px; }
        }

        /* Узкие смартфоны (~390-400px, напр. iPhone/Pixel в портрете) */
        @media (max-width: 400px) {
          .register-form-panel { padding: 1.5rem 1rem; }
          .otp-stage-wrap { max-width: 240px; }
          .otp-digit-box { width: 42px; height: 48px; font-size: 18px; }
        }
      `}</style>

      <div className="register-image-panel" style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: '0 24px 24px 0'
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

      <div className="register-form-panel" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', overflowY: 'auto'
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
                  Логин
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
                  Почта
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
                <OtpPhoneMockup
                  stage={codeSubmitting ? 'verifying' : 'typing'}
                  filledCount={[0, 1, 2, 3].filter(i => code[i]).length}
                  time={formatPhoneTime(currentTime)}
                  isError={!!codeError}
                  colors={{
                    border: codeError ? 'rgba(255,107,107,0.6)' : 'rgba(245,166,35,0.55)',
                    icon: codeError ? '#ff6b6b' : '#f5a623',
                    glow: codeError ? 'rgba(255,107,107,0.45)' : 'rgba(245,166,35,0.45)',
                  }}
                />

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
                  disabled={resendCooldown > 0}
                  style={{
                    width: '100%', padding: '10px', background: 'transparent',
                    border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '13px',
                    cursor: resendCooldown > 0 ? 'default' : 'pointer',
                    textDecoration: resendCooldown > 0 ? 'none' : 'underline',
                    opacity: resendCooldown > 0 ? 0.5 : 1
                  }}
                >
                  {resendCooldown > 0
                    ? `Отправить код ещё раз (через ${resendCooldown}с)`
                    : 'Отправить код ещё раз'}
                </button>
              </>
            ) : (
              // Финальный зелёный кадр — держится ~1.3с (см. setTimeout в
              // handleVerify), затем автоматически уходим на /home.
              <div style={{ textAlign: 'center', animation: 'otpFadeUp 0.3s ease' }}>
                <OtpPhoneMockup
                  stage="success"
                  time={formatPhoneTime(currentTime)}
                  colors={{ border: 'rgba(29,158,117,0.65)', icon: '#1d9e75', glow: 'rgba(29,158,117,0.5)' }}
                />
                <div className="otp-loader-wrap">
                  <svg width="64" height="64" viewBox="0 0 100 100">
                    <circle className="otp-outline-circle" cx="50" cy="50" r="42" pathLength="100" />
                    <circle className="otp-fill-circle" cx="50" cy="50" r="42" />
                    <circle className="otp-hole-circle" cx="50" cy="50" r="45" />
                    <path className="otp-check-path" d="M30 51 L45 65 L72 33" pathLength="100" />
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