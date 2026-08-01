import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, BarChart3, Target, LogOut } from 'lucide-react'
import AccountSettingsModal from './AccountSettingsModal'
/*const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'*/
const API_BASE = import.meta.env.VITE_API_URL || 'https://miapp-backend-srx6.onrender.com'

// Та же иконка робота, что в шапке AI-агента — чтобы значок был
// визуально одинаковым во всём приложении.
function RobotIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z" />
      <circle cx="9" cy="14" r="1" />
      <circle cx="15" cy="14" r="1" />
    </svg>
  )
}

// Тот же список и порядок пунктов навигации, что и в шапке AI-агента —
// "Календарь" активен здесь, т.к. мы на главной странице календаря.
const NAV_ITEMS = [
  { icon: Calendar, label: 'Календарь', active: true, to: null },
  { icon: RobotIcon, label: 'AI-агент', to: '/ai' },
  { icon: BarChart3, label: 'Статистика', to: '/stats' },
  { icon: Target, label: 'Цели', to: null },
]

const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]
const MONTHS_GEN = [
  'Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня',
  'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'
]
const WEEKDAYS = ['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС']

// Те же категории, что и на странице статистики — цвета и подписи должны совпадать 1-в-1
const CATEGORIES = ['tasks', 'goals', 'leisure']
const CATEGORY_COLORS = {
  tasks: '#534AB7',   // Задачи
  goals: '#1D9E75',   // Личные цели
  leisure: '#EF9F27', // Досуг
}
const CATEGORY_LABELS = {
  tasks: 'Задача',
  goals: 'Цель',
  leisure: 'Досуг',
}

const MONTH_IMAGES = import.meta.glob('../assets/months/*.{jpg,jpeg,png}', { eager: true })

