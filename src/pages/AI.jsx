import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Plus,
  Star,
  Calendar,
  BarChart3,
  Target,
  LogOut,
  Paperclip,
  Wand2,
  Send,
  Square,
  Copy,
  Check,
  Pencil,
  Trash2,
  MessageSquare,
  Dumbbell,
  Monitor,
  Palette,
  Globe2,
  GraduationCap,
  PanelLeft,
} from "lucide-react";
import AccountSettingsModal from "./AccountSettingsModal";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

// ---------------------------------------------------------------------------
// Static data
// Sidebar starts empty (no favorites / history / plans yet) to mirror a
// brand-new account, matching the reference screenshot.
// ---------------------------------------------------------------------------

const GOAL_CATEGORIES = [
  { icon: Dumbbell, label: "Фитнес и здоровье", tint: "#fee2e2", fg: "#ef4444" },
  { icon: Monitor, label: "Программирование", tint: "#dbeafe", fg: "#3b82f6" },
  { icon: Palette, label: "Монтаж и дизайн", tint: "#f3e8ff", fg: "#a855f7" },
  { icon: Globe2, label: "Изучение языков", tint: "#dcfce7", fg: "#22c55e" },
  { icon: GraduationCap, label: "Любое обучение", tint: "#fef9c3", fg: "#eab308" },
];

// Иконка робота — тот же SVG, что используется в шапке главной страницы,
// чтобы значок AI-агента был визуально одинаковым во всём приложении.
function RobotIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"/>
      <circle cx="9" cy="14" r="1"/>
      <circle cx="15" cy="14" r="1"/>
    </svg>
  );
}

const NAV_ITEMS = [
  { icon: Calendar, label: "Календарь", to: "/home" },
  { icon: RobotIcon, label: "AI-агент", active: true, to: "/ai" },
  { icon: BarChart3, label: "Статистика", to: "/stats" },
  { icon: Target, label: "Цели", to: null },
];

const GOAL_TEMPLATES = [
  { icon: Dumbbell, label: "Похудеть", text: "Хочу похудеть на 5 кг за 30 дней" },
  { icon: Dumbbell, label: "Пресс", text: "Накачать пресс за 21 день" },
  { icon: Monitor, label: "Python", text: "Выучить Python с нуля за 30 дней" },
  { icon: Monitor, label: "React", text: "Освоить React за 14 дней" },
  { icon: Palette, label: "Монтаж", text: "Научиться монтажу в Premiere Pro за 14 дней" },
  { icon: Globe2, label: "Английский", text: "Выучить английский до разговорного уровня за 60 дней" },
  { icon: GraduationCap, label: "Экзамен", text: "Подготовиться к экзамену за 10 дней" },
];

// Короткий заголовок чата на основе первого сообщения пользователя.
function deriveChatTitle(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return "Новый чат";
  return trimmed.length > 32 ? trimmed.slice(0, 32) + "…" : trimmed;
}

// Пытается вытащить срок цели в днях из текста ("за 30 дней", "за 21 день",
// "за 14 дн."). Возвращает число дней или null, если срок не упомянут —
// используется, чтобы понять, что сообщение описывает "план" с дедлайном.
function parseDurationDays(text) {
  const match = (text || "").match(/(\d+)\s*(дн(?:ей|я|ь)?|day|days)/i);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Возвращает дату в формате YYYY-MM-DD (локальная, без времени) — ключ
// для учёта активности по дням (стрик, счётчик сообщений за день).
function dateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Целое число дней, прошедших между двумя датами (не отрицательное).
function daysBetween(from, to) {
  const ms = new Date(to).setHours(0, 0, 0, 0) - new Date(from).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86400000));
}

const RU_MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

