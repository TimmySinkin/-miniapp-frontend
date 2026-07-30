import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Chart, registerables } from 'chart.js'
import { Calendar, BarChart3, Target, LogOut } from 'lucide-react'
import AccountSettingsModal from './AccountSettingsModal'
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'
Chart.register(...registerables)

const MONTHS_FULL = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь']
const MONTHS_SHORT = ['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек']
const WEEKDAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс']

// Иконка робота — тот же SVG, что используется в шапке AI-агента,
// чтобы значок был визуально одинаковым во всём приложении.
function RobotIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <circle cx="9" cy="14" r="1"/>
      <circle cx="15" cy="14" r="1"/>
    </svg>
  )
}

// Пункты навигации — те же 4 раздела и порядок, что в шапке AI-агента.
// active стоит только на "Статистика", т.к. мы сейчас на этой странице —
// та же схема (жёстко проставленный active на текущем разделе), что и в
// TopBar из AI.jsx.
const NAV_ITEMS = [
  { icon: Calendar, label: 'Календарь', to: '/home' },
  { icon: RobotIcon, label: 'AI-агент', to: '/ai' },
  { icon: BarChart3, label: 'Статистика', active: true, to: '/stats' },
  { icon: Target, label: 'Цели', to: null },
]

// Цвета категорий — используются в сайдбаре, графике распределения и ежемесячном прогрессе
const CATEGORY_COLORS = {
  tasks: '#534AB7',   // Задачи
  goals: '#1D9E75',   // Личные цели
  leisure: '#EF9F27', // Досуг
}
const CATEGORY_LABELS = {
  tasks: 'Задачи',
  goals: 'Личные цели',
  leisure: 'Досуг',
}

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOffset(year, month) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}
function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
}
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}
function getMonday(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function formatWeekRange(monday) {
  const sunday = addDays(monday, 6)
  if (monday.getMonth() === sunday.getMonth()) {
    return `${monday.getDate()}–${sunday.getDate()} ${MONTHS_SHORT[monday.getMonth()]}`
  }
  // Неделя охватывает два месяца — используем "день + короткое название месяца"
  // вместо "день.месяц" (29.6), чтобы не путать с десятичной дробью.
  return `${monday.getDate()} ${MONTHS_SHORT[monday.getMonth()]} – ${sunday.getDate()} ${MONTHS_SHORT[sunday.getMonth()]}`
}

function MiniCalendar({ year, month, currentDay, currentMonth, currentYear, weekStart, onSelectWeek, onPrevMonth, onNextMonth }) {
  const days = getDaysInMonth(year, month)
  const offset = getFirstDayOffset(year, month)
  const rows = Math.ceil((offset + days) / 7)
  const firstRowMonday = new Date(year, month, 1 - offset)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={onPrevMonth} aria-label="Предыдущий месяц"
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#888', padding: '2px 6px' }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#222' }}>
          {MONTHS_FULL[month]} {year}
        </div>
        <button onClick={onNextMonth} aria-label="Следующий месяц"
          style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#888', padding: '2px 6px' }}>›</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#888', fontWeight: 500 }}>{d}</div>)}
      </div>

      {Array.from({ length: rows }, (_, r) => {
        const rowMonday = addDays(firstRowMonday, r * 7)
        const isSelectedWeek = weekStart && isoDate(rowMonday) === isoDate(weekStart)
        return (
          <div key={r}
            onClick={() => onSelectWeek(rowMonday)}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2,
              cursor: 'pointer', borderRadius: 6, padding: '1px 0', marginBottom: 1,
              background: isSelectedWeek ? '#FBF6E9' : 'transparent',
              boxShadow: isSelectedWeek ? 'inset 0 0 0 1px #EF9F27' : 'none',
            }}
          >
            {Array.from({ length: 7 }, (_, c) => {
              const cellIndex = r * 7 + c
              const day = cellIndex - offset + 1
              if (day < 1 || day > days) return <div key={c} />
              const isToday = month === currentMonth && year === currentYear && day === currentDay
              const cellDate = new Date(year, month, day)
              const isPast = cellDate < new Date(currentYear, currentMonth, currentDay)
              return (
                <div key={c} style={{
                  textAlign: 'center', fontSize: 11, padding: '3px 0',
                  borderRadius: 4,
                  background: isToday ? '#534AB7' : isPast ? '#EEEDFE' : 'transparent',
                  color: isToday ? 'white' : isPast ? '#534AB7' : '#ccc',
                  fontWeight: isToday ? 700 : 400
                }}>{day}</div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function Stats() {
  const navigate = useNavigate()
  const [login, setLogin] = useState(null)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [displayName, setDisplayName] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const now = new Date()

  // Аватарка и имя тянутся отдельно от /api/me, из того же эндпоинта, что
  // и модалка настроек — обновляем при закрытии модалки, чтобы новое
  // фото/имя сразу подхватывались в шапке.
  const loadProfile = () => {
    fetch(`${API_BASE}/api/account/providers`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) { setAvatarUrl(data.avatar_url); setDisplayName(data.name || null) } })
      .catch(() => {})
  }
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()
  const currentDay = now.getDate()

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Отображаемый месяц календаря (можно листать)
  const [displayed, setDisplayed] = useState({ year: currentYear, month: currentMonth })
  // Выбранная неделя (понедельник), по умолчанию — текущая неделя
  const [weekStart, setWeekStart] = useState(getMonday(now))

  const barRef = useRef(null)
  const donutRef = useRef(null)
  const barChart = useRef(null)
  const donutChart = useRef(null)

  // Логин теперь получаем через httpOnly cookie (/api/me), а не из
  // localStorage — так "запомнить меня" реально ограничивает срок жизни
  // сессии, а не просто хранится вечно в браузере.
  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me`, { credentials: 'include' })
      .then(res => {
        if (!res.ok) throw new Error('unauthorized')
        return res.json()
      })
      .then(data => {
        if (cancelled) return
        setLogin(data.login)
        loadProfile()
        return fetch(`${API_BASE}/api/stats/${data.login}`, { credentials: 'include' })
      })
      .then(res => res && res.json())
      .then(data => {
        if (cancelled || !data) return
        setStats(data)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoading(false)
        navigate('/login')
      })
    return () => { cancelled = true }
  }, [navigate])

  const goPrevMonth = () => setDisplayed(d => addMonths(d.year, d.month, -1))
  const goNextMonth = () => setDisplayed(d => addMonths(d.year, d.month, 1))
  const goPrevWeek = () => setWeekStart(w => addDays(w, -7))
  const goNextWeek = () => setWeekStart(w => addDays(w, 7))
  const handleSelectWeek = (monday) => {
    setWeekStart(monday)
    // Отображаемый месяц НЕ переключаем: строка недели всегда принадлежит
    // уже открытой сетке календаря (displayed), даже если её понедельник
    // или воскресенье формально относятся к соседнему месяцу (неполная неделя).
  }

  // Данные недели для графика продуктивности по категориям (в процентах):
  // ожидаем stats.weekly = [{ weekStart:'YYYY-MM-DD', days:[{tasksTotal,tasksDone,goalsTotal,goalsDone,leisureTotal,leisureDone}×7] }]
  // Высота каждого сегмента — доля ВЫПОЛНЕННЫХ задач этой категории от ВСЕХ задач дня,
  // так что сумма сегментов = процент выполнения дня целиком (0-100%).
  const weekData = useMemo(() => {
    const key = isoDate(weekStart)
    const found = stats?.weekly?.find(w => w.weekStart === key)
    const days = found?.days || Array.from({ length: 7 }, () => ({
      tasksTotal: 0, tasksDone: 0, goalsTotal: 0, goalsDone: 0, leisureTotal: 0, leisureDone: 0
    }))
    const pct = (done, dayTotal) => dayTotal > 0 ? Math.round((done / dayTotal) * 100) : 0
    return {
      tasks: days.map(d => pct(d.tasksDone || 0, (d.tasksTotal || 0) + (d.goalsTotal || 0) + (d.leisureTotal || 0))),
      goals: days.map(d => pct(d.goalsDone || 0, (d.tasksTotal || 0) + (d.goalsTotal || 0) + (d.leisureTotal || 0))),
      leisure: days.map(d => pct(d.leisureDone || 0, (d.tasksTotal || 0) + (d.goalsTotal || 0) + (d.leisureTotal || 0))),
    }
  }, [stats, weekStart])

  // Данные месяца по 3 категориям: ожидаем stats.distribution = [{ month:'YYYY-MM', tasks, goals, leisure }]
  const monthKey = `${displayed.year}-${String(displayed.month + 1).padStart(2, '0')}`
  const distribution = useMemo(() => {
    return stats?.distribution?.find(d => d.month === monthKey) || { tasks: 0, goals: 0, leisure: 0 }
  }, [stats, monthKey])
  const distributionTotal = distribution.tasks + distribution.goals + distribution.leisure

  useEffect(() => {
    if (!barRef.current) return
    if (barChart.current) barChart.current.destroy()

    barChart.current = new Chart(barRef.current, {
      type: 'bar',
      data: {
        labels: WEEKDAYS,
        datasets: [
          { label: CATEGORY_LABELS.tasks, data: weekData.tasks, backgroundColor: CATEGORY_COLORS.tasks, borderRadius: 4, borderSkipped: false, stack: 'day' },
          { label: CATEGORY_LABELS.goals, data: weekData.goals, backgroundColor: CATEGORY_COLORS.goals, borderRadius: 4, borderSkipped: false, stack: 'day' },
          { label: CATEGORY_LABELS.leisure, data: weekData.leisure, backgroundColor: CATEGORY_COLORS.leisure, borderRadius: 4, borderSkipped: false, stack: 'day' }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { mode: 'index', callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } } },
        scales: {
          x: { stacked: true, ticks: { font: { size: 11 }, color: '#888' }, grid: { display: false }, border: { display: false } },
          y: {
            stacked: true, min: 0, max: 100,
            ticks: { stepSize: 10, font: { size: 11 }, color: '#888' },
            grid: { color: '#f0f0f0' }, border: { display: false }
          }
        }
      }
    })
  }, [weekData])

  useEffect(() => {
    if (!donutRef.current) return
    if (donutChart.current) donutChart.current.destroy()

    const hasData = distributionTotal > 0

    donutChart.current = new Chart(donutRef.current, {
      type: 'doughnut',
      data: {
        labels: [CATEGORY_LABELS.tasks, CATEGORY_LABELS.goals, CATEGORY_LABELS.leisure],
        datasets: [{
          data: hasData ? [distribution.tasks, distribution.goals, distribution.leisure] : [1, 1, 1],
          backgroundColor: hasData
            ? [CATEGORY_COLORS.tasks, CATEGORY_COLORS.goals, CATEGORY_COLORS.leisure]
            : ['#EEEDFE', '#EEEDFE', '#EEEDFE'],
          borderWidth: 0,
          hoverOffset: hasData ? 4 : 0
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { enabled: hasData, mode: 'nearest' }
        }
      }
    })
  }, [distribution, distributionTotal])

  const monthlyMap = {}
  stats?.monthly?.forEach(m => { monthlyMap[m.month] = m })
  const completionRate = stats?.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0
  const bestMonthName = stats?.bestMonth ? MONTHS_FULL[stats.bestMonth.month - 1] : '—'

  const weekRangeLabel = formatWeekRange(weekStart)

  return (
    <div className="stats-shell">
      <style>{CSS}</style>

      {/* Боковая панель — отдельная карточка на всю высоту экрана, как в AI-агенте */}
      <div className="stats-sidebar">

        {/* Мини-календарь: листание месяцев + выбор недели кликом */}
        <MiniCalendar
          year={displayed.year}
          month={displayed.month}
          currentDay={currentDay}
          currentMonth={currentMonth}
          currentYear={currentYear}
          weekStart={weekStart}
          onSelectWeek={handleSelectWeek}
          onPrevMonth={goPrevMonth}
          onNextMonth={goNextMonth}
        />

        {/* Легенда */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#aaa', letterSpacing: '0.05em', marginBottom: 10 }}>ОБОЗНАЧЕНИЯ</div>
          {[
            { color: CATEGORY_COLORS.tasks, label: CATEGORY_LABELS.tasks },
            { color: CATEGORY_COLORS.goals, label: CATEGORY_LABELS.goals },
            { color: CATEGORY_COLORS.leisure, label: CATEGORY_LABELS.leisure },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: item.color }} />
              <span style={{ fontSize: 13, color: '#555' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Правая колонка: шапка + контент — шапка вложена сюда, поэтому структурно не заходит на сайдбар */}
      <div className="stats-main">

        {/* Навбар — та же разметка и те же классы, что и TopBar в AI.jsx,
            поэтому переход между страницами не "прыгает" по цветам/отступам. */}
        <header className="topbar">
          <div className="topbar-user" onClick={() => setSettingsOpen(true)} title="Настройки аккаунта" style={{ cursor: 'pointer' }}>
            <div className="avatar" style={avatarUrl ? { background: `url(${avatarUrl}) center/cover` } : undefined}>
              {!avatarUrl && (displayName || login ? (displayName || login)[0].toUpperCase() : 'T')}
            </div>
            <span className="user-name">{displayName || login || 'tim'}</span>
          </div>
          <nav className="topbar-nav">
            {NAV_ITEMS.map(item => {
              const Icon = item.icon
              const disabled = !item.to
              return (
                <button
                  key={item.label}
                  type="button"
                  className={'nav-btn' + (item.active ? ' active' : '') + (disabled ? ' disabled' : '')}
                  onClick={() => item.to && navigate(item.to)}
                  disabled={disabled}
                  title={disabled ? 'Скоро' : undefined}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              )
            })}
          </nav>
          <button className="logout-btn" type="button" onClick={() => {
            fetch(`${API_BASE}/api/logout`, { method: 'POST', credentials: 'include' })
              .finally(() => navigate('/login'))
          }}>
            <LogOut size={15} />
            Выйти
          </button>
          <AccountSettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); loadProfile() }} />
        </header>

        {/* Основной контент */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#222' }}>
              {MONTHS_FULL[displayed.month]} {displayed.year}
            </h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #eee', background: 'white', fontSize: 13, color: '#555', cursor: 'pointer' }}>
                📁 Экспорт
              </button>
              <button style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid #eee', background: 'white', fontSize: 13, color: '#555', cursor: 'pointer' }}>
                📈 Отчёты
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: '4rem' }}>Загружаем статистику...</div>
          ) : (
            <>
              {/* KPI карточки */}
              <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', marginBottom: 16, border: '1px solid #eee' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: '1rem' }}>Аналитика действий за месяц</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { label: 'Всего задач', value: stats?.totalTasks || 0, sub: 'за всё время', color: '#534AB7' },
                    { label: 'Выполнено', value: `${completionRate}%`, sub: `${stats?.completedTasks || 0} из ${stats?.totalTasks || 0}`, color: '#1D9E75' },
                    { label: 'Активных дней', value: stats?.activeDays || 0, sub: 'дней с задачами', color: '#EF9F27' },
                  ].map((card, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '1rem', background: '#f9f9f9', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{card.label}</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: card.color, lineHeight: 1 }}>{card.value}</div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>{card.sub}</div>
                      <div style={{ height: 3, background: card.color, borderRadius: 99, marginTop: 10, opacity: 0.3 }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Графики */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* График продуктивности — по дням недели, в процентах, с листанием недель */}
                <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#222' }}>График продуктивности</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={goPrevWeek} aria-label="Предыдущая неделя"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#888', padding: '2px 4px' }}>‹</button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#333', border: '1px solid #eee', borderRadius: 6, padding: '3px 10px' }}>
                        {weekRangeLabel}
                      </span>
                      <button onClick={goNextWeek} aria-label="Следующая неделя"
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#888', padding: '2px 4px' }}>›</button>
                    </div>
                  </div>
                  <div style={{ position: 'relative', height: 200 }}>
                    <canvas ref={barRef} role="img" aria-label="Столбчатый график продуктивности по дням недели, по категориям">График продуктивности по дням недели</canvas>
                  </div>
                </div>


                {/* Donut — распределение по категориям за месяц */}
                <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #eee' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: '1rem' }}>Распределение</div>
                  <div style={{ position: 'relative', height: 160 }}>
                    <canvas ref={donutRef} role="img" aria-label="Круговой график распределения по категориям за месяц">Круговой график распределения</canvas>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginTop: 10 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS.tasks, display: 'inline-block' }} /> Задачи
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS.goals, display: 'inline-block' }} /> Личные цели
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#888' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: CATEGORY_COLORS.leisure, display: 'inline-block' }} /> Досуг
                    </span>
                  </div>
                </div>
              </div>

              {/* Прогресс топ действий */}
              <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #eee', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: '1rem' }}>Топ действия</div>
                {stats?.topActions?.length > 0 ? (
                  stats.topActions.map((action, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 14, color: '#333' }}>{action.text}</span>
                        <span style={{ fontSize: 13, color: '#888' }}>{action.count} раз</span>
                      </div>
                      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          background: ['#534AB7', '#1D9E75', '#EF9F27'][i] || '#534AB7',
                          width: `${Math.round((action.count / (stats.topActions[0]?.count || 1)) * 100)}%`
                        }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#aaa', fontSize: 14 }}>Нет данных — добавь задачи в календарь!</div>
                )}
              </div>

              {/* Ежемесячный прогресс — суммарные значения по каждой категории за отображаемый месяц */}
              <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #eee', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: '1rem' }}>Ежемесячный прогресс</div>
                {distributionTotal > 0 ? (
                  ['tasks', 'goals', 'leisure'].map((cat) => (
                    <div key={cat} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                        <span style={{ fontSize: 14, color: '#333' }}>{CATEGORY_LABELS[cat]}</span>
                        <span style={{ fontSize: 13, color: '#888' }}>{distribution[cat]}</span>
                      </div>
                      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          background: CATEGORY_COLORS[cat],
                          width: `${Math.round((distribution[cat] / distributionTotal) * 100)}%`
                        }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: '#aaa', fontSize: 14 }}>Нет данных — добавь задачи в календарь!</div>
                )}
              </div>

              {/* Самый активный месяц */}
              <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem', border: '1px solid #eee' }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#222', marginBottom: '1rem' }}>🏆 Инсайты</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
                  <div style={{ background: '#EEEDFE', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ fontSize: 12, color: '#534AB7', fontWeight: 500, marginBottom: 4 }}>Самый активный месяц</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#534AB7' }}>{bestMonthName}</div>
                    <div style={{ fontSize: 12, color: '#7F77DD', marginTop: 2 }}>
                      {stats?.bestMonth ? `${stats.bestMonth.total} задач` : 'Нет данных'}
                    </div>
                  </div>
                  <div style={{ background: '#E1F5EE', borderRadius: 10, padding: '1rem' }}>
                    <div style={{ fontSize: 12, color: '#0F6E56', fontWeight: 500, marginBottom: 4 }}>Процент выполнения</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#1D9E75' }}>{completionRate}%</div>
                    <div style={{ fontSize: 12, color: '#5DCAA5', marginTop: 2 }}>всех задач выполнено</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Стили — навбар (.topbar, .topbar-user, .avatar, .user-name, .topbar-nav,
// .nav-btn, .logout-btn) один в один скопирован из CSS-блока AI.jsx, чтобы
// цвета, отступы и hover/active/disabled-состояния шапки не отличались при
// переходе между страницами AI-агента и Статистики.
// ---------------------------------------------------------------------------
const CSS = `
:root {
  --bg: #f4f5f9;
  --panel: #ffffff;
  --border: #e7e8ee;
  --text: #1e2130;
  --text-muted: #8b8fa3;
  --accent: #6a5cf5;
  --accent-soft: #efedff;
}

.stats-shell {
  height: 100vh;
  display: flex;
  background: #f5f5f5;
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.stats-sidebar {
  width: 260px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid #eee;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  overflow-y: auto;
}

.stats-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ---------------- Топбар (идентично AI.jsx) ---------------- */

.topbar {
  display: flex; align-items: center; gap: 24px;
  padding: 14px 28px; background: var(--panel); border-bottom: 1px solid var(--border);
  flex-shrink: 0; position: relative;
}
.topbar-user { display: flex; align-items: center; gap: 8px; }
.avatar {
  width: 32px; height: 32px; border-radius: 50%; background: var(--accent-soft);
  color: var(--accent); display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 13px; flex-shrink: 0;
}
.user-name { font-weight: 600; font-size: 14px; }

.topbar-nav { display: flex; gap: 6px; position: absolute; left: 50%; transform: translateX(-50%); }
.nav-btn {
  display: flex; align-items: center; gap: 7px;
  border: none; background: transparent; border-radius: 10px;
  padding: 8px 14px; font-size: 13.5px; font-weight: 500; color: var(--text-muted);
  cursor: pointer;
}
.nav-btn:hover { background: var(--bg); }
.nav-btn.active { background: var(--accent-soft); color: var(--accent); font-weight: 600; }
.nav-btn.disabled { cursor: not-allowed; opacity: 0.5; }
.nav-btn.disabled:hover { background: transparent; }

.logout-btn {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); background: var(--panel); border-radius: 10px;
  padding: 8px 14px; font-size: 13px; font-weight: 500; color: var(--text); cursor: pointer;
}
.logout-btn:hover { background: var(--bg); }
`

export default Stats