function getImage(monthIndex) {
  const num = String(monthIndex + 1)
  const numPadded = num.padStart(2, '0')
  for (const path in MONTH_IMAGES) {
    if (path.includes(`/${num}.`) || path.includes(`/${numPadded}.`)) {
      return MONTH_IMAGES[path].default
    }
  }
  return null
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOffset(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

const emptyRows = () => ([
  { text: '', count: '', progress: '', category: 'tasks' },
  { text: '', count: '', progress: '', category: 'tasks' },
  { text: '', count: '', progress: '', category: 'tasks' }
])

function Home() {
  const navigate = useNavigate()
  const [login, setLogin] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const year = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const currentDay = new Date().getDate()

  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [rows, setRows] = useState(emptyRows())

  const [authError, setAuthError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Аватарка и имя живут отдельно от /api/me — тянем их из того же
  // эндпоинта, что и модалка настроек, и обновляем при закрытии
  // модалки, чтобы новое фото/имя сразу подхватывались в шапке.
  const loadProfile = () => {
    fetch(`${API_BASE}/api/account/providers`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) { setAvatarUrl(data.avatar_url); setDisplayName(data.name || null) } })
      .catch(() => {})
  }

  // Логин раньше читался напрямую из localStorage (жил там вечно). Теперь
  // источник правды — httpOnly cookie на сервере: /api/me её расшифровывает
  // и отдаёт login, либо 401, если сессии нет или она истекла (например,
  // человек не отмечал "запомнить меня" и закрывал браузер).
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me`, { credentials: 'include' })
      .then(res => {
        if (res.status === 401) {
          if (!cancelled) navigate('/login')
          return null
        }
        if (!res.ok) throw new Error('bad status ' + res.status)
        return res.json()
      })
      .then(data => {
        if (cancelled || !data) return
        setLogin(data.login)
        setAuthChecked(true)
        loadProfile()
      })
      .catch((e) => {
        // Не редиректим молча на /login — если бэкенд просто недоступен
        // (не запущен/не пересобран/CORS), пользователь должен это видеть,
        // а не смотреть на белый экран без объяснений.
        if (!cancelled) setAuthError('Не удалось связаться с сервером: ' + e.message)
      })
    return () => { cancelled = true }
  }, [navigate])

  const dateStr = (day, month) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const loadTasks = async (day, month) => {
    try {
      const res = await fetch(`${API_BASE}/api/tasks/${login}/${dateStr(day, month)}`, { credentials: 'include' })
      const data = await res.json()
      if (data.length > 0) {
        setRows(data.map(t => ({
          text: t.text,
          count: t.goalCount != null ? String(t.goalCount) : '',
          progress: t.progress != null ? String(t.progress) : '',
          category: t.category || 'tasks',
          chatId: t.chatId || null
        })))
      } else {
        setRows(emptyRows())
      }
    } catch (e) {
      console.log('Ошибка загрузки:', e)
    }
  }

  const saveTasks = async (tasksToSave) => {
    if (selectedDay === null || selectedMonth === null) return
    const date = dateStr(selectedDay, selectedMonth)
    const filled = tasksToSave.filter(r => r.text)

    // Разделяем по источнику: вручную добавленные (chatId нет) сохраняем как
    // раньше — одним запросом без chatId. Задачи, пришедшие из плана
    // AI-агента (chatId есть), группируем по chatId и шлём отдельным
    // запросом на каждую группу с этим же chatId в query — иначе бэкенд
    // молча превратит их в "ручные" и продублирует рядом с оригиналом
    // плана при следующем его пересохранении.
    const manual = filled.filter(r => !r.chatId)
    const byChat = {}
    filled.filter(r => r.chatId).forEach(r => {
      if (!byChat[r.chatId]) byChat[r.chatId] = []
      byChat[r.chatId].push(r)
    })

    const toBody = (list) => list.map(r => ({
      text: r.text,
      goalCount: parseFloat(r.count) || null,
      progress: parseFloat(r.progress) || null,
      category: r.category || 'tasks'
    }))

    try {
      await fetch(`${API_BASE}/api/tasks/${login}/${date}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(toBody(manual))
      })
      for (const [chatId, list] of Object.entries(byChat)) {
        await fetch(`${API_BASE}/api/tasks/${login}/${date}?chatId=${encodeURIComponent(chatId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(toBody(list))
        })
      }
    } catch (e) {
      console.log('Ошибка сохранения:', e)
    }
  }

  useEffect(() => {
    if (selectedDay !== null) saveTasks(rows)
  }, [rows])

  // Все hooks (useState/useEffect) объявлены ВЫШЕ этой строки — react требует
  // одинаковый порядок и количество hooks на каждом рендере, поэтому ранний
  // return по состоянию загрузки/ошибки должен идти строго после них,
  // иначе на разных рендерах будет вызвано разное число hooks
  // ("Rendered more hooks than during the previous render").
  if (authError) {
    return (
      <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#c0392b' }}>
        <p>{authError}</p>
        <p style={{ color: '#555', fontSize: 14 }}>
          Проверьте, что бэкенд запущен на {API_BASE} и открыт DevTools → Console/Network для деталей.
        </p>
      </div>
    )
  }
  if (!authChecked) return <div style={{ padding: 24, fontFamily: 'sans-serif' }}>Загрузка…</div>

  const handleDayClick = (day) => {
    if (selectedDay === day) {
      setSelectedDay(null)
    } else {
      setSelectedDay(day)
      loadTasks(day, selectedMonth)
    }
  }

  const addRow = () => setRows(prev => [...prev, { text: '', count: '', progress: '', category: 'tasks' }])
  const removeRow = (i) => setRows(prev => prev.filter((_, idx) => idx !== i))

  /* ─── СТРАНИЦА МЕСЯЦА ─── */
  if (selectedMonth !== null) {
    const days = getDaysInMonth(year, selectedMonth)
    const offset = getFirstDayOffset(year, selectedMonth)

    // Небольшая эвристика подбора иконки под конкретное действие (а не только
    // по категории) — так карточки визуально различаются даже внутри одной
    // категории, как на макете (книга/код/кино — разные пункты плана).
    const pickIcon = (text, category) => {
      const t = (text || '').toLowerCase()
      if (/код|программ|разработ|скрипт/.test(t)) return '💻'
      if (/фильм|кино|сериал|мультфильм/.test(t)) return '🎬'
      if (/книг|читать|изуч|урок|тема|учеб/.test(t)) return '📖'
      if (/бег|пробежк|трениров|отжима|присед|спорт|зал/.test(t)) return '🏋️'
      if (/рисова|дизайн|макет|эффект|монтаж/.test(t)) return '🎨'
      if (/музык|песн|аудио/.test(t)) return '🎵'
      if (category === 'leisure') return '🎬'
      if (category === 'goals') return '🎯'
      return '📋'
    }

    return (
      <div className="month-page-root" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <style>{`
          @keyframes fadeSlideIn { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }

          .month-page-inner { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
          @media (max-width: 640px) { .month-page-inner { padding: 1rem 0.75rem; } }

          .month-header-row { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px; }
          .month-header-left { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
          .month-title { font-size: 30px; font-family: Georgia,serif; color: #111; }
          @media (max-width: 480px) { .month-title { font-size: 22px; } }

          .mini-cal { width: 230px; max-width: 100%; background: white; border-radius: 12px; padding: 0.7rem; box-shadow: 0 2px 10px rgba(0,0,0,0.06); }

          .task-cards-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 20px; }
          @media (max-width: 900px) { .task-cards-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 560px) { .task-cards-grid { grid-template-columns: 1fr; gap: 16px; } }
          .cal-day-light { height:26px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:11px; transition:all 0.15s; user-select:none; cursor:pointer; }
          .cal-day-light:hover { background:#EEEDFE !important; }
          .back-btn-light { background:white; border:1px solid #ddd; border-radius:10px; padding:9px 18px; color:#333; cursor:pointer; font-size:14px; font-weight:500; transition:all 0.15s; box-shadow:0 1px 3px rgba(0,0,0,0.06); }
          .back-btn-light:hover { border-color:#534AB7; color:#534AB7; }
          .legend-pill { display:inline-flex; align-items:center; gap:7px; padding:6px 14px; border-radius:99px; font-size:13px; font-weight:500; }
          .legend-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
          .task-card { background:white; border-radius:16px; padding:20px; box-shadow:0 2px 10px rgba(0,0,0,0.06); display:flex; flex-direction:column; gap:16px; }
          .task-card-header { display:flex; align-items:flex-start; gap:12px; }
          .task-icon { width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; background:#f2f2f7; }
          .task-title-input {
            flex:1; min-width:0; border:none; outline:none; font-size:16px; font-weight:600;
            font-family:Georgia,serif; background:transparent; color:#222;
            resize:none; overflow:hidden; line-height:1.3; padding:0;
            white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere;
          }
          .task-title-input::placeholder { color:#ccc; font-weight:400; }
          .task-remove-btn { opacity:0.35; transition:opacity 0.15s; background:none; border:none; cursor:pointer; color:#999; font-size:16px; flex-shrink:0; margin-top:4px; }
          .task-remove-btn:hover { opacity:1; color:#e55; }
          .task-subsection { background:#f3f3f9; border-radius:14px; padding:14px 16px; }
          .task-section-label { font-size:12px; color:#999; font-weight:600; letter-spacing:0.03em; margin-bottom:8px; }
          .goal-progress-row { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
          .goal-progress-box { width:48px; height:36px; border:1px solid #ddd; border-radius:8px; text-align:center; font-size:14px; font-weight:600; color:#534AB7; outline:none; font-family:Georgia,serif; background:white; }
          .goal-progress-box:focus { border-color:#534AB7; }
          .goal-progress-sep { color:#bbb; font-size:15px; }
          .goal-progress-suffix { font-size:13px; color:#888; margin-left:2px; }
          .task-progress-track { height:8px; background:#e2e2ec; border-radius:99px; overflow:hidden; }
          .task-progress-fill { height:100%; border-radius:99px; background:linear-gradient(to right,#534AB7,#7F77DD); transition:width 0.3s ease; }
          .task-progress-caption { font-size:12px; color:#999; margin-top:8px; }
          .category-dots-row { display:flex; gap:8px; }
          .add-row-btn { background:white; border:1px dashed #bbb; border-radius:99px; padding:10px 22px; cursor:pointer; color:#888; font-size:14px; transition:all 0.15s; font-family:Georgia,serif; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
          .add-row-btn:hover { border-color:#534AB7; color:#534AB7; }
        `}</style>

        {/* Единый контейнер шириной 1100px — как на главной странице с месяцами */}
        <div className="month-page-inner">

          {/* ШАПКА: НАЗАД + МЕСЯЦ/ГОД + МИНИ-КАЛЕНДАРЬ */}
          <div className="month-header-row">
            <div className="month-header-left">
              <button className="back-btn-light" onClick={() => { setSelectedMonth(null); setSelectedDay(null) }}>⬅︎ Назад</button>
              <div className="month-title">
                <span style={{ fontWeight: '800', textTransform: 'uppercase' }}>{MONTHS[selectedMonth]}</span>{' '}
                <span style={{ fontWeight: '400', color: '#888' }}>{year}</span>
              </div>
            </div>

            <div className="mini-cal">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
                {WEEKDAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: '600', color: '#aaa' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
                {Array(offset).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                  const isToday = selectedMonth === currentMonth && day === currentDay
                  const isSelected = day === selectedDay
                  let bg = 'transparent', color = '#555', fontWeight = '400'
                  if (isSelected) { bg = '#534AB7'; color = 'white'; fontWeight = '700' }
                  else if (isToday) { bg = '#EEEDFE'; color = '#534AB7'; fontWeight = '700' }
                  return <div key={day} className="cal-day-light" onClick={() => handleDayClick(day)} style={{ background: bg, color, fontWeight }}>{day}</div>
                })}
              </div>
            </div>
          </div>

          {/* ЛЕГЕНДА КАТЕГОРИЙ */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ fontSize: '13px', color: '#999', marginBottom: '8px', fontWeight: '600' }}>Обозначения</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <span key={cat} className="legend-pill" style={{ background: `${CATEGORY_COLORS[cat]}18`, color: CATEGORY_COLORS[cat] }}>
                  <span className="legend-dot" style={{ background: CATEGORY_COLORS[cat] }} />
                  {CATEGORY_LABELS[cat]}
                </span>
              ))}
            </div>
          </div>

          {/* КАРТОЧКИ ЗАДАЧ ДНЯ */}
          {selectedDay !== null && (
            <div style={{ marginTop: '32px', animation: 'fadeSlideIn 0.3s ease' }}>
              <h2 style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontWeight: '700', color: '#222', marginBottom: '20px' }}>
                {selectedDay} {MONTHS_GEN[selectedMonth]}
              </h2>

              <div className="task-cards-grid">
              {rows.map((row, i) => {
                const goal = parseFloat(row.count) || 0
                const done = parseFloat(row.progress) || 0
                const completed = goal > 0 && done >= goal
                const pct = goal > 0 ? Math.min((done / goal) * 100, 100) : 0
                const category = row.category || 'tasks'

                return (
                  <div key={i} className="task-card">
                    <div className="task-card-header">
                      <div className="task-icon" style={{ background: `${CATEGORY_COLORS[category]}18` }}>
                        {pickIcon(row.text, category)}
                      </div>
                      <textarea
                        className="task-title-input"
                        value={row.text}
                        rows={1}
                        ref={el => {
                          if (el) {
                            el.style.height = 'auto'
                            el.style.height = `${el.scrollHeight}px`
                          }
                        }}
                        onChange={e => {
                          setRows(rows.map((r, idx) => idx === i ? { ...r, text: e.target.value } : r))
                          const el = e.target
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }}
                        placeholder={`Действие ${i + 1}...`}
                        style={{ textDecoration: completed ? 'line-through' : 'none', color: completed ? '#aaa' : '#222' }}
                      />
                      {rows.length > 1 && (
                        <button className="task-remove-btn" onClick={() => removeRow(i)}>✕</button>
                      )}
                    </div>

                    <div className="task-subsection">
                      <div className="task-section-label">Цель и прогресс</div>
                      <div className="goal-progress-row">
                        <input
                          className="goal-progress-box"
                          value={row.count || ''}
                          onChange={e => setRows(rows.map((r, idx) => idx === i ? { ...r, count: e.target.value } : r))}
                          placeholder="0"
                          inputMode="decimal"
                        />
                        <span className="goal-progress-sep">/</span>
                        <input
                          className="goal-progress-box"
                          value={row.progress || ''}
                          onChange={e => setRows(rows.map((r, idx) => idx === i ? { ...r, progress: e.target.value } : r))}
                          placeholder="0"
                          inputMode="decimal"
                        />
                        <span className="goal-progress-suffix">{completed ? 'выполнено' : 'сделано'}</span>
                      </div>
                      <div className="task-progress-track">
                        <div className="task-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="task-progress-caption">{goal || 0} / {done || 0} выполнено</div>
                    </div>

                    <div className="task-subsection">
                      <div className="task-section-label">Категория</div>
                      <div className="category-dots-row">
                        {CATEGORIES.map(cat => {
                          const active = category === cat
                          return (
                            <button key={cat} type="button" title={CATEGORY_LABELS[cat]}
                              onClick={() => setRows(rows.map((r, idx) => idx === i ? { ...r, category: cat } : r))}
                              style={{
                                width: '26px', height: '26px', borderRadius: '50%', cursor: 'pointer',
                                border: active ? `2px solid ${CATEGORY_COLORS[cat]}` : '2px solid transparent',
                                background: active ? CATEGORY_COLORS[cat] : `${CATEGORY_COLORS[cat]}33`,
                                transition: 'all 0.15s', flexShrink: 0, padding: 0
                              }}
                            />
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button className="add-row-btn" onClick={addRow}>+ Добавить строку</button>
          </div>
          )}
        </div>
      </div>
    )
  }

  /* ─── ГЛАВНАЯ ─── */
  return (
    <div className="home-root" style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <style>{`
        .home-root { padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
        @media (max-width: 640px) { .home-root { padding: 1rem 0.75rem; } }

        .home-nav-btn:hover:not(:disabled) { background: #f4f5f9 !important; }
        .home-nav-btn.active:hover:not(:disabled) { background: #efedff !important; }
        .home-logout-btn:hover { background: #f4f5f9 !important; }
        .home-user-btn:hover { background: #f4f5f9; }
        .home-month-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .home-month-card:hover { transform: scale(1.02); box-shadow: 0 8px 28px rgba(0,0,0,0.22); }

        .home-header {
          display: flex; align-items: center; gap: 16px; background: white; border-radius: 12px;
          padding: 14px 28px; margin-bottom: 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,0.08);
          flex-wrap: nowrap; position: relative;
        }
        .home-user-btn { flex-shrink: 0; }
        .home-nav {
          display: flex; align-items: center; gap: 6px;
          position: absolute; left: 50%; transform: translateX(-50%);
        }
        .home-nav::-webkit-scrollbar { display: none; }
        .home-nav-btn { flex-shrink: 0; white-space: nowrap; }
        .home-logout-btn { flex-shrink: 0; margin-left: auto; }

        /* Планшет и телефон: как в AI-агенте — nav возвращается в обычный поток,
           центрируется в оставшемся месте и скроллится по горизонтали, если не влезает */
        @media (max-width: 900px) {
          .home-nav {
            position: static; transform: none; left: auto;
            flex: 1 1 auto; justify-content: center; min-width: 0;
            overflow-x: auto; scrollbar-width: none;
          }
        }

        /* Планшет: чуть уже — только сжимаем отступы, строка не ломается */
        @media (max-width: 768px) {
          .home-header { padding: 12px 16px; gap: 10px; }
          .home-nav { gap: 3px; }
          .home-nav-btn { padding: 7px 10px !important; font-size: 12.5px !important; gap: 5px !important; }
        }

        /* Телефон: всё в одну строку, максимально компактно — как в макете. Если совсем не влезает — меню скроллится по горизонтали, а не обрезается */
        @media (max-width: 480px) {
          .home-header { padding: 8px 10px; gap: 6px; border-radius: 10px; }
          .home-user-btn { padding: 3px 4px; margin: -3px -4px; gap: 5px !important; max-width: 92px; overflow: hidden; }
          .home-user-btn > div:first-child { width: 24px !important; height: 24px !important; font-size: 11px !important; flex-shrink: 0; }
          .home-user-btn span { font-size: 11px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .home-nav { gap: 3px; padding: 0 2px; }
          .home-nav-btn { padding: 6px 8px !important; font-size: 10px !important; gap: 3px !important; border-radius: 7px !important; }
          .home-nav-btn svg { width: 14px !important; height: 14px !important; flex-shrink: 0; }
          .home-nav-btn:not(.active) .home-nav-label { display: none; }
          .home-logout-btn { padding: 7px 10px !important; font-size: 12px !important; gap: 6px !important; }
          .home-logout-btn .home-logout-label { display: none; }
        }
        @media (max-width: 360px) {
          .home-nav-btn { padding: 5px 6px !important; }
        }

        .home-months-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        @media (max-width: 900px) { .home-months-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
        @media (max-width: 480px) { .home-months-grid { gap: 10px; } }

        .month-card-title { font-size: 18px; }
        @media (max-width: 480px) { .month-card-title { font-size: 11.5px; letter-spacing: 0.08em; } }

        .month-card-badge { font-size: 11px; padding: 3px 8px; }
        @media (max-width: 480px) { .month-card-badge { font-size: 8.5px; padding: 2px 5px; top: 8px !important; right: 8px !important; } }
      `}</style>
      <div className="home-header">
        <div className="home-user-btn" onClick={() => setSettingsOpen(true)} title="Настройки аккаунта" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', borderRadius: '10px', padding: '4px 8px', margin: '-4px -8px', transition: 'background 0.15s' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%',
            background: avatarUrl ? `url(${avatarUrl}) center/cover` : '#efedff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: '700', color: '#6a5cf5', fontSize: '13px', flexShrink: 0
          }}>
            {!avatarUrl && (displayName || login)[0].toUpperCase()}
          </div>
          <span style={{ fontSize: '14px', color: '#1e2130' }}>{displayName || login}</span>
        </div>

        <nav className="home-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const disabled = !item.to && !item.active
            return (
              <button key={item.label}
                type="button"
                className={'home-nav-btn' + (item.active ? ' active' : '')}
                onClick={() => item.to && navigate(item.to)}
                disabled={disabled}
                title={disabled ? 'Скоро' : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  border: 'none', background: item.active ? '#efedff' : 'transparent', borderRadius: '10px',
                  padding: '8px 14px', fontSize: '13.5px',
                  fontWeight: item.active ? '600' : '500',
                  color: item.active ? '#6a5cf5' : '#8b8fa3',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  transition: 'background 0.15s'
                }}
              >
                <Icon size={16} />
                <span className="home-nav-label">{item.label}</span>
              </button>
            )
          })}
        </nav>

        <button className="home-logout-btn" onClick={() => {
          fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
            .finally(() => navigate('/login'))
        }}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #e7e8ee', background: 'white', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', color: '#1e2130', cursor: 'pointer', transition: 'background 0.15s' }}>
          <LogOut size={15} />
          <span className="home-logout-label">Выйти</span>
        </button>
      </div>

      <AccountSettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); loadProfile() }} />

      <div className="home-months-grid">
        {MONTHS.map((name, i) => {
          const img = getImage(i)
          const isCurrent = i === currentMonth
          return (
            <div key={i} className="home-month-card" onClick={() => {
              setSelectedMonth(i)
              if (i === currentMonth) {
                // Клик по ТЕКУЩЕМУ месяцу сразу открывает сегодняшний день с
                // карточками задач — не нужно ещё раз тыкать в мини-календарь.
                setSelectedDay(currentDay)
                loadTasks(currentDay, i)
              } else {
                setSelectedDay(null)
              }
            }}
              style={{ borderRadius: '20px', overflow: 'hidden', cursor: 'pointer', border: isCurrent ? '2px solid #534AB7' : 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', position: 'relative', aspectRatio: '3/4' }}
            >
              {img ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', background: '#222' }} />}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.75) 100%)' }} />
              <div className="month-card-title" style={{ position: 'absolute', top: '16px', left: '0', right: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', color: 'white', fontWeight: '400', textTransform: 'uppercase', letterSpacing: '0.2em', fontFamily: 'Georgia,serif' }}>
                {name}
                <div style={{ width: '55%', height: '1.5px', background: 'white', marginTop: '6px' }} />
              </div>
              {isCurrent && <div className="month-card-badge" style={{ position: 'absolute', top: '12px', right: '12px', background: '#534AB7', color: 'white', borderRadius: '6px', fontWeight: '600' }}>сейчас</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Home