// Форматирует список дат вида ["2026-07-10", "2026-07-11", ...] в короткую
// человекочитаемую подпись: одна дата -> "10 июля 2026", диапазон -> "10–16 июля 2026".
// Нужно, чтобы пользователь сразу видел, на какие даты реально записан план,
// а не гадал (и чтобы это же можно было явно проговорить в чате).
function formatSavedDatesLabel(dateStrs) {
  if (!dateStrs || dateStrs.length === 0) return "";
  const sorted = [...dateStrs].sort();
  const parseLocal = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const first = parseLocal(sorted[0]);
  const last = parseLocal(sorted[sorted.length - 1]);
  const fmt = (d) => `${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
  if (sorted.length === 1 || first.getTime() === last.getTime()) {
    return fmt(first);
  }
  if (first.getFullYear() === last.getFullYear() && first.getMonth() === last.getMonth()) {
    return `${first.getDate()}–${last.getDate()} ${RU_MONTHS_GEN[first.getMonth()]} ${first.getFullYear()}`;
  }
  return `${fmt(first)} – ${fmt(last)}`;
}

const USAGE_STORAGE_KEY_PREFIX = "ai_agent_usage_v1";

// Ключ статистики теперь привязан к логину — иначе "сообщений сегодня" и
// "дней серия" одного аккаунта отражались бы и при входе в другой аккаунт
// в том же браузере (localStorage общий на весь браузер, а не на аккаунт).
function usageStorageKey(login) {
  return login ? `${USAGE_STORAGE_KEY_PREFIX}:${login}` : USAGE_STORAGE_KEY_PREFIX;
}

// Загружает сохранённую статистику использования агента (даты активности +
// счётчик сообщений по дням) и сразу пересчитывает текущие сегодня/стрик.
function loadUsageStats(login) {
  let data = { dates: [], counts: {} };
  try {
    const raw = localStorage.getItem(usageStorageKey(login));
    if (raw) data = JSON.parse(raw);
  } catch {
    // повреждённые данные — начинаем с чистого листа
  }
  return computeUsageStats(data);
}

function computeUsageStats(data) {
  const today = dateKey(new Date());
  const messagesToday = data.counts?.[today] || 0;

  const datesSet = new Set(data.dates || []);
  let streakDays = 0;
  const cursor = new Date();
  while (datesSet.has(dateKey(cursor))) {
    streakDays++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { messagesToday, streakDays };
}

// Фиксирует факт отправки сообщения агенту "сегодня" — обновляет
// localStorage и возвращает свежий пересчитанный объект статистики.
function recordAgentUsage(login) {
  let data = { dates: [], counts: {} };
  try {
    const raw = localStorage.getItem(usageStorageKey(login));
    if (raw) data = JSON.parse(raw);
  } catch {
    // игнорируем повреждённые данные
  }

  const today = dateKey(new Date());
  data.counts = data.counts || {};
  data.counts[today] = (data.counts[today] || 0) + 1;
  data.dates = data.dates || [];
  if (!data.dates.includes(today)) data.dates.push(today);

  try {
    localStorage.setItem(usageStorageKey(login), JSON.stringify(data));
  } catch {
    // localStorage может быть недоступен (приватный режим и т.п.) — не критично
  }

  return computeUsageStats(data);
}

// Категория чата: эмодзи + цвета бейджа, подбираются по ключевым словам
// в первом сообщении — чтобы история чатов выглядела как на референсе
// (цветной кружок с иконкой перед названием).
function deriveChatCategory(text) {
  const t = (text || "").toLowerCase();

  if (/питани|диет|похуде|калори|рацион/.test(t)) {
    return { emoji: "🍽️", tint: "#fce7f3", fg: "#db2777" };
  }
  if (/фитнес|трениров|спорт|бег|отжима|пресс|качалк|зал/.test(t)) {
    return { emoji: "🏋️", tint: "#ffedd5", fg: "#ea580c" };
  }
  if (/сон|высыпа|режим дня|бессонниц/.test(t)) {
    return { emoji: "😴", tint: "#e0e7ff", fg: "#6366f1" };
  }
  if (/медитац|осознанност|стресс|тревож|психолог/.test(t)) {
    return { emoji: "🧘", tint: "#ccfbf1", fg: "#0d9488" };
  }
  if (/финанс|бюджет|деньги|накоп|инвест|доход/.test(t)) {
    return { emoji: "💰", tint: "#fef9c3", fg: "#ca8a04" };
  }
  if (/бизнес|стартап|предпринимат|продаж|маркетинг/.test(t)) {
    return { emoji: "📈", tint: "#dcfce7", fg: "#15803d" };
  }
  if (/react|vue|frontend|фронтенд|javascript|typescript/.test(t)) {
    return { emoji: "⚛️", tint: "#cffafe", fg: "#0891b2" };
  }
  if (/python|программ|код|backend|бэкенд|разработ|алгоритм/.test(t)) {
    return { emoji: "💻", tint: "#dbeafe", fg: "#3b82f6" };
  }
  if (/монтаж|premiere|видеоредак/.test(t)) {
    return { emoji: "🎬", tint: "#ede9fe", fg: "#7c3aed" };
  }
  if (/дизайн|figma|макет|ui\/ux|иллюстрац/.test(t)) {
    return { emoji: "🎨", tint: "#f3e8ff", fg: "#a855f7" };
  }
  if (/фото|фотографир|съёмк|съемк/.test(t)) {
    return { emoji: "📷", tint: "#fee2e2", fg: "#dc2626" };
  }
  if (/музык|играть на|гитар|пианино|вокал/.test(t)) {
    return { emoji: "🎸", tint: "#ffe4e6", fg: "#e11d48" };
  }
  if (/готов|кулинар|рецепт|печь|выпечк/.test(t)) {
    return { emoji: "🍳", tint: "#fff7ed", fg: "#c2410c" };
  }
  if (/книг|читать|чтени|литератур/.test(t)) {
    return { emoji: "📖", tint: "#fef3c7", fg: "#b45309" };
  }
  if (/путешеств|поездк|отпуск|туризм/.test(t)) {
    return { emoji: "✈️", tint: "#e0f2fe", fg: "#0284c7" };
  }
  if (/дом|уборк|порядок|быт/.test(t)) {
    return { emoji: "🏠", tint: "#fae8ff", fg: "#a21caf" };
  }
  if (/семь[яи]|отношени|партнер|ребен|детьми/.test(t)) {
    return { emoji: "❤️", tint: "#ffe4e6", fg: "#be123c" };
  }
  if (/английск|немецк|испанск|француз|итальянск|китайск|язык/.test(t)) {
    return { emoji: "🌍", tint: "#dcfce7", fg: "#16a34a" };
  }
  if (/экзамен|учеб|обучен|курс|диплом|конспект/.test(t)) {
    return { emoji: "📚", tint: "#fef3c7", fg: "#d97706" };
  }
  if (/карьер|резюме|собеседован|работ[ауы]/.test(t)) {
    return { emoji: "💼", tint: "#e0e7ff", fg: "#4f46e5" };
  }
  return { emoji: "🎯", tint: "#f1f0fe", fg: "#6a5cf5" };
}

// Обратная совместимость: просто эмодзи без цвета (не используется в новом
// рендере сайдбара, но оставлена на случай прямого вызова).
function deriveChatIcon(text) {
  return deriveChatCategory(text).emoji;
}

// Группирует чаты на "сегодня" / "вчера" / остальные по дате создания —
// используется в сайдбаре для секций "История чатов".
function groupChatsByDay(chats) {
  const todayStr = new Date().toDateString();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toDateString();

  const today = [];
  const yesterday = [];
  const older = [];

  chats.forEach((c) => {
    const d = new Date(c.createdAt).toDateString();
    if (d === todayStr) today.push(c);
    else if (d === yesterdayStr) yesterday.push(c);
    else older.push(c);
  });

  return { today, yesterday, older };
}

// ---------------------------------------------------------------------------
// Markdown rendering helpers
// ---------------------------------------------------------------------------

// Простой безопасный markdown-парсер: экранирует HTML, затем поддерживает
// **жирный**, *курсив*, `код`, заголовки (#, ##, ###), маркированные и
// нумерованные списки, переносы строк.
function renderMarkdown(text) {
  if (!text) return "";

  let escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Инлайн код `code`
  escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Жирный **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Курсив *text* (после жирного, чтобы не конфликтовать)
  escaped = escaped.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Заголовки любого уровня (#, ##, ###, ####, #####, ######)
  escaped = escaped.replace(/^#{6} (.+)$/gm, "<h6>$1</h6>");
  escaped = escaped.replace(/^#{5} (.+)$/gm, "<h5>$1</h5>");
  escaped = escaped.replace(/^#{4} (.+)$/gm, "<h4>$1</h4>");
  escaped = escaped.replace(/^#{3} (.+)$/gm, "<h4>$1</h4>");
  escaped = escaped.replace(/^#{2} (.+)$/gm, "<h3>$1</h3>");
  escaped = escaped.replace(/^# (.+)$/gm, "<h2>$1</h2>");
  // Маркированные списки "- item"
  escaped = escaped.replace(/^- (.+)$/gm, "<li>$1</li>");
  // Нумерованные списки "1. item"
  escaped = escaped.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  // Оборачиваем идущие подряд <li> в <ul>
  escaped = escaped.replace(/(<li>.*?<\/li>\n?)+/gs, (match) => `<ul>${match}</ul>`);

  // Таблицы Markdown:
  // | Заголовок 1 | Заголовок 2 |
  // | --- | --- |
  // | значение | значение |
  escaped = escaped.replace(
    /^\|(.+)\|\s*\n\|[\s:|-]+\|\s*\n((?:\|.*\|\s*\n?)+)/gm,
    (match, headerRow, bodyRows) => {
      const headers = headerRow
        .split("|")
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      const rows = bodyRows
        .trim()
        .split("\n")
        .map((row) =>
          row
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((c) => c.trim())
        );

      const theadCells = headers.map((h) => `<th>${h}</th>`).join("");
      const tbodyRows = rows
        .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join("");

      return `<table><thead><tr>${theadCells}</tr></thead><tbody>${tbodyRows}</tbody></table>`;
    }
  );

  // Убираем возможные переносы строк внутри уже сформированных блоков (h*, ul, table)
  escaped = escaped.replace(/(<\/(?:h2|h3|h4|h5|h6|ul|table)>)\n/g, "$1");
  // Двойной перенос — новый абзац, одиночный — <br/>
  escaped = escaped
    .split(/\n{2,}/)
    .map((block) =>
      /^<(h2|h3|h4|h5|h6|ul|table)/.test(block) ? block : `<p>${block.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  return escaped;
}

// Убирает markdown-разметку, оставляя читаемый обычный текст —
// используется как text/plain фолбэк при копировании форматированного ответа.
function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, "").trim())
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-*]\s+/gm, "• ")
    .replace(/^\d+\.\s+/gm, (m) => m);
}

// Универсальное копирование в буфер обмена. Пытается использовать
// современный Clipboard API, а если он недоступен (нет HTTPS/localhost,
// нет фокуса окна, старый браузер) — откатывается на document.execCommand.
// Возвращает true только при реальном успехе, чтобы UI не врал о статусе.
async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // падаем в fallback ниже
    }
  }
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

// Копирует ответ ИИ с сохранением стилей (жирный, заголовки, списки,
// таблицы) — вставится форматированным текстом в Google Docs, Word,
// Slack, почту и т.д. Параллельно кладёт в буфер обычный текст-фолбэк
// на случай, если получатель поддерживает только text/plain.
async function copyRichText(html, plainFallback) {
  if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
    try {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([plainFallback], { type: "text/plain" }),
      });
      await navigator.clipboard.write([item]);
      return true;
    } catch {
      // падаем в обычное копирование текста ниже
    }
  }
  return copyToClipboard(plainFallback);
}
// Возвращает код языка, который отправляется на бэкенд, чтобы модель
// могла отвечать строго на том же языке.
function detectLang(str) {
  if (/[а-яёіїєґ]/i.test(str)) return "ru";
  if (/[а-щьюя]/i.test(str)) return "ru";
  return "en";
}

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function ProgressBar({ pct, color }) {
  return (
    <div className="progress-track">
      <div
        className="progress-fill"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="typing-dots" aria-label="Печатает">
      <span />
      <span />
      <span />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onToggleFavorite,
  onRenameChat,
  onDeleteChat,
  onRemovePlan,
  usageStats,
  goalsCount,
  collapsed,
  onToggle,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const editInputRef = useRef(null);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (c) => !query || c.title.toLowerCase().includes(query);

  const favoriteChats = chats.filter((c) => c.favorite && matchesQuery(c));
  const historyChats = chats.filter((c) => !c.favorite && matchesQuery(c));
  const { today, yesterday, older } = groupChatsByDay(historyChats);
  const hasAnyHistory = historyChats.length > 0;
  const noSearchResults = query && favoriteChats.length === 0 && historyChats.length === 0;

  const startEditing = (c) => {
    setEditingId(c.id);
    setEditingValue(c.title);
  };

  const commitEditing = () => {
    const trimmed = editingValue.trim();
    if (editingId && trimmed) {
      onRenameChat(editingId, trimmed);
    }
    setEditingId(null);
  };

  const renderChatRow = (c) => {
    const isEditing = editingId === c.id;
    return (
      <li
        key={c.id}
        className={"chat-row" + (c.id === activeChatId ? " chat-row-active" : "")}
        onClick={() => !isEditing && onSelectChat(c.id)}
      >
        <span
          className="chat-emoji"
          style={{ background: c.iconTint || "#f1f0fe", color: c.iconFg || "#6a5cf5" }}
        >
          {c.icon}
        </span>
        {isEditing ? (
          <input
            ref={editInputRef}
            className="chat-rename-input"
            value={editingValue}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEditing();
              if (e.key === "Escape") setEditingId(null);
            }}
            onBlur={commitEditing}
          />
        ) : (
          <span className="chat-label">{c.title}</span>
        )}
        {!isEditing && <span className="chat-time">{c.time}</span>}
        <span className="chat-actions">
          <button
            type="button"
            className={"chat-action-btn" + (c.favorite ? " chat-action-active" : "")}
            title={c.favorite ? "Убрать из избранного" : "В избранное"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(c.id);
            }}
          >
            <Star size={13} fill={c.favorite ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            className="chat-action-btn"
            title="Переименовать"
            onClick={(e) => {
              e.stopPropagation();
              startEditing(c);
            }}
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="chat-action-btn chat-action-danger"
            title="Удалить чат"
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Удалить чат «${c.title}»?`)) {
                onDeleteChat(c.id);
              }
            }}
          >
            <Trash2 size={13} />
          </button>
        </span>
      </li>
    );
  };

  return (
    <aside className={"sidebar" + (collapsed ? " sidebar-collapsed" : "")}>
      <div className="sidebar-inner">
      <div className="sidebar-search-row">
        <div className="sidebar-search">
          <Search size={16} className="sidebar-search-icon" />
          <input
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
            >
              ×
            </button>
          ) : (
            <kbd>Себек</kbd>
          )}
        </div>
        <button
          type="button"
          className="sidebar-toggle-btn"
          title="Закрыть боковую панель"
          aria-label="Закрыть боковую панель"
          onClick={onToggle}
        >
          <PanelLeft size={16} />
        </button>
      </div>

      <button className="new-chat-btn" type="button" onClick={onNewChat}>
        <Plus size={17} />
        Новый чат
      </button>

      <div className="sidebar-scroll">
        {noSearchResults ? (
          <p className="empty-hint">Ничего не найдено по запросу «{searchQuery.trim()}»</p>
        ) : (
          <>
            <section className="sidebar-section">
              <div className="sidebar-section-head plain">
                <Star size={13} />
                <span>Избранное</span>
              </div>
              {favoriteChats.length > 0 ? (
                <ul className="chat-list">{favoriteChats.map(renderChatRow)}</ul>
              ) : (
                !query && <p className="empty-hint">Пока пусто</p>
              )}
            </section>

            <section className="sidebar-section">
              <div className="sidebar-section-head plain">
                <MessageSquare size={13} />
                <span>История чатов</span>
              </div>

              {today.length > 0 && (
                <>
                  <div className="history-group-label">Сегодня</div>
                  <ul className="chat-list">{today.map(renderChatRow)}</ul>
                </>
              )}

              {yesterday.length > 0 && (
                <>
                  <div className="history-group-label">Вчера</div>
                  <ul className="chat-list">{yesterday.map(renderChatRow)}</ul>
                </>
              )}

              {older.length > 0 && (
            <>
              <div className="history-group-label">Ранее</div>
              <ul className="chat-list">{older.map(renderChatRow)}</ul>
            </>
          )}

          {!hasAnyHistory && (
            <p className="empty-hint">Начните диалог — он появится здесь</p>
          )}

          {hasAnyHistory && (
            <button className="show-more-btn" type="button">
              Показать больше <span className="chev">v</span>
            </button>
          )}
        </section>
          </>
        )}

        <section className="panel-card">
          <div className="panel-title">
            <Target size={14} />
            <span>Активные планы</span>
          </div>
          {(() => {
            const activePlans = chats.filter((c) => c.plan);
            if (activePlans.length === 0) {
              return <p className="empty-hint">Пока нет активных планов</p>;
            }
            return (
              <ul className="plan-list">
                {activePlans.map((c) => {
                  // Прогресс приходит с бэкенда уже посчитанным по факту закрытых
                  // дней в календаре (см. AiChatController.computePlanProgress) —
                  // никакой ручной корректировки или расчёта "по дням от старта"
                  // тут больше нет, это было бы враньём относительно реального
                  // выполнения плана.
                  const pct = c.plan.progress || 0;
                  return (
                    <li key={c.id} className="plan-row">
                      <div className="plan-row-top">
                        <span
                          className="plan-emoji"
                          style={{ background: c.iconTint, color: c.iconFg }}
                        >
                          {c.icon}
                        </span>
                        <span className="plan-label">{c.title}</span>
                        <span className="plan-value">{pct}%</span>
                        <button
                          type="button"
                          className="plan-remove-btn"
                          title="Убрать из активных планов"
                          onClick={() => onRemovePlan(c.id)}
                        >
                          ×
                        </button>
                      </div>
                      <ProgressBar pct={pct} color={c.iconFg} />
                    </li>
                  );
                })}
              </ul>
            );
          })()}
        </section>

        <section className="panel-card">
          <div className="panel-title">
            <BarChart3 size={14} />
            <span>Сегодня</span>
          </div>
          <div className="stats-row">
            <div className="stat-item">
              <div className="stat-num">{usageStats.messagesToday}</div>
              <div className="stat-label">сообщений</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">{goalsCount}</div>
              <div className="stat-label">цели</div>
            </div>
            <div className="stat-item">
              <div className="stat-num">
                {usageStats.streakDays > 0 ? `${usageStats.streakDays} 🔥` : "–"}
              </div>
              <div className="stat-label">дней серия</div>
            </div>
          </div>
        </section>
      </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Top bar
// ---------------------------------------------------------------------------

function TopBar() {
  const navigate = useNavigate();
  const [login, setLogin] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Аватарка тянется отдельно от /api/me, из того же эндпоинта, что
  // и модалка настроек — обновляем при закрытии модалки, чтобы новое
  // фото сразу подхватывалось в шапке.
  const loadAvatar = () => {
    fetch(`${API_BASE}/api/account/providers`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data) setAvatarUrl(data.avatar_url); })
      .catch(() => {});
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/me`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled && data) { setLogin(data.login); loadAvatar(); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleLogout = () => {
    fetch(`${API_BASE}/api/logout`, { method: "POST", credentials: "include" })
      .finally(() => navigate("/login"));
  };

  return (
    <header className="topbar">
      <div className="topbar-user" onClick={() => setSettingsOpen(true)} title="Настройки аккаунта" style={{ cursor: "pointer" }}>
        <div className="avatar" style={avatarUrl ? { background: `url(${avatarUrl}) center/cover` } : undefined}>
          {!avatarUrl && (login ? login[0].toUpperCase() : "T")}
        </div>
        <span className="user-name">{login || "tim"}</span>
      </div>
      <nav className="topbar-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const disabled = !item.to;
          return (
            <button
              key={item.label}
              type="button"
              className={"nav-btn" + (item.active ? " active" : "") + (disabled ? " disabled" : "")}
              onClick={() => item.to && navigate(item.to)}
              disabled={disabled}
              title={disabled ? "Скоро" : undefined}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>
      <button className="logout-btn" type="button" onClick={handleLogout}>
        <LogOut size={15} />
        Выйти
      </button>
      <AccountSettingsModal open={settingsOpen} onClose={() => { setSettingsOpen(false); loadAvatar(); }} />
    </header>
  );
}

// ---------------------------------------------------------------------------
// Chat area
// ---------------------------------------------------------------------------

function WelcomeMessage() {
  const [copied, setCopied] = useState(false);
  const [time] = useState(() =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
  );

  const welcomeText =
    "Привет! Я твой AI-агент 🤖\n\n" +
    "Могу составить персональный план для любой цели:\n" +
    GOAL_CATEGORIES.map((g) => `- ${g.label}`).join("\n") +
    "\n\nПросто напиши цель и срок, например:\n" +
    "«Хочу научиться … за срок»";

  const welcomeHtml =
    "<p><strong>Привет! Я твой AI-агент 🤖</strong></p>" +
    "<p>Могу составить <strong>персональный план</strong> для любой цели:</p>" +
    "<ul>" +
    GOAL_CATEGORIES.map((g) => `<li>${g.label}</li>`).join("") +
    "</ul>" +
    "<p>Просто напиши цель и срок, например:</p>" +
    "<p><em>«Хочу научиться … за срок»</em></p>";

  const handleCopy = async () => {
    const ok = await copyRichText(welcomeHtml, welcomeText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="msg-row">
      <div className="bot-avatar">🤖</div>
      <div className="bubble bot-bubble">
        <p className="bubble-greeting">
          Привет! Я твой AI-агент <span>🤖</span>
        </p>
        <p className="bubble-lead">
          Могу составить <strong>персональный план</strong> для любой цели:
        </p>
        <ul className="goal-list">
          {GOAL_CATEGORIES.map((g) => {
            const Icon = g.icon;
            return (
              <li key={g.label}>
                <span
                  className="goal-icon"
                  style={{ background: g.tint, color: g.fg }}
                >
                  <Icon size={14} />
                </span>
                {g.label}
              </li>
            );
          })}
        </ul>
        <p className="bubble-lead">
          Просто напиши цель и срок, например:
        </p>
        <p className="bubble-example">
          &ldquo;Хочу научиться … за срок&rdquo;
        </p>
        <div className="bubble-footer">
          <span className="bubble-time">{time}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopy}
            aria-label="Скопировать"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function BotMessage({ text, time, canAcceptPlan, onSaveToCalendar }) {
  const [copied, setCopied] = useState(false);
  const [savingToCalendar, setSavingToCalendar] = useState(false);
  const [savedToCalendar, setSavedToCalendar] = useState(false);
  const [savedDateLabel, setSavedDateLabel] = useState("");
  const [calendarError, setCalendarError] = useState(false);

  const handleCopy = async () => {
    const html = renderMarkdown(text);
    const ok = await copyRichText(html, stripMarkdown(text));
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };


  const handleSaveToCalendar = async () => {
    setSavingToCalendar(true);
    setCalendarError(false);
    const result = await onSaveToCalendar();
    setSavingToCalendar(false);
    if (result && result.ok) {
      setSavedToCalendar(true);
      setSavedDateLabel(result.label || "");
    } else {
      setCalendarError(true);
    }
  };

  return (
    <div className="msg-row">
      <div className="bot-avatar">🤖</div>
      <div className="bubble bot-bubble">
        <div
          className="md-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
        {canAcceptPlan && (
          <div className="plan-actions-row">
            <button
              type="button"
              className={"calendar-plan-btn" + (savedToCalendar ? " calendar-plan-btn-done" : "")}
              onClick={handleSaveToCalendar}
              disabled={savingToCalendar || savedToCalendar}
            >
              {savedToCalendar ? (
                <>
                  <Check size={14} /> Записано{savedDateLabel ? `: ${savedDateLabel}` : " в календарь"}
                </>
              ) : (
                <>
                  <Calendar size={14} /> {savingToCalendar ? "Записываю…" : "Записать в календарь"}
                </>
              )}
            </button>
            {calendarError && (
              <span className="calendar-error-hint">Не удалось записать — попробуй ещё раз</span>
            )}
          </div>
        )}
        <div className="bubble-footer">
          <span className="bubble-time">{time}</span>
          <button
            type="button"
            className="copy-btn"
            onClick={handleCopy}
            aria-label="Скопировать"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ text, time, attachments }) {
  return (
    <div className="msg-row user-row">
      <div className="bubble user-bubble">
        {attachments && attachments.length > 0 && (
          <div className="msg-attachments">
            {attachments.map((a, idx) =>
              a.type === "image" && a.previewUrl ? (
                <img key={a.id || idx} src={a.previewUrl} alt={a.name} className="msg-attachment-img" />
              ) : (
                <div key={a.id || idx} className="msg-attachment-file">
                  <Paperclip size={12} />
                  <span>{a.name}</span>
                </div>
              )
            )}
          </div>
        )}
        {text && <p>{text}</p>}
        <div className="user-bubble-footer">
          <span>{time}</span>
          <Check size={13} />
        </div>
      </div>
      <div className="avatar small">T</div>
    </div>
  );
}

function TypingMessage() {
  return (
    <div className="msg-row">
      <div className="bot-avatar">🤖</div>
      <div className="bubble bot-bubble typing-bubble">
        <span>Думаю</span>
        <TypingDots />
      </div>
    </div>
  );
}

function ChatArea({ activeChat, onCreateChat, onAddMessage, onAddPlan, onMessageSent, login }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);
  const [typingChatId, setTypingChatId] = useState(null);
  // typing — вычисляемый флаг ТОЛЬКО для активного чата: если генерация идёт
  // в другом чате (пользователь переключился, пока ответ ещё генерируется),
  // "Думаю" не должно показываться здесь — иначе индикатор "едет" за
  // пользователем между чатами независимо от того, где реально идёт генерация.
  const typing = typingChatId === activeChat?.id;
  const [attachments, setAttachments] = useState([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const templatesRef = useRef(null);
  // Map chatId -> AbortController — раньше был один общий ref на весь
  // компонент, из-за чего "Стоп" в одном чате мог оборвать генерацию
  // совсем другого чата, если переключиться, пока она ещё идёт.
  const abortControllersRef = useRef(new Map());

  const messages = activeChat ? activeChat.messages : [];

  // При переключении на другой чат (или в "новый чат") сбрасываем черновик
  // ввода и вложения — они относятся к предыдущему контексту.
  useEffect(() => {
    setValue("");
    setAttachments([]);
    setTemplatesOpen(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }, [activeChat?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  useEffect(() => {
    if (!templatesOpen) return;
    const handleClickOutside = (e) => {
      if (templatesRef.current && !templatesRef.current.contains(e.target)) {
        setTemplatesOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [templatesOpen]);

  const applyTemplate = (text) => {
    setValue(text);
    setTemplatesOpen(false);
  };

  const nowTime = () =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  const TEXT_EXTENSIONS = [".txt", ".md", ".csv", ".json", ".log"];
  const MAX_TEXT_CHARS = 20000; // не отправляем модели гигантские файлы целиком

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });

  const readFileAsBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // reader.result выглядит как "data:image/png;base64,AAAA..."
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFilesSelected = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // чтобы можно было выбрать тот же файл повторно

    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      const isText = TEXT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));

      if (isImage) {
        try {
          const base64 = await readFileAsBase64(file);
          setAttachments((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              name: file.name,
              type: "image",
              content: base64,
              previewUrl: URL.createObjectURL(file),
            },
          ]);
        } catch {
          alert(`Не удалось прочитать файл ${file.name}`);
        }
      } else if (isText) {
        try {
          let text = await readFileAsText(file);
          if (text.length > MAX_TEXT_CHARS) {
            text = text.slice(0, MAX_TEXT_CHARS) + "\n...[файл обрезан]";
          }
          setAttachments((prev) => [
            ...prev,
            { id: crypto.randomUUID(), name: file.name, type: "text", content: text },
          ]);
        } catch {
          alert(`Не удалось прочитать файл ${file.name}`);
        }
      } else {
        alert(
          `Файл "${file.name}" не поддерживается. Можно прикреплять текстовые файлы (.txt, .md, .csv, .json, .log) и изображения.`
        );
      }
    }
  };

  const removeAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    const text = value.trim();
    if ((!text && attachments.length === 0) || typing) return;

    const lang = detectLang(text || "ru");

    // Если это первое сообщение — создаём новый чат в истории сайдбара.
    const chatId = activeChat ? activeChat.id : onCreateChat(text);

    onAddMessage(chatId, { role: "user", text, time: nowTime(), attachments });
    onMessageSent?.();
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    const attachmentsToSend = attachments;
    setAttachments([]);
    setTypingChatId(chatId);

    const controller = new AbortController();
    abortControllersRef.current.set(chatId, controller);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Передаём язык, вложения и историю переписки этого чата —
        // без неё модель не помнит предыдущие сообщения (Ollama /generate
        // не хранит состояние между запросами сама по себе).
        body: JSON.stringify({
          message: text,
          lang,
          // Исходная цель чата (тема, на которую он изначально создан) —
          // бэкенд использует её, чтобы не давать чату уезжать в посторонние
          // темы (например, обсуждать похудение в чате про монтаж видео).
          // Для самого первого сообщения чата (activeChat ещё нет) не шлём —
          // тема как раз этим сообщением и задаётся.
          goalText: activeChat?.goalText || null,
          attachments: attachmentsToSend.map((a) => ({
            name: a.name,
            type: a.type,
            content: a.content,
          })),
          history: messages
            .filter((m) => m.text)
            .map((m) => ({ role: m.role, text: m.text })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        // Раньше тут терялось тело ответа (там как раз лежит настоящий текст
        // ошибки от бэкенда, например "Ошибка: <сообщение исключения>") —
        // пользователь видел только код статуса и гадал, что случилось.
        const bodyText = await response.text().catch(() => "");
        throw new Error(bodyText || `Сервер ответил статусом ${response.status}`);
      }

      const reply = await response.text();
      onAddMessage(chatId, { role: "bot", text: reply, time: nowTime() });
    } catch (err) {
      // Если запрос отменён самим пользователем — не показываем это как ошибку,
      // просто молча прекращаем (сообщение "Остановлено" уже добавлено в handleStop).
      if (err.name === "AbortError") {
        return;
      }
      onAddMessage(chatId, {
        role: "bot",
        text: "Не удалось получить ответ от сервера. Проверьте, что backend и Ollama запущены. (" + err.message + ")",
        time: nowTime(),
      });
    } finally {
      // Снимаем индикатор, только если он всё ещё принадлежит ЭТОМУ чату —
      // если пользователь тем временем отправил сообщение в другом чате,
      // не гасим чужой "Думаю".
      setTypingChatId((current) => (current === chatId ? null : current));
      abortControllersRef.current.delete(chatId);
    }
  };

  // Останавливает текущую генерацию ответа — как кнопка Stop у Claude/ChatGPT.
  // Останавливает именно активный чат (по его собственному AbortController),
  // не трогая генерацию, которая может параллельно идти в других чатах.
  const handleStop = () => {
    const chatId = activeChat?.id;
    const controller = chatId ? abortControllersRef.current.get(chatId) : null;
    if (controller) {
      controller.abort();
    }
    if (activeChat) {
      onAddMessage(activeChat.id, { role: "bot", text: "*Генерация остановлена.*", time: nowTime(), stopped: true });
    }
    setTypingChatId((current) => (current === activeChat?.id ? null : current));
  };

  // Использует уже существующий эндпоинт /api/ai/plan (возвращает JSON-массив
  // {day, action, goal}), группирует задачи по дням и записывает их в
  // календарь (day_tasks) через /api/tasks/{login}/{date} — тот же формат,
  // что использует Home.jsx при ручном добавлении задач на день.
  const handleSaveToCalendar = async () => {
    if (!activeChat || !login) return { ok: false };

    const totalDays = activeChat.plan?.totalDays || parseDurationDays(activeChat.goalText) || 30;

    try {
      const planRes = await fetch(`${API_BASE}/api/ai/plan`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ goal: activeChat.goalText, days: totalDays }),
      });

      if (!planRes.ok) return { ok: false };

      const plan = JSON.parse(await planRes.text());
      console.log('План от AI:', JSON.stringify(plan, null, 2));
      if (!Array.isArray(plan) || plan.length === 0) return { ok: false };

      const grouped = {};
      plan.forEach((item) => {
        if (!grouped[item.day]) grouped[item.day] = [];
        grouped[item.day].push(item);
      });
      console.log('Grouped:', JSON.stringify(grouped, null, 2));

      const today = new Date();
      const savedDateStrs = [];
      for (const [dayOffset, tasks] of Object.entries(grouped)) {
        const date = new Date(today);
        date.setDate(today.getDate() + parseInt(dayOffset, 10) - 1);
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

        const newTasks = tasks.map((t) => ({ text: t.action, goalCount: t.goal, progress: null, category: t.category || 'goals' }));

        // chatId в query — бэкенд заменит ТОЛЬКО задачи, ранее сохранённые
        // этим же чатом на эту дату, не трогая задачи других чатов/планов
        // и вручную добавленные. Так разные цели спокойно сосуществуют
        // на календаре, а повторное сохранение этого же плана его же
        // корректно заменяет, а не дублирует.
        const res = await fetch(`${API_BASE}/api/tasks/${login}/${dateStr}?chatId=${encodeURIComponent(activeChat.id)}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify(newTasks),
        });

        if (!res.ok) return { ok: false };
        savedDateStrs.push(dateStr);
      }

      // План привязывается к сегодняшней дате как дню 1 (бэкенд /api/ai/plan
      // не принимает дату старта) — поэтому явно проговариваем в чате,
      // на какие реальные даты легла запись, чтобы пользователь не гадал
      // и модель могла честно ответить на вопрос "на какую дату записал?".
      const label = formatSavedDatesLabel(savedDateStrs);
      onAddMessage(activeChat.id, {
        role: "bot",
        text: `✅ Записано в календарь на ${savedDateStrs.length > 1 ? "период" : "дату"}: **${label}** (день 1 плана = сегодняшняя дата).`,
        time: nowTime(),
      });

      // Раньше активация плана требовала отдельного клика "Добавить в активные
      // планы" — теперь это происходит автоматически при успешной записи в
      // календарь, точными значениями (реальная первая сохранённая дата,
      // а не "сейчас"), а не отдельным приблизительным пересчётом.
      if (!activeChat.plan && savedDateStrs.length > 0) {
        const sortedDates = [...savedDateStrs].sort();
        onAddPlan(activeChat.id, totalDays, sortedDates[0]);
      }

      return { ok: true, label };
    } catch {
      return { ok: false };
    }
  };

  return (
    <div className="chat-area">
      <div className="chat-scroll" ref={scrollRef}>
        <WelcomeMessage />
        {messages.map((m, i) => {
          if (m.role === "user") {
            return <UserMessage key={i} text={m.text} time={m.time} attachments={m.attachments} />;
          }
          const isLast = i === messages.length - 1;
          // Кнопка "Записать в календарь" появляется, если ИЗНАЧАЛЬНАЯ цель
          // чата содержит срок в днях. Отдельной кнопки "Добавить в активные
          // планы" больше нет — план активируется автоматически при успешной
          // записи в календарь (см. handleSaveToCalendar → onAddPlan).
          // Кнопка пропадает НАВСЕГДА, как только план один раз сохранён
          // (activeChat.plan становится не-null сразу при успешном сохранении —
          // см. handleSaveToCalendar). Без этой проверки кнопка появлялась бы
          // и на автосообщении-подтверждении "✅ Записано...", как только оно
          // становится последним сообщением чата, позволяя сохранять план
          // повторно до бесконечности и плодя дубликаты подтверждений.
          const showCalendarButton = isLast && !activeChat?.plan && !!parseDurationDays(activeChat?.goalText);
          return (
            <BotMessage
              key={i}
              text={m.text}
              time={m.time}
              canAcceptPlan={showCalendarButton}
              onSaveToCalendar={handleSaveToCalendar}
            />
          );
        })}
        {typing && <TypingMessage />}
      </div>

      <div className="composer">
        {attachments.length > 0 && (
          <div className="attachments-row">
            {attachments.map((a) => (
              <div key={a.id} className="attachment-chip">
                {a.type === "image" ? (
                  <img src={a.previewUrl} alt={a.name} className="attachment-thumb" />
                ) : (
                  <Paperclip size={13} />
                )}
                <span className="attachment-name">{a.name}</span>
                <button
                  type="button"
                  className="attachment-remove"
                  onClick={() => removeAttachment(a.id)}
                  aria-label="Удалить вложение"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="composer-input-row">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(e) => {
              setValue(e.target.value);
              // Авто-рост высоты по содержимому: сбрасываем в auto, чтобы
              // scrollHeight пересчитался от реального содержимого, а не от
              // предыдущей зафиксированной высоты, затем ставим её как height
              // (с потолком в 160px — дальше появляется внутренняя прокрутка,
              // см. max-height в CSS).
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${el.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
              // Shift+Enter — обычный перенос строки, браузер сам вставит \n
              // в textarea (в отличие от <input>, где перенос невозможен
              // физически — именно поэтому раньше "ничего не происходило").
            }}
            placeholder="Напишите цель или задайте вопрос..."
          />
          <button
            type="button"
            className={"send-btn" + (typing ? " send-btn-stop" : "")}
            aria-label={typing ? "Остановить генерацию" : "Отправить"}
            onClick={typing ? handleStop : handleSend}
          >
            {typing ? <Square size={13} fill="currentColor" /> : <Send size={16} />}
          </button>
        </div>
        <div className="composer-actions-row">
          <div className="composer-actions">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.md,.csv,.json,.log,image/*"
              style={{ display: "none" }}
              onChange={handleFilesSelected}
            />
            <button
              type="button"
              className="chip-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip size={14} />
              Прикрепить
            </button>
            <div className="templates-wrap" ref={templatesRef}>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setTemplatesOpen((prev) => !prev)}
              >
                <Wand2 size={14} />
                Шаблоны
              </button>
              {templatesOpen && (
                <div className="templates-menu">
                  {GOAL_TEMPLATES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        className="template-item"
                        onClick={() => applyTemplate(t.text)}
                      >
                        <Icon size={14} />
                        <span className="template-item-text">
                          <span className="template-item-label">{t.label}</span>
                          <span className="template-item-preview">{t.text}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="composer-hint">
            <span>Enter — отправить</span>
            <span>Shift+Enter — новая строка</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

// Превращает ответ сервера (ChatDto[]) в локальный формат чата, который
// использует остальной интерфейс.
function mapServerChatToLocal(serverChat) {
  return {
    id: serverChat.id,
    title: serverChat.title,
    goalText: serverChat.goalText,
    icon: serverChat.icon,
    iconTint: serverChat.iconTint,
    iconFg: serverChat.iconFg,
    favorite: serverChat.favorite,
    createdAt: serverChat.createdAt ? new Date(serverChat.createdAt) : new Date(),
    time: serverChat.createdAt
      ? new Date(serverChat.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
      : "",
    plan: serverChat.planTotalDays
      ? {
          totalDays: serverChat.planTotalDays,
          startDate: serverChat.planStartDate,
          progress: serverChat.planProgress || 0,
        }
      : null,
    messages: (serverChat.messages || []).map((m) => {
      let attachments = [];
      if (m.attachmentsJson) {
        try {
          attachments = JSON.parse(m.attachmentsJson);
        } catch {
          attachments = [];
        }
      }
      return {
        role: m.role,
        text: m.text,
        time: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
          : "",
        attachments,
      };
    }),
  };
}

export default function AIAgentDashboard() {
  const navigate = useNavigate();
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [login, setLogin] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [usageStats, setUsageStats] = useState(() => loadUsageStats(null));
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Логин получаем через httpOnly cookie (/api/me), а не из localStorage —
  // так срок жизни сессии реально зависит от "запомнить меня" на логине.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/me`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setLogin(data.login);
        setAuthChecked(true);
      })
      .catch(() => {
        if (!cancelled) navigate("/login");
      });
    return () => { cancelled = true; };
  }, [navigate]);

  // Если пользователь переключил аккаунт без полной перезагрузки страницы —
  // пересчитываем статистику под НОВЫЙ логин, а не оставляем висеть цифры
  // предыдущего аккаунта.
  useEffect(() => {
    setUsageStats(loadUsageStats(login));
  }, [login]);

  // Реестр промисов "чат создан на сервере", ключ — chatId. Нужен, чтобы
  // сообщение не улетало в /api/ai/chats/{chatId}/messages раньше, чем
  // завершится INSERT самого чата в ai_chats — иначе внешний ключ
  // ai_messages.chat_id -> ai_chats.id падает с 500 (race condition).
  const chatReadyPromises = useRef({});

  // Загружаем историю чатов пользователя с сервера при открытии страницы.
  useEffect(() => {
    if (!login) return;
    fetch(`${API_BASE}/api/ai/chats/${encodeURIComponent(login)}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setChats(data.map(mapServerChatToLocal));
      })
      .catch(() => {
        // Бэкенд недоступен — работаем с пустой историей, не блокируя UI.
      });
  }, [login]);

  const activeChat = chats.find((c) => c.id === activeChatId) || null;

  const nowTime = () =>
    new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

  // Создаёт новый чат в истории на основе первого сообщения пользователя
  // и делает его активным. Вызывается из ChatArea при первой отправке.
  // Сохраняется и локально (мгновенный отклик UI), и на сервере.
  const handleCreateChat = (firstText) => {
    const id = crypto.randomUUID();
    const category = deriveChatCategory(firstText);
    const newChat = {
      id,
      title: deriveChatTitle(firstText),
      goalText: firstText,
      icon: category.emoji,
      iconTint: category.tint,
      iconFg: category.fg,
      time: nowTime(),
      messages: [],
      createdAt: new Date(),
      favorite: false,
      plan: null,
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(id);

    // Сохраняем промис создания чата в реестре — handleAddMessage дождётся
    // его перед отправкой сообщения на сервер, чтобы не словить нарушение
    // внешнего ключа на ai_messages.chat_id.
    const creationPromise = fetch(`${API_BASE}/api/ai/chats`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        login,
        title: newChat.title,
        goalText: newChat.goalText,
        icon: newChat.icon,
        iconTint: newChat.iconTint,
        iconFg: newChat.iconFg,
      }),
    }).catch(() => {
      // Не удалось сохранить на сервере — чат остаётся в этой сессии локально.
      // Дальнейшие попытки сохранить сообщения тоже не пройдут (ожидаемо),
      // но UI при этом не блокируем.
    });

    chatReadyPromises.current[id] = creationPromise;

    return id;
  };

  // Добавляет сообщение в чат — локально сразу (для мгновенного отклика UI)
  // и параллельно сохраняет на сервере (fire-and-forget: не блокируем UI
  // ожиданием ответа записи). Сетевой запрос дожидается подтверждения того,
  // что сам чат уже создан в БД (см. chatReadyPromises), иначе вставка
  // сообщения может обогнать вставку чата и упасть по внешнему ключу.
  const handleAddMessage = (chatId, message) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, message] } : c))
    );

    // Вложения сохраняем только как метаданные (имя + тип), без содержимого —
    // чтобы не раздувать БД base64-картинками. После перезагрузки страницы
    // превью картинок не восстановится, но факт вложения останется виден.
    const attachmentsJson =
      message.attachments && message.attachments.length > 0
        ? JSON.stringify(message.attachments.map((a) => ({ name: a.name, type: a.type })))
        : null;

    const ready = chatReadyPromises.current[chatId] || Promise.resolve();

    ready
      .then(() =>
        fetch(`${API_BASE}/api/ai/chats/${chatId}/messages`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: message.role,
            text: message.text,
            attachmentsJson,
          }),
        })
      )
      .catch(() => {
        // Сообщение осталось в интерфейсе, но не сохранилось на сервере —
        // не мешаем пользователю продолжать переписку.
      });
  };

  const handleToggleFavorite = (chatId) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, favorite: !c.favorite } : c))
    );
    fetch(`${API_BASE}/api/ai/chats/${chatId}/favorite`, { method: "PATCH", credentials: "include" }).catch(() => {});
  };

  const handleRenameChat = (chatId, newTitle) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, title: newTitle } : c))
    );
    fetch(`${API_BASE}/api/ai/chats/${chatId}/title`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTitle }),
    }).catch(() => {});
  };

  const handleDeleteChat = (chatId) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
    }
    fetch(`${API_BASE}/api/ai/chats/${chatId}`, { method: "DELETE", credentials: "include" }).catch(() => {});
  };

  const handleNewChat = () => setActiveChatId(null);

  const handleSelectChat = (id) => setActiveChatId(id);

  // Активирует план как "активный" в панели слева. Раньше вызывалось только
  // по клику на отдельную кнопку в чате — теперь вызывается АВТОМАТИЧЕСКИ
  // при успешном "Записать в календарь" (см. handleSaveToCalendar), поэтому
  // принимает точные totalDays/startDate из реально сохранённого плана,
  // а не пересчитывает их заново приблизительно.
  const handleAddPlan = (chatId, totalDaysOverride, startDateOverride) => {
    const chat = chats.find((c) => c.id === chatId);
    if (!chat || chat.plan) return;

    const totalDays = totalDaysOverride || parseDurationDays(chat.goalText) || 30;
    const startDate = startDateOverride || new Date().toISOString();

    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, plan: { totalDays, startDate, progress: 0 } } : c
      )
    );

    fetch(`${API_BASE}/api/ai/chats/${chatId}/plan`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ totalDays, startDate }),
    }).catch(() => {});
  };

  // Убирает план из активных (например, если передумал/удалил по ошибке).
  const handleRemovePlan = (chatId) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, plan: null } : c))
    );
    fetch(`${API_BASE}/api/ai/chats/${chatId}/plan`, { method: "DELETE", credentials: "include" }).catch(() => {});
  };

  // Фиксирует реальное использование агента (для счётчика "сообщений
  // сегодня" и "серии дней" в сайдбаре) — вызывается при каждой отправке.
  const handleMessageSent = () => {
    setUsageStats(recordAgentUsage(login));
  };

  const goalsCount = chats.filter((c) => c.plan).length;

  if (!authChecked) return null;

  return (
    <div className="app-shell">
      <style>{CSS}</style>
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onToggleFavorite={handleToggleFavorite}
        onRenameChat={handleRenameChat}
        onDeleteChat={handleDeleteChat}
        onRemovePlan={handleRemovePlan}
        usageStats={usageStats}
        goalsCount={goalsCount}
        collapsed={!sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
      />
      {!sidebarOpen && (
        <button
          type="button"
          className="sidebar-toggle-btn sidebar-toggle-btn-floating"
          title="Открыть боковую панель"
          aria-label="Открыть боковую панель"
          onClick={() => setSidebarOpen(true)}
        >
          <PanelLeft size={16} />
        </button>
      )}
      <div className="main-panel">
        <TopBar />
        <ChatArea
          activeChat={activeChat}
          onCreateChat={handleCreateChat}
          onAddMessage={handleAddMessage}
          onAddPlan={handleAddPlan}
          onMessageSent={handleMessageSent}
          login={login}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
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

* { box-sizing: border-box; }

.app-shell {
  display: flex;
  height: 100vh;
  width: 100%;
  background: var(--bg);
  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  overflow: hidden;
}

/* ---------------- Sidebar ---------------- */

.sidebar {
  width: 300px;
  flex-shrink: 0;
  background: var(--panel);
  border-right: 1px solid var(--border);
  overflow: hidden;
  transition: width 0.18s ease, border-color 0.18s ease;
}
.sidebar-collapsed {
  width: 0;
  border-right-color: transparent;
}
.sidebar-inner {
  width: 300px;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 14px;
  gap: 12px;
}

.sidebar-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sidebar-search-row .sidebar-search { flex: 1; min-width: 0; }

.sidebar-toggle-btn {
  border: 1px solid var(--border); background: var(--panel); color: var(--text-muted);
  cursor: pointer; display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
}
.sidebar-toggle-btn:hover { background: var(--bg); color: var(--text); }
.sidebar-toggle-btn-floating {
  position: fixed; top: 16px; left: 14px; z-index: 40;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px 10px;
}
.sidebar-search-icon { color: var(--text-muted); flex-shrink: 0; }
.sidebar-search input {
  border: none; background: transparent; outline: none;
  font-size: 13px; color: var(--text); flex: 1; min-width: 0;
}
.sidebar-search kbd {
  font-size: 11px; color: var(--text-muted); background: var(--panel);
  border: 1px solid var(--border); border-radius: 5px; padding: 1px 5px;
}
.search-clear-btn {
  border: none; background: transparent; color: var(--text-muted);
  font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px; flex-shrink: 0;
}
.search-clear-btn:hover { color: var(--text); }

.new-chat-btn {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--accent); color: #fff; border: none; border-radius: 12px;
  padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.new-chat-btn:hover { background: #5b4de0; }

.sidebar-scroll {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px;
  padding-right: 2px;
}
.sidebar-scroll::-webkit-scrollbar { width: 5px; }
.sidebar-scroll::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

.sidebar-section-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 600; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: 0.03em;
  padding: 2px 6px 6px;
}
.sidebar-section-head.plain { text-transform: none; letter-spacing: 0; font-size: 13px; color: var(--text); }
.pin-dot { margin-left: auto; font-size: 11px; }

.chat-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
.chat-row {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 8px; border-radius: 9px; cursor: pointer; font-size: 13px;
}
.chat-row:hover { background: var(--bg); }
.chat-row-active { background: var(--accent-soft); }
.chat-row-active .chat-label { color: var(--accent); font-weight: 600; }
.chat-emoji {
  font-size: 12px; flex-shrink: 0;
  width: 22px; height: 22px; border-radius: 7px;
  display: flex; align-items: center; justify-content: center;
}

.chat-actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.chat-row:hover .chat-actions { display: flex; }
.chat-action-btn {
  border: none; background: transparent; color: var(--text-muted);
  border-radius: 6px; padding: 4px; display: flex; align-items: center;
  justify-content: center; cursor: pointer;
}
.chat-action-btn:hover { background: rgba(0,0,0,0.06); color: var(--text); }
.chat-action-active { color: #eab308; }
.chat-action-danger:hover { color: #ef4444; }

.chat-rename-input {
  flex: 1; min-width: 0; border: 1px solid var(--accent); border-radius: 6px;
  padding: 3px 6px; font-size: 13px; outline: none; background: var(--panel);
  color: var(--text); font-weight: 400;
}
.chat-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.chat-time { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.chat-row:hover .chat-time { display: none; }
.pin-mark { font-size: 11px; flex-shrink: 0; }

.history-group-label {
  font-size: 11px; color: var(--text-muted); font-weight: 600;
  padding: 8px 8px 2px;
}

.show-more-btn {
  display: flex; align-items: center; gap: 4px;
  background: none; border: none; color: var(--accent); font-size: 12.5px;
  font-weight: 600; cursor: pointer; padding: 8px; align-self: flex-start;
}
.chev { font-size: 13px; }

.panel-card {
  background: var(--bg); border: 1px solid var(--border); border-radius: 14px;
  padding: 12px;
}
.panel-title {
  display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700;
  color: var(--text); margin-bottom: 10px;
}

.empty-hint {
  font-size: 12.5px; color: var(--text-muted); margin: 0; padding: 4px 2px;
}

.plan-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.plan-row-top { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
.plan-emoji {
  font-size: 11px; flex-shrink: 0;
  width: 20px; height: 20px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
}
.plan-label {
  flex: 1; min-width: 0; font-size: 12.5px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.plan-value { font-size: 11.5px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; }
.plan-remove-btn {
  border: none; background: transparent; color: var(--text-muted);
  font-size: 15px; line-height: 1; cursor: pointer; padding: 0 2px; flex-shrink: 0;
  opacity: 0; transition: opacity 0.15s;
}
.plan-row:hover .plan-remove-btn { opacity: 1; }
.plan-remove-btn:hover { color: #ef4444; }
.plan-progress-slider {
  width: 100%; margin-top: 6px; accent-color: var(--accent); cursor: pointer;
  height: 4px;
}

.progress-track {
  height: 6px; background: var(--border); border-radius: 6px; overflow: hidden;
}
.progress-fill { height: 100%; border-radius: 6px; }

.stats-row { display: flex; justify-content: space-between; }
.stat-item { text-align: center; }
.stat-num { font-size: 19px; font-weight: 700; color: var(--text-muted); }
.stat-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.fire { font-size: 14px; }

/* ---------------- Main panel ---------------- */

.main-panel { flex: 1; display: flex; flex-direction: column; min-width: 0; }

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
.avatar.small { width: 30px; height: 30px; font-size: 12px; }
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

/* ---------------- Chat area ---------------- */

.chat-area { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.chat-scroll {
  flex: 1; overflow-y: auto; padding: 28px 32px; display: flex; flex-direction: column; gap: 18px;
}

.msg-row { display: flex; align-items: flex-end; gap: 10px; max-width: 640px; }
.user-row { align-self: flex-end; max-width: 640px; margin-left: auto; flex-direction: row; }

.bot-avatar {
  width: 34px; height: 34px; border-radius: 50%; background: var(--accent-soft);
  display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;
}

.bubble { border-radius: 16px; padding: 16px 18px; font-size: 14px; line-height: 1.55; }
.bot-bubble { background: var(--panel); border: 1px solid var(--border); border-bottom-left-radius: 4px; }
.user-bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 4px; }

.bubble-greeting { font-size: 15.5px; font-weight: 700; margin: 0 0 10px; }
.bubble-lead { margin: 10px 0 8px; }
.bubble-example { margin: 0 0 4px; font-style: italic; color: var(--text-muted); }

.goal-list { list-style: none; margin: 0 0 4px; padding: 0; display: flex; flex-direction: column; gap: 9px; }
.goal-list li { display: flex; align-items: center; gap: 10px; font-size: 14px; }
.goal-icon {
  width: 24px; height: 24px; border-radius: 7px; display: flex; align-items: center;
  justify-content: center; flex-shrink: 0;
}

.accept-plan-btn {
  display: flex; align-items: center; gap: 7px;
  border: 1px solid var(--accent); background: var(--accent-soft);
  color: var(--accent); border-radius: 10px; padding: 8px 14px;
  font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.accept-plan-btn:hover { background: var(--accent); color: #fff; }
.accept-plan-btn-done {
  background: #f0fdf4; border-color: #86efac; color: #16a34a; cursor: default;
}
.accept-plan-btn-done:hover { background: #f0fdf4; color: #16a34a; }

.plan-actions-row {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px;
}
.calendar-plan-btn {
  display: flex; align-items: center; gap: 7px;
  border: 1px solid #0ea5e9; background: #f0f9ff;
  color: #0284c7; border-radius: 10px; padding: 8px 14px;
  font-size: 12.5px; font-weight: 600; cursor: pointer;
}
.calendar-plan-btn:hover { background: #0ea5e9; color: #fff; }
.calendar-plan-btn:disabled { cursor: default; }
.calendar-plan-btn-done {
  background: #f0fdf4; border-color: #86efac; color: #16a34a;
}
.calendar-plan-btn-done:hover { background: #f0fdf4; color: #16a34a; }
.calendar-error-hint { font-size: 11.5px; color: #ef4444; }

.bubble-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 8px;
}
.bubble-time { font-size: 11px; color: var(--text-muted); }
.copy-btn {
  border: none; background: transparent; color: var(--text-muted); cursor: pointer;
  display: flex; align-items: center; padding: 2px;
}
.copy-btn:hover { color: var(--accent); }

.user-bubble-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px; margin-top: 6px;
  font-size: 11px; opacity: 0.85;
}

.typing-bubble { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--text-muted); }
.typing-dots { display: inline-flex; gap: 3px; }
.typing-dots span {
  width: 5px; height: 5px; border-radius: 50%; background: var(--accent);
  animation: bounce 1.2s infinite ease-in-out;
}
.typing-dots span:nth-child(2) { animation-delay: 0.15s; }
.typing-dots span:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
  40% { transform: translateY(-4px); opacity: 1; }
}

/* ---------------- Markdown content (bot messages) ---------------- */

.md-content p { margin: 0 0 8px; }
.md-content p:last-child { margin-bottom: 0; }
.md-content h2, .md-content h3, .md-content h4, .md-content h5, .md-content h6 {
  margin: 14px 0 6px;
  font-weight: 700;
}
.md-content h2:first-child, .md-content h3:first-child, .md-content h4:first-child,
.md-content h5:first-child, .md-content h6:first-child { margin-top: 0; }
.md-content h2 { font-size: 16.5px; }
.md-content h3 { font-size: 15.5px; }
.md-content h4 { font-size: 14.5px; }
.md-content h5, .md-content h6 { font-size: 14px; }
.md-content ul { margin: 6px 0 10px; padding-left: 20px; }
.md-content ul li { margin-bottom: 4px; }
.md-content code {
  background: var(--bg); padding: 1px 5px; border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, monospace; font-size: 13px;
}
.md-content strong { font-weight: 700; }
.md-content em { font-style: italic; }
.md-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 12px;
  font-size: 13px;
}
.md-content th, .md-content td {
  border: 1px solid var(--border);
  padding: 7px 10px;
  text-align: left;
}
.md-content th {
  background: var(--bg);
  font-weight: 700;
}
.md-content tr:nth-child(even) td {
  background: rgba(0,0,0,0.015);
}

/* ---------------- Composer ---------------- */

.composer {
  border-top: 1px solid var(--border); background: var(--panel);
  padding: 14px 32px 16px; flex-shrink: 0;
}
.composer-input-row {
  display: flex; align-items: flex-end; gap: 10px;
  border: 1px solid var(--border); border-radius: 14px; padding: 6px 6px 6px 16px;
  background: var(--panel);
  transition: border-color 0.15s ease;
}
.composer-input-row:focus-within {
  border-color: var(--accent);
}
.composer-input-row textarea {
  flex: 1; min-width: 0; border: none; outline: none; background: transparent;
  font-size: 13.5px; padding: 8px 0; color: var(--text);
  font-family: inherit; resize: none; overflow-y: auto;
  line-height: 1.4; max-height: 160px;
  white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;
}
.composer-input-row textarea::placeholder {
  color: var(--text-muted);
}
.send-btn {
  width: 38px; height: 38px; border-radius: 10px; border: none; background: var(--accent);
  color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
}
.send-btn:hover { background: #5b4de0; }
.send-btn-stop { background: #1e2130; }
.send-btn-stop:hover { background: #000; }

.composer-actions-row {
  display: flex; align-items: center; justify-content: space-between; margin-top: 10px;
}
.composer-actions { display: flex; gap: 8px; }
.chip-btn {
  display: flex; align-items: center; gap: 6px;
  border: 1px solid var(--border); background: var(--panel); border-radius: 9px;
  padding: 7px 12px; font-size: 12.5px; font-weight: 500; color: var(--text); cursor: pointer;
}
.chip-btn:hover { background: var(--bg); }
.composer-hint { display: flex; gap: 14px; font-size: 11px; color: var(--text-muted); }

.attachments-row {
  display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;
}
.attachment-chip {
  display: flex; align-items: center; gap: 6px;
  background: var(--bg); border: 1px solid var(--border); border-radius: 9px;
  padding: 5px 8px 5px 6px; font-size: 12px; color: var(--text); max-width: 200px;
}
.attachment-thumb {
  width: 20px; height: 20px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
}
.attachment-name {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 130px;
}
.attachment-remove {
  border: none; background: transparent; color: var(--text-muted); cursor: pointer;
  font-size: 15px; line-height: 1; padding: 0 2px; flex-shrink: 0;
}
.attachment-remove:hover { color: #ef4444; }

.msg-attachments {
  display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px;
}
.msg-attachment-img {
  width: 90px; height: 90px; border-radius: 10px; object-fit: cover;
}
.msg-attachment-file {
  display: flex; align-items: center; gap: 6px;
  background: rgba(255,255,255,0.15); border-radius: 8px;
  padding: 5px 9px; font-size: 12px;
}

.templates-wrap { position: relative; }
.templates-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  width: 300px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 20;
}
.template-item {
  display: flex; align-items: flex-start; gap: 10px;
  border: none; background: transparent; border-radius: 9px;
  padding: 9px 10px; cursor: pointer; text-align: left; color: var(--text);
}
.template-item:hover { background: var(--bg); }
.template-item svg { flex-shrink: 0; margin-top: 2px; color: var(--accent); }
.template-item-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.template-item-label { font-size: 12.5px; font-weight: 600; }
.template-item-preview {
  font-size: 11.5px; color: var(--text-muted);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

@media (max-width: 900px) {
  .sidebar { display: none; }
  .topbar-nav { display: none; }
  .chat-scroll, .composer { padding-left: 16px; padding-right: 16px; }
}
`;