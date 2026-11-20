/* ════════════════════════════════════════════════════════════════════════
   🃏 ДОЛГИНОВО · ДУРАК — js/game.js
   ЭТАП 2: полная игровая логика «подкидного дурака» (36 карт, 6…Т) против
   ИИ DOLGINOK. Визуал, разметка и таблица стилей ЭТАПА 1 не тронуты — движок
   работает ровно поверх уже готового DOM-контракта.
   ────────────────────────────────────────────────────────────────────────
   DOM-контракт, который уже готов в index.html / style.css:

   • Telegram: window.Telegram.WebApp (SDK подключён в <head> ДО этого модуля)

   • HUD:        #balance-value, #bet-selector (radio name="bet": 10/50/100/500),
                 #btn-sound (.is-off), #btn-exit
   • Статус:     #status (.status--you | .status--ai | .status--defend | .status--done),
                 #status-text, #seat-ai (.is-thinking), #seat-you (.is-active)
   • Счётчики:   #opponent-count, #player-count, #deck-count, #deck-count-label, #bito-count
   • Веера:      #opponent-fan / #player-fan  (на контейнере --n, на карте --i)
                 карта: .card.card--spade|heart|diamond|club [.card--trump|.card--back]
                        [.is-playable] [.is-selected] [.is-dead] [.is-taking] [.is-bit]
   • Колода:     #deck (.is-dealing | .is-empty), #trump-card, #deck-count
   • Слоты:      #table-slots > .slot[data-slot="0..5"]
                 (.is-filled | .is-beaten | .is-taken | .is-hit)
                 > .card.slot__attack + .card.slot__defend
   • Отбой:      #bito-pile (.is-empty | .is-full | .is-clearing)
   • Кнопки:     #btn-bito, #btn-take, #btn-new  (.is-disabled / [disabled])
   • Стол:       #table (.is-droppable — подсвечивает пустые слоты под ход)
   • Отдельно:   #bet-ai (ставка соперника), #btn-bito / #btn-take / #btn-new
   ────────────────────────────────────────────────────────────────────────
   ЭТАП 2 · ПОЛНАЯ ИГРОВАЯ ЛОГИКА «Подкидного дурака» (36 карт, 6…Т)

   1) БАЛАНС И СТАВКИ
      balance и session_id читаются из query-строки: ?balance=1000&session_id=
      demo_local (дефолты ровно такие же), дополнительно поддерживается формат
      Telegram startapp «b1000.my_session». initialBalance запоминается.
      Ставка 10/50/100/500 списывается в момент раздачи; победа → начисляется
      ставка × 2 (чистыми +ставка), ничья → ставка возвращается, поражение →
      ставка уже сгорела. Копия баланса живёт в localStorage (+ Telegram
      CloudStorage, если доступен) под ключом сессии.

   2) ЧЕСТНЫЕ ПРАВИЛА ПОДКИДНОГО
      Козырь — нижняя карта колоды: она лежит под стопкой и видна всем
      (#trump-card). После каждого отбоя/взятия карты добираются до 6, причём
      первым добирает тот, кто ходил. Первый ход отдаётся владельцу младшего
      козыря; если козырей на руках нет ни у кого — первым ходит игрок.
      Атака: любая карта при пустом столе, дальше только то достоинство,
      которое уже лежит на столе (и атака, и отбой). Ограничения: не более
      6 карт за раунд и не больше, чем карт в руке отбивающегося (с учётом
      уже отбитых). Переводной дурак не играется — только подкидной.

   3) ИИ · DOLGINOK
      Атакует с младших некозырных карт (приоритет парным, чтобы было что
      подкинуть), подкидывает по функции ценности карты и не выбрасывает
      старшие козыри впустую. При защите бьёт минимально возможной картой
      той же масти либо младшим козырём, а если на столе слишком много
      дорогих карт или козырей — разумно жмёт «Беру». Ходит с естественной
      задержкой 600…900 мс (.is-thinking + ⏳ в статусе).

   4) ФИНАЛ ПАРТИИ
      Оверлей победы / поражения / ничьей со всей бухгалтерией ставки и
      кнопкой «НОВАЯ ИГРА» строится из JS (классы .dv-ovl*), поэтому
      index.html и style.css остаются нетронутыми.

   5) ВЫХОД · СИНХРОНИЗАЦИЯ БАЛАНСА С БОТОМ (ЭТАП 3)
      Кнопка «ВЫХОД» не показывает блокирующих popup-окон (showPopup мог
      перехватить тап и сорвать отправку): она сразу считает чистый профит за
      сессию (state.balance − state.initialBalance, округление до копеек),
      упакует его в JSON { session_id, session_profit, profit, final_balance }
      и отдаёт боту через WebApp.sendData, а через 250 мс закрывает мини-апп
      (WebApp.close). Если пользователь ушёл свайпом или «×» мимо кнопки, тот
      же расчёт срабатывает на pagehide/beforeunload. После успешной отправки
      отсчёт перебазивируется на текущий баланс, поэтому одна и та же сумма
      боту не приходит дважды.

   УПРАВЛЕНИЕ: клик по карте = выбор (.is-selected), повторный клик по карте
   или клик по слоту/столу = ход либо отбой; Space/Enter = главное действие,
   T или B = «Беру», Esc = снять выбор, 1…9 = выбрать карту по счёту.
   ════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════ 0 · TELEGRAM WEBAPP SDK ═══════════════════════ */

const TG = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
const TG_HAPTIC = (TG && TG.HapticFeedback) ? TG.HapticFeedback : null;

function tgInit() {
  if (!TG) return;
  try {
    TG.ready();
    TG.expand();
    if (TG.setHeaderColor) TG.setHeaderColor('#04241b');
    if (TG.setBackgroundColor) TG.setBackgroundColor('#02120d');
    if (TG.setBottomThemeColor) TG.setBottomThemeColor('#02120d');
    if (TG.setHeaderLinksVisible) TG.setHeaderLinksVisible(false);
    if (TG.disableVerticalSwipes) TG.disableVerticalSwipes();
    if (TG.enableClosingConfirmation) TG.enableClosingConfirmation();
  } catch (err) { console.warn('[durak] Telegram init:', err); }
}

const HAPTIC_STYLES = ['light', 'medium', 'heavy', 'rigid', 'soft'];

function haptic(style) {
  if (!TG_HAPTIC) return;
  try {
    if (HAPTIC_STYLES.indexOf(style) >= 0) TG_HAPTIC.impactOccurred(style);
    else TG_HAPTIC.notificationOccurred(style === 'error' ? 'error' : (style === 'win' ? 'success' : 'warning'));
  } catch (err) { /* в обычном браузере хуков Telegram нет */ }
}

function tgClose() {
  try { if (TG && TG.close) TG.close(); } catch (err) { /* noop */ }
}

/* ═══════════════ 1 · КОНФИГ, URL-ПАРАМЕТРЫ, БАЛАНС, ХРАНИЛИЩЕ ═════════ */

const RANKS = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = [
  { key: 'spade',   ch: '♠', cls: 'card--spade'   },
  { key: 'heart',   ch: '♥', cls: 'card--heart'   },
  { key: 'diamond', ch: '♦', cls: 'card--diamond' },
  { key: 'club',    ch: '♣', cls: 'card--club'    }
];

const BETS = [10, 50, 100, 500];
const MIN_BET = BETS[0];
const DEFAULT_BALANCE = 1000;
const MAX_BALANCE = 999999999;

const HAND_SIZE = 6;      /* карт на руках и максимум атак за раунд */
const TABLE_SLOTS = 6;

const AI_MIN_DELAY = 600; /* естественная задержка ИИ, мс */
const AI_MAX_DELAY = 900;
const T_DEAL = 72;        /* пауза между картами при раздаче */
const T_BITO = 470;       /* длительность анимации .is-bit    */
const T_TAKE = 580;       /* длительность анимации .is-taking */
const T_AUTO_BITO = 850;  /* авто-«БИТО», когда подкидывать нечего */

const LS_BALANCE_PREFIX = 'dolginovo.durak.balance.';
const LS_SOUND_KEY = 'dolginovo.durak.sound';
const TG_CLOUD_BALANCE = 'durak_balance';

const params = new URLSearchParams(window.location ? window.location.search : '');

/* Telegram может принести баланс и сессию одним start-параметром: b1000.demo_local */
function parseStartPayload(raw) {
  const m = /^b(\d{1,9})[._:-]{1,2}([\w.-]{1,64})$/.exec(String(raw || ''));
  if (!m) return { balance: null, session: null };
  return { balance: toMoney(m[1]), session: m[2] };
}

function toMoney(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = Math.floor(Number(String(raw).replace(/[\s ]/g, '')));
  if (!isFinite(n) || n < 0) return null;
  return Math.min(n, MAX_BALANCE);
}

const START_PARAM = decodeURIComponent(
  params.get('startapp') || params.get('start_param') ||
  (TG && TG.initDataUnsafe ? TG.initDataUnsafe.start_param : '') || ''
);
const FROM_PAYLOAD = parseStartPayload(START_PARAM);

const SESSION_ID = String(params.get('session_id') || FROM_PAYLOAD.session || 'demo_local').trim() || 'demo_local';
const LS_BALANCE_KEY = LS_BALANCE_PREFIX + SESSION_ID;

/* ── хранилище: localStorage основной, Telegram CloudStorage — зеркало ── */
function readStoredBalance() {
  try {
    const raw = localStorage.getItem(LS_BALANCE_KEY);
    /* URL-параметр важнее сохранённого: сервер всегда старается первым */
    if (params.has('balance') || FROM_PAYLOAD.balance !== null) return null;
    return toMoney(raw);
  } catch (err) { return null; }
}

function storeBalance(value) {
  const v = Math.max(0, Math.floor(value));
  try { localStorage.setItem(LS_BALANCE_KEY, String(v)); } catch (err) { /* private mode */ }
  try {
    if (TG && TG.CloudStorage && TG.CloudStorageAvailable) TG.CloudStorage.setItem(TG_CLOUD_BALANCE, String(v), function () {});
  } catch (err) { /* облака нет */ }
}

const urlBalance = params.has('balance') ? toMoney(params.get('balance')) : FROM_PAYLOAD.balance;
const storedBalance = readStoredBalance();
const initialBalance = urlBalance !== null ? urlBalance : (storedBalance !== null ? storedBalance : DEFAULT_BALANCE);

/* ═══════════════════════════ 2 · ЗВУК (WebAudio) ══════════════════════
   Аудиофайлов в проекте нет — все эффекты синтезируются на лету, чтобы
   мини-апп не тянул лишний вес. Контекст поднимается по первому тапу
   (политика автоплея Telegram/мобильных браузеров).                    */

const Sound = {
  on: true,
  ctx: null,
  bus: null,

  startup() {
    let saved = null;
    try { saved = localStorage.getItem(LS_SOUND_KEY); } catch (err) { saved = null; }
    this.on = saved === null ? true : saved === '1';
    return this.on;
  },

  toggle() {
    this.on = !this.on;
    try { localStorage.setItem(LS_SOUND_KEY, this.on ? '1' : '0'); } catch (err) { /* noop */ }
    if (this.on) this.play('tap');
    return this.on;
  },

  ensure() {
    if (!this.on) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.bus = this.ctx.createGain();
        this.bus.gain.value = 0.45;
        this.bus.connect(this.ctx.destination);
      } catch (err) {
        this.ctx = null; this.bus = null;
        return null;
      }
    }
    if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (err) { /* noop */ } }
    return this.ctx;
  },

  tone(freq, opts) {
    const o = opts || {};
    const ctx = this.ensure();
    if (!ctx) return;
    const dur = o.dur || 0.12;
    const t0 = ctx.currentTime + (o.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.to), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(o.gain || 0.12, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain); gain.connect(this.bus);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  },

  noise(opts) {
    const o = opts || {};
    const ctx = this.ensure();
    if (!ctx) return;
    const dur = o.dur || 0.08;
    const t0 = ctx.currentTime + (o.delay || 0);
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'highpass'; filt.frequency.value = o.hp || 900;
    const gain = ctx.createGain(); gain.gain.value = o.gain || 0.1;
    src.connect(filt); filt.connect(gain); gain.connect(this.bus);
    src.start(t0);
  },

  play(name) {
    if (!this.on) return;
    const self = this;
    switch (name) {
      case 'tap':
        self.tone(640, { type: 'square', dur: 0.05, gain: 0.05 }); break;
      case 'select':
        self.tone(1180, { type: 'triangle', dur: 0.06, gain: 0.06 }); break;
      case 'deal':
        self.noise({ dur: 0.07, gain: 0.09, hp: 1500 }); break;
      case 'attack':
        self.noise({ dur: 0.09, gain: 0.11, hp: 900 });
        self.tone(300, { type: 'sine', dur: 0.1, gain: 0.09, to: 190 }); break;
      case 'beat':
        self.tone(520, { type: 'triangle', dur: 0.09, gain: 0.09, to: 880 });
        self.noise({ dur: 0.06, gain: 0.07, delay: 0.04 }); break;
      case 'bito':
        [660, 880, 1180].forEach(function (f, i) { self.tone(f, { type: 'triangle', dur: 0.1, gain: 0.08, delay: i * 0.07 }); });
        break;
      case 'take':
        self.tone(430, { type: 'sawtooth', dur: 0.42, gain: 0.09, to: 120 });
        self.noise({ dur: 0.3, gain: 0.06, hp: 500 }); break;
      case 'error':
        self.tone(190, { type: 'sawtooth', dur: 0.16, gain: 0.08, to: 120 }); break;
      case 'win':
        [523, 659, 784, 1047].forEach(function (f, i) { self.tone(f, { type: 'triangle', dur: 0.26, gain: 0.11, delay: i * 0.12 }); });
        break;
      case 'lose':
        [392, 330, 262].forEach(function (f, i) { self.tone(f, { type: 'sine', dur: 0.34, gain: 0.11, delay: i * 0.16 }); });
        break;
      case 'draw':
        [440, 587].forEach(function (f, i) { self.tone(f, { type: 'triangle', dur: 0.22, gain: 0.09, delay: i * 0.14 }); });
        break;
      default: break;
    }
  }
};

/* ════════════════════ 3 · КАРТОЧНАЯ МОДЕЛЬ И КОЛОДА 36 ════════════════ */

function randomFloat() {
  if (window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

function shuffle(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(randomFloat() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

/* Колода: index 0 — НИЖНЯЯ карта (она же козырь, видна под стопкой),
   index length-1 — верхняя, с неё добирают. 36 карт: 6,7,8,9,10,J,Q,K,A × 4 масти. */
function buildDeck() {
  const deck = [];
  for (let s = 0; s < SUITS.length; s++) {
    for (let r = 0; r < RANKS.length; r++) {
      deck.push({ r: r, s: s, id: RANKS[r] + SUITS[s].ch });
    }
  }
  return shuffle(deck);
}

function cardName(card) { return card ? card.id : '—'; }
function isTrumpCard(card) { return card.s === state.trumpSuit; }

/* Ценность карты для «головы» ИИ: козырь всегда дороже некозырной карты. */
function cardCost(card) { return (card.s === state.trumpSuit ? 100 : 0) + card.r; }

/* Бьёт ли карта def карту atk: старше по той же масти либо любой козырь по не-козырю. */
function canBeat(def, atk) {
  if (def.s === atk.s) return def.r > atk.r;
  return def.s === state.trumpSuit && atk.s !== state.trumpSuit;
}

function beatsList(hand, atk) {
  return hand.filter(function (c) { return canBeat(c, atk); })
    .sort(function (a, b) { return cardCost(a) - cardCost(b) || a.r - b.r; });
}

function lowestOf(list) {
  let best = null;
  for (let i = 0; i < list.length; i++) {
    if (!best || cardCost(list[i]) < cardCost(best)) best = list[i];
  }
  return best;
}

/* ═══════════════════════════ 4 · СОСТОЯНИЕ ИГРЫ ═══════════════════════ */

const state = {
  epoch: 0,                          /* растёт при новой партии — гасит старые таймеры */
  started: false,
  over: false,
  busy: false,                       /* идёт анимация или думает ИИ */
  phase: 'idle',                     /* idle | deal | attack | defend | toss | clearing | done */
  balance: initialBalance,
  initialBalance: initialBalance,   /* старт сессии → отсчёт чистого профита  */
  sessionId: SESSION_ID,            /* id сессии, уходит боту в sendData      */
  sessionSettled: false,            /* sendData за эту сессию уже выполнен    */
  sessionProfit: 0,                 /* суммарный профит, отправленный боту    */
  bet: MIN_BET,
  round: 0,
  deck: [],
  trumpSuit: -1,
  trump: null,
  you: [],
  ai: [],
  table: [],                         /* [{attack, defend}] — порядок = порядок атак */
  bito: 0,
  attacker: 'you',
  defender: 'ai',
  selected: null,                    /* data-card выбранной карты игрока */
  clearAnim: null,                   /* 'bito' | 'take' на время анимации */
  lastTaker: null,                   /* кто забирал в прошлой партии/раунде */
  aiTookLast: false,
  youTookLast: false,
  score: { wins: 0, losses: 0, draws: 0, played: 0 }
};

let aiTimer = null;
let autoTimer = null;
let hintTimer = null;

const sleep = function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
const sameEpoch = function (id) { return id === state.epoch; };

/* ═════════════════════════ 5 · ССЫЛКИ НА DOM-КОНТРАКТ ═════════════════ */

function q(sel, root) { return (root || document).querySelector(sel); }
function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

const el = {
  app: q('#app'),
  balance: q('#balance'), balanceValue: q('#balance-value'),
  betSelector: q('#bet-selector'), betInputs: qa('#bet-selector input[name="bet"]'),
  btnSound: q('#btn-sound'), btnExit: q('#btn-exit'),
  status: q('#status'), statusText: q('#status-text'), statusIcon: q('#status .status__icon'),
  seatAi: q('#seat-ai'), seatYou: q('#seat-you'), betAi: q('#bet-ai'),
  opponentFan: q('#opponent-fan'), playerFan: q('#player-fan'),
  opponentCount: q('#opponent-count'), playerCount: q('#player-count'),
  deck: q('#deck'), trumpCard: q('#trump-card'),
  deckCount: q('#deck-count'), deckCountLabel: q('#deck-count-label'),
  slotsWrap: q('#table-slots'), slotEls: qa('#table-slots .slot'),
  bitoPile: q('#bito-pile'), bitoCount: q('#bito-count'),
  btnBito: q('#btn-bito'), btnTake: q('#btn-take'), btnNew: q('#btn-new'),
  table: q('#table')
};

const DOM_OK = !!(el.playerFan && el.opponentFan && el.slotEls.length >= TABLE_SLOTS && el.balanceValue && el.btnNew);

/* ═════════════════════════ 6 · ПОСТРОЕНИЕ КАРТОЧНЫХ УЗЛОВ ════════════ */

function faceMarkup(card) {
  const suit = SUITS[card.s];
  const rank = RANKS[card.r];
  return '<span class="c c-tl"><span class="r">' + rank + '</span><span class="s">' + suit.ch + '</span></span>' +
         '<span class="pip">' + suit.ch + '</span>' +
         '<span class="c c-br"><span class="r">' + rank + '</span><span class="s">' + suit.ch + '</span></span>';
}

function createCard(card, extraClass) {
  const suit = SUITS[card.s];
  const node = document.createElement('span');
  node.className = 'card ' + suit.cls + (card.s === state.trumpSuit ? ' card--trump' : '') + (extraClass ? ' ' + extraClass : '');
  node.dataset.card = card.id;
  node.innerHTML = faceMarkup(card);
  return node;
}

/* ════════════════════════════ 7 · РЕНДЕР DOM ═════════════════════════ */

const numberFmt = (window.Intl && Intl.NumberFormat) ? new Intl.NumberFormat('ru-RU') : null;
function fmtMoney(value) {
  const v = Math.max(0, Math.round(value));
  return numberFmt ? numberFmt.format(v) : String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function renderBalance() {
  el.balanceValue.textContent = fmtMoney(state.balance);
}

function flashBalance(kind) {
  if (!el.balance) return;
  const cls = kind === 'win' ? 'is-win' : 'is-lose';
  el.balance.classList.remove('is-win', 'is-lose');
  void el.balance.offsetWidth;
  el.balance.classList.add(cls);
  setTimeout(function () { el.balance.classList.remove(cls); }, 640);
}

/* Сортировка руки: сначала некозырные по возрастанию, козыри — в конце (как в жизни). */
function sortHand(hand) {
  return hand.slice().sort(function (a, b) {
    const at = a.s === state.trumpSuit ? 1 : 0;
    const bt = b.s === state.trumpSuit ? 1 : 0;
    if (at !== bt) return at - bt;
    if (a.r !== b.r) return a.r - b.r;
    return a.s - b.s;
  });
}

/* Точечная синхронизация DOM по data-card: новые карты вставляются и играют
   deal-in, а уже лежащие узлы не пересоздаются — иначе CSS-анимации
   перезапускались бы на каждом рендере. */
function syncFan(fan, cards, opts) {
  const options = opts || {};
  const live = Object.create(null);
  const children = Array.prototype.slice.call(fan.children);
  children.forEach(function (node) {
    const id = node.dataset ? node.dataset.card : undefined;
    if (id && cards.some(function (c) { return c.id === id; })) live[id] = node;
    else node.remove();
  });

  cards.forEach(function (card, i) {
    let node = live[card.id];
    const fresh = !node;
    if (fresh) node = createCard(card, options.extraClass);
    if (fan.children[i] !== node) fan.insertBefore(node, fan.children[i] || null);
    node.style.setProperty('--i', String(i));
    if (options.decorate) options.decorate(node, card, fresh);
    if (!fresh) delete live[card.id];
  });
  Object.keys(live).forEach(function (id) { if (live[id]) live[id].remove(); });
  fan.style.setProperty('--n', String(Math.max(cards.length, 1)));
}

function renderYou() {
  const hand = sortHand(state.you);
  const playableIds = legalMoveIds();
  syncFan(el.playerFan, hand, {
    decorate: function (node, card) {
      const playable = playableIds.indexOf(card.id) >= 0;
      node.classList.toggle('is-playable', playable);
      node.classList.toggle('is-selected', state.selected === card.id);
      node.classList.toggle('is-dead', state.started && !state.over && !playable);
    }
  });
  el.playerCount.textContent = String(state.you.length);
}

function renderAi() {
  const n = state.ai.length;
  while (el.opponentFan.children.length > n) el.opponentFan.lastElementChild.remove();
  while (el.opponentFan.children.length < n) {
    const back = document.createElement('span');
    back.className = 'card card--back';
    el.opponentFan.appendChild(back);
  }
  Array.prototype.slice.call(el.opponentFan.children).forEach(function (node, i) {
    node.style.setProperty('--i', String(i));
  });
  el.opponentFan.style.setProperty('--n', String(Math.max(n, 1)));
  el.opponentCount.textContent = String(n);
}

function syncSlotCard(slotNode, kind, card) {
  const sel = '.slot__' + kind;
  let node = slotNode.querySelector(sel);
  if (node && node.dataset.card === card.id) return;
  if (node) node.remove();
  node = createCard(card, 'slot__' + kind);
  slotNode.appendChild(node);
}

function renderTable() {
  el.slotEls.forEach(function (slotNode, i) {
    const data = state.table[i];
    const filled = !!data;
    slotNode.classList.toggle('is-filled', filled);
    slotNode.classList.toggle('is-beaten', !!(data && data.defend));
    slotNode.classList.toggle('is-taken', filled && state.clearAnim === 'take');
    if (!filled) {
      slotNode.classList.remove('is-taken');
      if (slotNode.firstChild) slotNode.innerHTML = '';
      return;
    }
    syncSlotCard(slotNode, 'attack', data.attack);
    if (data.defend) syncSlotCard(slotNode, 'defend', data.defend);
    else {
      const def = slotNode.querySelector('.slot__defend');
      if (def) def.remove();
    }
    qa('.card', slotNode).forEach(function (node) {
      node.classList.toggle('is-bit', state.clearAnim === 'bito');
      node.classList.toggle('is-taking', state.clearAnim === 'take');
    });
  });
}

function renderDeck() {
  const left = state.deck.length;
  el.deckCount.textContent = String(left);
  el.deckCountLabel.textContent = String(left);
  el.deck.classList.toggle('is-empty', left === 0);

  const trump = el.trumpCard;
  if (!trump) return;
  if (!state.trump) {
    trump.className = 'card card--back trump';
    trump.removeAttribute('data-card');
    trump.innerHTML = '';
    return;
  }
  const suit = SUITS[state.trump.s];
  trump.className = 'card ' + suit.cls + ' card--trump trump';
  trump.dataset.card = state.trump.id;
  trump.innerHTML = faceMarkup(state.trump);
}

/* козырь переворачиваем заново: без сброса animation он бы не «щёлкнул» */
function replayTrumpFlip() {
  if (!el.trumpCard) return;
  el.trumpCard.style.animation = 'none';
  void el.trumpCard.offsetWidth;
  el.trumpCard.style.animation = '';
}

function renderCounters() {
  el.playerCount.textContent = String(state.you.length);
  el.opponentCount.textContent = String(state.ai.length);
  el.bitoCount.textContent = String(state.bito);
  el.bitoPile.classList.toggle('is-empty', state.bito === 0);
  el.bitoPile.classList.toggle('is-full', state.bito > 0);
}

function sweepBitoPile() {
  el.bitoPile.classList.remove('is-clearing');
  void el.bitoPile.offsetWidth;
  el.bitoPile.classList.add('is-clearing');
  setTimeout(function () { el.bitoPile.classList.remove('is-clearing'); }, 620);
}

function setBtn(btn, enabled, label) {
  if (!btn) return;
  btn.disabled = !enabled;
  btn.classList.toggle('is-disabled', !enabled);
  if (label !== undefined && btn.textContent !== label) btn.textContent = label;
}

function renderControls() {
  const live = state.started && !state.over;
  const yourTurn = live && !state.busy && actorNow() === 'you';

  const canBito = live && !state.busy && state.phase === 'toss' && state.attacker === 'you';
  const canTake = live && !state.busy && state.phase === 'defend' && state.defender === 'you' && openAttackIndex() >= 0;

  let bitoLabel = 'БИТО / ПАС';
  if (canBito) bitoLabel = 'БИТО';
  else if (live && (state.phase === 'toss' || state.phase === 'clearing')) bitoLabel = 'ПАС';
  setBtn(el.btnBito, canBito, bitoLabel);
  setBtn(el.btnTake, canTake, 'БЕРУ');
  setBtn(el.btnNew, !state.busy, 'НОВАЯ ИГРА');

  el.seatAi.classList.toggle('is-thinking', live && state.busy && actorNow() === 'ai');
  el.seatYou.classList.toggle('is-active', yourTurn);

  const showBet = state.started && !state.over ? state.bet : currentBetChoice();
  el.betAi.textContent = String(showBet);

  el.table.classList.toggle('is-droppable',
    yourTurn && !!state.selected && legalMoveIds().indexOf(state.selected) >= 0);
}

function renderAll() {
  renderBalance();
  renderYou();
  renderAi();
  renderTable();
  renderDeck();
  renderCounters();
  renderControls();
}

/* ═══════════════════════════ 8 · СТАТУС И ПОДСКАЗКИ ══════════════════ */

const STATUS_MODIFIERS = ['status--you', 'status--ai', 'status--defend', 'status--done'];
let baseStatus = { kind: 'done', icon: '🎴', text: 'Выберите ставку и жмите «НОВАЯ ИГРА»' };

function applyStatus(snapshot) {
  el.status.classList.remove.apply(el.status.classList, STATUS_MODIFIERS);
  el.status.classList.add('status--' + snapshot.kind);
  el.statusIcon.textContent = snapshot.icon;
  el.statusText.textContent = snapshot.text;
}

function setStatus(kind, icon, text) {
  baseStatus = { kind: kind, icon: icon, text: text };
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  applyStatus(baseStatus);
}

/* Короткая подсказка-предупреждение: вспыхивает и возвращается к базовому статусу. */
function hint(text, icon) {
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  applyStatus({ kind: 'defend', icon: icon || '⚠️', text: text });
  hintTimer = setTimeout(function () { hintTimer = null; applyStatus(baseStatus); }, 2400);
}

/* Текстовая путеводная нить по текущей фазе — что от игрока хотят прямо сейчас. */
function describePhase() {
  if (state.over) return { kind: 'done', icon: '🏁', text: 'Партия окончена · жмите «НОВАЯ ИГРА»' };
  if (!state.started) return { kind: 'done', icon: '🎴', text: 'Выберите ставку и жмите «НОВАЯ ИГРА»' };
  if (state.phase === 'deal') return { kind: 'ai', icon: '🂠', text: 'Раздача ' + HAND_SIZE + ' карт…' };
  if (state.phase === 'clearing') return { kind: 'done', icon: '✨', text: 'Уборка стола' };

  const actor = actorNow();
  if (actor === 'ai') {
    if (state.phase === 'defend') return { kind: 'ai', icon: '🤖', text: 'Соперник отбивается…' };
    if (state.phase === 'toss') return { kind: 'ai', icon: '🤖', text: 'Соперник решает: подкинуть или «БИТО»…' };
    return { kind: 'ai', icon: '🤖', text: 'Соперник атакует…' };
  }
  if (state.phase === 'attack') {
    return { kind: 'you', icon: '🎯', text: 'Ваш ход · начните атаку любой картой' };
  }
  if (state.phase === 'toss') {
    const ranks = tableRanks();
    const names = [];
    ranks.forEach(function (r) { names.push(RANKS[r]); });
    if (!names.length) return { kind: 'you', icon: '🧹', text: 'Подкидывать нечего · жмите «БИТО»' };
    return { kind: 'you', icon: '🃏', text: 'Подкиньте ' + names.join(' / ') + ' или жмите «БИТО»' };
  }
  const open = openAttackCard();
  const canCover = legalMoveIds().length > 0;
  if (!open) return { kind: 'you', icon: '🎯', text: 'Ваш ход' };
  if (!canCover) return { kind: 'defend', icon: '🛡️', text: 'Отбиться нечем · жмите «БЕРУ»' };
  return { kind: 'defend', icon: '🛡️', text: 'Кройте «' + cardName(open) + '» · карта старше той же масти или козырь' };
}

function refreshStatus() {
  const snapshot = describePhase();
  setStatus(snapshot.kind, snapshot.icon, snapshot.text);
}

/* ═══════════════ 9 · ПРАВИЛА: ЛЕГАЛЬНОСТЬ ХОДОВ И ЛИМИТЫ ═════════════ */

function handOf(who) { return who === 'you' ? state.you : state.ai; }
function rival(who) { return who === 'you' ? 'ai' : 'you'; }

/* Кто сейчас ходит: при незакрытой атаке — отбивающийся, иначе атакующий. */
function actorNow() { return state.phase === 'defend' ? state.defender : state.attacker; }

function openAttackIndex() {
  for (let i = 0; i < state.table.length; i++) if (!state.table[i].defend) return i;
  return -1;
}
function openAttackCard() {
  const i = openAttackIndex();
  return i >= 0 ? state.table[i].attack : null;
}
function beatenCount() {
  return state.table.filter(function (s) { return !!s.defend; }).length;
}

/* Достоинства, которые уже лежат на столе (и атаки, и отбои) — только их и подкидывают. */
function tableRanks() {
  const set = [];
  state.table.forEach(function (slot) {
    if (set.indexOf(slot.attack.r) < 0) set.push(slot.attack.r);
    if (slot.defend && set.indexOf(slot.defend.r) < 0) set.push(slot.defend.r);
  });
  return set;
}

/* Лимит атаки за раунд: не больше 6 и не больше карт в руке отбивающегося
   (уже отбитые карты он «потратил», поэтому они считаются). */
function attackLimit() {
  const defHand = handOf(state.defender).length;
  return Math.min(TABLE_SLOTS, defHand + beatenCount());
}
function canAttackMore() {
  return state.table.length < TABLE_SLOTS && state.table.length < attackLimit();
}

function canTossCard(card) {
  if (state.table.length === 0) return false;
  if (!canAttackMore()) return false;
  return tableRanks().indexOf(card.r) >= 0;
}

/* Список карт, которыми игрок имеет право действовать в текущей фазе. */
function legalMoveIds() {
  if (!state.started || state.over || state.busy) return [];
  if (state.phase === 'attack' && state.attacker === 'you') {
    return state.you.map(function (c) { return c.id; });
  }
  if (state.phase === 'toss' && state.attacker === 'you') {
    return state.you.filter(canTossCard).map(function (c) { return c.id; });
  }
  if (state.phase === 'defend' && state.defender === 'you') {
    const open = openAttackCard();
    if (!open) return [];
    return beatsList(state.you, open).map(function (c) { return c.id; });
  }
  return [];
}

/* Человеческое объяснение, почему карта не идёт в дело. */
function explainBlock(card) {
  if (state.over) return 'Партия окончена — начните новую кнопкой «НОВАЯ ИГРА»';
  if (!state.started) return 'Сначала нажмите «НОВАЯ ИГРА»: ставка уйдёт в банк';
  if (state.busy) return 'Сейчас ход соперника · подождите';
  if (state.phase === 'deal') return 'Идёт раздача…';
  if (state.phase === 'clearing') return 'Стол убирается…';

  if (state.phase === 'defend' && state.defender === 'you') {
    const open = openAttackCard();
    if (!open) return 'Отбивать нечего';
    if (!canBeat(card, open)) {
      if (card.s === open.s) return 'Нужна карта старше «' + cardName(open) + '» этой же масти';
      if (card.s === state.trumpSuit && open.s === state.trumpSuit) return 'Козырь «' + card.id + '» не бьёт козырь «' + cardName(open) + '»';
      return 'Крыть можно только мастью «' + SUITS[open.s].ch + '» или козырем «' + SUITS[state.trumpSuit].ch + '»';
    }
    return 'Сейчас не ваша очередь крыть';
  }
  if (state.phase === 'defend' && state.defender === 'ai') return 'Вы атакуете · ждите, пока соперник отобьётся';
  if (state.phase === 'toss' && state.attacker === 'you') {
    if (!canAttackMore()) {
      return 'Больше нельзя: атак «' + state.table.length + '», у отбивающегося «' + handOf(state.defender).length + '» карт';
    }
    const names = tableRanks().map(function (r) { return RANKS[r]; });
    return 'Подкинуть можно только ' + names.join(' / ') + ' — те же достоинства, что на столе';
  }
  if (state.phase === 'toss' && state.attacker === 'ai') return 'Соперник подкидывает · вы отбиваетесь';
  if (state.phase === 'attack' && state.attacker === 'ai') return 'Ход соперника';
  return 'Эта карта сейчас не ходит';
}

/* ═══════════════════ 10 · ХОДЫ: АТАКА / ОТБОЙ / ПОДКИД / БИТО ════════ */

function takeFromHand(who, card) {
  const hand = handOf(who);
  const idx = hand.findIndex(function (c) { return c.id === card.id; });
  if (idx >= 0) hand.splice(idx, 1);
  return idx >= 0;
}

function flashSlot(index, cls, ms) {
  const node = el.slotEls[index];
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
  setTimeout(function () { node.classList.remove(cls); }, ms || 420);
}

/* Атака при пустом столе и подкидывание при полном — механика одна:
   добавляем карту атаки в следующий свободный слот. */
function playAttackCard(who, card) {
  if (!takeFromHand(who, card)) return;
  const index = state.table.length;
  state.table.push({ attack: card, defend: null });
  if (who === 'you') state.selected = null;
  Sound.play('attack');
  haptic('light');
  renderAll();
  flashSlot(index, 'is-hit', 420);
  state.phase = 'defend';
  advance();
}

function playDefendCard(who, card) {
  const index = openAttackIndex();
  if (index < 0) return;
  if (!takeFromHand(who, card)) return;
  state.table[index].defend = card;
  if (who === 'you') state.selected = null;
  Sound.play('beat');
  haptic('light');
  renderAll();
  flashSlot(index, 'is-hit', 380);
  state.phase = 'toss';
  advance();
}

function playTake(who) {
  state.selected = null;
  state.lastTaker = who;
  state.aiTookLast = false;
  state.youTookLast = false;
  if (who === 'ai') state.aiTookLast = true;
  else state.youTookLast = true;
  resolveTable('take', who);
}

function playBito(who) {
  state.selected = null;
  state.aiTookLast = false;
  state.youTookLast = false;
  resolveTable('bito', who);
}

/* ═══════════ 11 · РАЗРЕШЕНИЕ РАУНДА: БИТО / БЕРУ / ДОБОР / ФИНАЛ ══════ */

async function resolveTable(kind, who) {
  const epoch = state.epoch;
  clearTimers();
  state.busy = true;
  state.phase = 'clearing';
  state.clearAnim = kind === 'take' ? 'take' : 'bito';
  renderAll();

  const attackerNow = state.attacker;
  const defenderNow = state.defender;

  if (kind === 'take') {
    setStatus(kind === 'take' && who === 'you' ? 'defend' : 'ai', '📥',
      who === 'you' ? 'Вы забираете карты со стола' : 'Соперник забирает карты со стола');
    Sound.play('take');
    haptic('warning');
  } else {
    setStatus('done', '✨', who === 'you' ? 'Бито — вы уводите карты в отбой' : 'Бито — соперник уводит карты в отбой');
    Sound.play('bito');
    haptic('light');
  }

  await sleep(kind === 'take' ? T_TAKE : T_BITO);
  if (!sameEpoch(epoch)) return;

  const pool = [];
  state.table.forEach(function (slot) {
    pool.push(slot.attack);
    if (slot.defend) pool.push(slot.defend);
  });

  if (kind === 'bito') {
    state.bito += pool.length;
    sweepBitoPile();
  } else {
    pool.forEach(function (card) { handOf(who).push(card); });
  }

  state.table = [];
  state.clearAnim = null;
  state.selected = null;

  /* добор: первым добирает тот, кто ходил, затем отбивавшийся / взявший */
  drawUpTo(attackerNow);
  drawUpTo(defenderNow);

  renderAll();
  await sleep(260);
  if (!sameEpoch(epoch)) return;

  const outcome = checkGameOver();
  if (outcome) { finishGame(outcome); return; }

  /* после отбоя роли меняются, после взятия атакующий ходит снова */
  if (kind === 'bito') {
    state.attacker = defenderNow;
    state.defender = attackerNow;
  } else {
    state.attacker = attackerNow;
    state.defender = defenderNow;
  }
  state.round += 1;
  state.phase = 'attack';
  renderAll();
  advance();
}

function drawUpTo(who) {
  const hand = handOf(who);
  while (hand.length < HAND_SIZE && state.deck.length > 0) hand.push(state.deck.pop());
}

/* Партия заканчивается, когда колода пуста и у кого-то не осталось карт. */
function checkGameOver() {
  if (state.deck.length > 0) return null;
  const aiEmpty = state.ai.length === 0;
  const youEmpty = state.you.length === 0;
  if (aiEmpty && youEmpty) return 'draw';
  if (aiEmpty) return 'win';
  if (youEmpty) return 'lose';
  return null;
}

/* ═══════════════════════ 12 · ДИСПЕТХОДЕР ХОДА (advance) ═════════════ */

function clearTimers() {
  if (aiTimer) { clearTimeout(aiTimer); aiTimer = null; }
  if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
}

function advance() {
  if (state.over) { state.busy = false; refreshStatus(); renderAll(); return; }
  if (state.phase === 'idle' || state.phase === 'done' || state.phase === 'clearing' || state.phase === 'deal') {
    renderAll();
    return;
  }

  /* у атакующего нечем крыть стол и нечего подкинуть — авто-«БИТО» */
  if (state.phase === 'toss' && state.attacker === 'you' && legalMoveIds().length === 0) {
    state.busy = true;
    setStatus('you', '🧹', 'Подкидывать нечего · отбой');
    renderAll();
    const epoch = state.epoch;
    autoTimer = setTimeout(function () {
      autoTimer = null;
      if (!sameEpoch(epoch) || state.over) return;
      if (state.phase === 'toss' && state.attacker === 'you') playBito('you');
    }, T_AUTO_BITO);
    return;
  }

  if (actorNow() === 'ai') {
    state.busy = true;
    renderAll();
    refreshStatus();
    scheduleAi();
    return;
  }

  state.busy = false;
  renderAll();
  refreshStatus();
}

function scheduleAi(extraDelay) {
  const epoch = state.epoch;
  const delay = (AI_MIN_DELAY + Math.random() * (AI_MAX_DELAY - AI_MIN_DELAY)) + (extraDelay || 0);
  if (aiTimer) clearTimeout(aiTimer);
  aiTimer = setTimeout(function () {
    aiTimer = null;
    if (!sameEpoch(epoch) || state.over) return;
    aiAct();
  }, delay);
}

/* ═══════════════════ 13 · ИИ-СОПЕРНИК · DOLGINOK (head-less логика) ══ */

function aiTrumpCount() {
  return state.ai.filter(function (c) { return c.s === state.trumpSuit; }).length;
}

function rankCounts(hand) {
  const map = Object.create(null);
  hand.forEach(function (c) { map[c.r] = (map[c.r] || 0) + 1; });
  return map;
}

/* небольшой джиттер, чтобы ИИ не играл всегда одинаково «по линейке» */
function lowestWithJitter(list) {
  let best = null;
  let bestScore = Infinity;
  list.forEach(function (card) {
    const score = cardCost(card) + randomFloat() * 0.9;
    if (score < bestScore) { bestScore = score; best = card; }
  });
  return best;
}

function tableValue() {
  let total = 0;
  state.table.forEach(function (slot) { total += cardCost(slot.attack); });
  return total;
}
function trumpsOnTable() {
  return state.table.filter(function (slot) { return slot.attack.s === state.trumpSuit; }).length;
}

/* АТАКА: младшая некозырная, в приоритете парные достоинства (есть чем подкинуть). */
function aiPickAttack() {
  if (!state.ai.length) return null;

  let pool = state.ai.slice();
  if (state.table.length > 0) pool = pool.filter(canTossCard);
  if (!pool.length) return null;

  const counts = rankCounts(state.ai);
  const plain = pool.filter(function (c) { return c.s !== state.trumpSuit; });
  const pairs = plain.filter(function (c) { return (counts[c.r] || 0) >= 2; });
  const preferred = pairs.length ? pairs : plain;
  if (preferred.length) return lowestWithJitter(preferred);

  const trumps = pool.filter(function (c) { return c.s === state.trumpSuit; });
  return trumps.length ? lowestWithJitter(trumps) : null;
}

/* ПОДКИД: оцениваем ценность карты — старшие козыри и старшие карты масти
   летят на стол только когда у соперника реально мало карт. */
function aiDecideToss() {
  if (!canAttackMore()) return { action: 'bito' };

  const pool = state.ai.filter(canTossCard);
  if (!pool.length) return { action: 'bito' };

  const card = lowestWithJitter(pool);
  const defHand = handOf(state.defender).length;
  const attacks = state.table.length;
  const deckLeft = state.deck.length;
  const pressure = defHand <= attacks + 1 || state.youTookLast || (deckLeft === 0 && defHand <= 2);

  if (card.s === state.trumpSuit) {
    const highTrump = card.r >= 5;                        /* J, Q, K, A — не мусорим козырем */
    if (highTrump && !(pressure && attacks <= 1)) return { action: 'bito' };
    if (aiTrumpCount() <= 1 && tableValue() <= 4) return { action: 'bito' };
    if (attacks >= 3 && !pressure) return { action: 'bito' };
  } else if (card.r >= 6) {                               /* Q, K, A обычной масти — дорого */
    if (!pressure) return { action: 'bito' };
    if (deckLeft > 0 && defHand >= 5 && attacks >= 2) return { action: 'bito' };
  }

  if (attacks >= 3 && !pressure) return { action: 'bito' };
  return { action: 'toss', card: card };
}

/* ЗАЩИТА: бьём минимально возможной картой той же масти либо младшим козырем.
   Жмём «Беру», когда цена отбоя выше того, что лежит на столе, либо когда
   на столе слишком много карт / козырей. */
function aiDecideDefense() {
  const open = openAttackCard();
  if (!open) return { action: 'take' };

  const opts = beatsList(state.ai, open);
  if (!opts.length) return { action: 'take' };

  const pick = opts[0];
  const cost = cardCost(pick);
  const spendsTrumpOnPlain = pick.s === state.trumpSuit && open.s !== state.trumpSuit;
  const value = tableValue();
  const many = state.table.length >= 3;
  const deckLeft = state.deck.length;

  /* колода пуста — скидывать карты важнее, чем копить их на руках */
  if (deckLeft === 0) {
    if (cost >= 106 && value < 12) return { action: 'take' };
    return { action: 'beat', card: pick };
  }

  if (spendsTrumpOnPlain) {
    if (cost >= 105) return { action: 'take' };            /* крыть мелочь старшим козырём */
    if (many || value >= 18) return { action: 'take' };    /* много или дорого */
    if (trumpsOnTable() >= 1) return { action: 'take' };
    if (aiTrumpCount() <= 1 && value <= 4) return { action: 'take' }; /* держим последний козырь */
    return { action: 'beat', card: pick };
  }

  if (cost >= 7 && value <= 3) return { action: 'take' };  /* Король/Туз за шестёрку */
  if (many && value >= 26) return { action: 'take' };      /* «слишком много дорогих карт» */
  if (trumpsOnTable() >= 2 && value >= 40) return { action: 'take' };
  return { action: 'beat', card: pick };
}

function aiAct() {
  if (state.over || !state.started) return;

  if (state.phase === 'attack') {
    const card = aiPickAttack();
    if (card) { playAttackCard('ai', card); return; }
    const outcome = checkGameOver();
    if (outcome) { finishGame(outcome); return; }
    state.busy = false; renderAll(); refreshStatus();
    return;
  }

  if (state.phase === 'toss') {
    const decision = aiDecideToss();
    if (decision.action === 'toss') { playAttackCard('ai', decision.card); return; }
    playBito('ai');
    return;
  }

  if (state.phase === 'defend') {
    const decision = aiDecideDefense();
    if (decision.action === 'beat') { playDefendCard('ai', decision.card); return; }
    playTake('ai');
    return;
  }

  state.busy = false;
  renderAll();
  refreshStatus();
}

/* ═══════════════════════════ 14 · ФИНАЛ ПАРТИИ ═══════════════════════ */

function finishGame(outcome) {
  const payout = outcome === 'win' ? state.bet * 2 : (outcome === 'draw' ? state.bet : 0);
  const net = payout - state.bet;

  state.over = true;
  state.busy = false;
  state.phase = 'done';
  state.selected = null;
  state.balance = Math.max(0, state.balance + payout);
  state.score.played += 1;
  if (outcome === 'win') state.score.wins += 1;
  else if (outcome === 'lose') state.score.losses += 1;
  else state.score.draws += 1;

  storeBalance(state.balance);
  clearTimers();
  renderAll();

  if (outcome === 'win') { flashBalance('win'); Sound.play('win'); haptic('win'); }
  else if (outcome === 'draw') { flashBalance('win'); Sound.play('draw'); haptic('warning'); }
  else { flashBalance('lose'); Sound.play('lose'); haptic('error'); }

  if (outcome === 'win') setStatus('you', '🏆', 'Победа · соперник — дурак, ставка удвоена');
  else if (outcome === 'draw') setStatus('done', '🤝', 'Ничья · карты кончились одновременно, ставка возвращена');
  else setStatus('ai', '💥', 'Вы — дурак · ставка ушла в банк соперника');

  showGameOver({ outcome: outcome, bet: state.bet, payout: payout, net: net, balance: state.balance });
}

/* ═══════════════ 15 · ОВЕРЛЕЙ РЕЗУЛЬТАТА (строится из JS) ════════════
   В index.html/style.css оверлея нет, поэтому он создаётся здесь и живёт на
   CSS-переменных стиля проекта — вёрстка и таблица стилей не тронуты.     */

const OVERLAY_CSS = [
  '.dv-ovl{position:fixed;inset:0;z-index:60;display:grid;place-items:center;',
  '  padding:calc(16px + env(safe-area-inset-top)) 16px calc(16px + env(safe-area-inset-bottom));',
  '  background:radial-gradient(70% 50% at 50% 40%,rgba(10,70,48,.55),rgba(1,12,9,.86));',
  '  -webkit-backdrop-filter:blur(10px) saturate(120%);backdrop-filter:blur(10px) saturate(120%);',
  '  opacity:0;pointer-events:none;transition:opacity .3s var(--ease)}',
  '.dv-ovl.is-open{opacity:1;pointer-events:auto}',
  '.dv-ovl__card{width:min(372px,100%);display:grid;gap:10px;padding:20px 18px 18px;text-align:center;',
  '  border-radius:24px;border:1px solid var(--glass-brd);background:var(--glass-bg);',
  '  box-shadow:var(--glass-sh),0 0 34px var(--neon-soft),0 26px 60px rgba(0,0,0,.62);',
  '  -webkit-backdrop-filter:var(--glass-blur);backdrop-filter:var(--glass-blur);',
  '  transform:translateY(18px) scale(.93);transition:transform .34s var(--ease)}',
  '.dv-ovl.is-open .dv-ovl__card{transform:none}',
  '.dv-ovl__icon{font-size:46px;line-height:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}',
  '.dv-ovl__title{margin:0;font-size:24px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;',
  '  background:linear-gradient(178deg,var(--gold-1),var(--gold-2) 52%,var(--gold-3));',
  '  -webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 18px var(--neon-soft)}',
  '.dv-ovl.is-lose .dv-ovl__title{background:linear-gradient(178deg,#ffd9dc,var(--danger) 55%,var(--danger-deep));',
  '  -webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 0 18px rgba(255,90,110,.35)}',
  '.dv-ovl__sub{margin:0;font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--tx-dim)}',
  '.dv-ovl__ledger{display:grid;gap:5px;margin-top:4px;padding:11px 12px;border-radius:16px;',
  '  background:rgba(0,0,0,.28);border:1px solid rgba(243,202,98,.16)}',
  '.dv-ovl__row{display:flex;align-items:center;justify-content:space-between;gap:10px;',
  '  font-size:11.5px;font-weight:700;color:var(--tx-dim)}',
  '.dv-ovl__row b{font-variant-numeric:tabular-nums;color:var(--tx)}',
  '.dv-ovl__row--win b{color:var(--gold-1)}',
  '.dv-ovl__row--lose b{color:#ffb4bb}',
  '.dv-ovl__row--total{margin-top:2px;padding-top:7px;border-top:1px dashed rgba(243,202,98,.24);',
  '  font-size:13px;color:var(--tx)}',
  '.dv-ovl__actions{display:grid;gap:8px;margin-top:6px}',
  '.dv-ovl__btn{display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:16px;',
  '  font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--tx-dark);',
  '  background:linear-gradient(178deg,var(--gold-1),var(--gold-2) 52%,var(--gold-3));border:1px solid #fff4d2;',
  '  box-shadow:0 10px 24px rgba(150,110,16,.42),0 0 20px var(--neon-soft),inset 0 1px 0 #fff;',
  '  transition:transform .14s var(--ease),filter .2s}',
  '.dv-ovl__btn:active{transform:translateY(2px) scale(.985);filter:brightness(1.06)}',
  '.dv-ovl__note{font-size:9.5px;font-weight:700;letter-spacing:.06em;color:var(--tx-dim)}',
  '.dv-ovl__note b{color:var(--gold-1)}'
].join('\n');

let overlay = null;

function buildOverlay() {
  if (overlay) return overlay;

  const style = document.createElement('style');
  style.id = 'dv-overlay-styles';
  style.textContent = OVERLAY_CSS;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.className = 'dv-ovl';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML =
    '<div class="dv-ovl__card">' +
      '<span class="dv-ovl__icon" id="dv-ovl-icon">🏆</span>' +
      '<h2 class="dv-ovl__title" id="dv-ovl-title">Победа</h2>' +
      '<p class="dv-ovl__sub" id="dv-ovl-sub">Соперник — дурак</p>' +
      '<div class="dv-ovl__ledger">' +
        '<span class="dv-ovl__row"><span>Ставка</span><b id="dv-ovl-bet">—</b></span>' +
        '<span class="dv-ovl__row" id="dv-ovl-payrow"><span id="dv-ovl-paylabel">Выигрыш (ставка ×2)</span><b id="dv-ovl-pay">—</b></span>' +
        '<span class="dv-ovl__row dv-ovl__row--total" id="dv-ovl-netrow"><span id="dv-ovl-netlabel">Итог партии</span><b id="dv-ovl-net">—</b></span>' +
        '<span class="dv-ovl__row"><span>Баланс</span><b id="dv-ovl-balance">—</b></span>' +
      '</div>' +
      '<div class="dv-ovl__actions">' +
        '<button class="dv-ovl__btn" id="dv-ovl-new" type="button">НОВАЯ ИГРА</button>' +
        '<span class="dv-ovl__note" id="dv-ovl-note"></span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(root);

  overlay = {
    root: root,
    icon: root.querySelector('#dv-ovl-icon'),
    title: root.querySelector('#dv-ovl-title'),
    sub: root.querySelector('#dv-ovl-sub'),
    bet: root.querySelector('#dv-ovl-bet'),
    payRow: root.querySelector('#dv-ovl-payrow'),
    payLabel: root.querySelector('#dv-ovl-paylabel'),
    pay: root.querySelector('#dv-ovl-pay'),
    net: root.querySelector('#dv-ovl-net'),
    netRow: root.querySelector('#dv-ovl-netrow'),
    balance: root.querySelector('#dv-ovl-balance'),
    note: root.querySelector('#dv-ovl-note'),
    btn: root.querySelector('#dv-ovl-new')
  };
  overlay.btn.addEventListener('click', function () {
    Sound.play('tap');
    hideGameOver();
    startNewGame();
  });
  return overlay;
}

function signed(value) {
  if (value > 0) return '+' + fmtMoney(value);
  if (value < 0) return '−' + fmtMoney(Math.abs(value));
  return '±0';
}

function hideGameOver() {
  if (overlay) overlay.root.classList.remove('is-open');
}

function showGameOver(result) {
  const view = buildOverlay();
  const isWin = result.outcome === 'win';
  const isDraw = result.outcome === 'draw';

  view.root.classList.remove('is-lose', 'is-open');
  view.root.classList.toggle('is-lose', result.outcome === 'lose');

  view.icon.textContent = isWin ? '🏆' : (isDraw ? '🤝' : '💥');
  view.title.textContent = isWin ? 'Победа' : (isDraw ? 'Ничья' : 'Вы — дурак');
  view.sub.textContent = isWin
    ? 'Соперник DOLGINOK остался с картами'
    : (isDraw ? 'Карты кончились одновременно у обоих' : 'Колода пуста, а карты на руках остались у вас');

  view.bet.textContent = '−' + fmtMoney(result.bet) + ' ₽';
  view.payLabel.textContent = isWin ? 'Выигрыш (ставка ×2)' : (isDraw ? 'Возврат ставки' : 'Выигрыш');
  view.pay.textContent = (result.payout > 0 ? '+' + fmtMoney(result.payout) : '±0') + ' ₽';
  view.payRow.classList.toggle('dv-ovl__row--win', result.payout > 0);
  view.payRow.classList.toggle('dv-ovl__row--lose', result.outcome === 'lose');

  view.net.textContent = signed(result.net) + ' ₽';
  if (view.netRow) {
    view.netRow.classList.toggle('dv-ovl__row--win', result.net > 0);
    view.netRow.classList.toggle('dv-ovl__row--lose', result.net < 0);
  }
  view.balance.textContent = fmtMoney(result.balance) + ' ₽';

  view.note.innerHTML = state.balance < MIN_BET
    ? 'На балансе не хватает даже минимальной ставки — «НОВАЯ ИГРА» восстановит её до <b>' +
      fmtMoney(Math.max(initialBalance, MIN_BET)) + ' ₽</b>'
    : 'Сыграно партий: <b>' + state.score.played + '</b> · побед: <b>' + state.score.wins +
      '</b> · поражений: <b>' + state.score.losses + '</b> · ничьих: <b>' + state.score.draws + '</b>';

  requestAnimationFrame(function () { view.root.classList.add('is-open'); });
}

/* ═══════════ 16 · НОВАЯ ИГРА: СТАВКА, РАЗДАЧА, ПЕРВЫЙ ХОД ════════════ */

function currentBetChoice() {
  let chosen = MIN_BET;
  el.betInputs.forEach(function (input) {
    if (input.checked) chosen = parseInt(input.value, 10) || MIN_BET;
  });
  if (BETS.indexOf(chosen) < 0) chosen = MIN_BET;
  return chosen;
}

function syncBetUi() {
  const bet = currentBetChoice();
  qa('.bet__opt', el.betSelector).forEach(function (label) {
    const input = label.querySelector('input[name="bet"]');
    label.classList.toggle('is-active', !!(input && input.checked));
  });
  el.betAi.textContent = String(state.started && !state.over ? state.bet : bet);
}

function lowestTrumpOf(hand) {
  let best = null;
  hand.forEach(function (card) {
    if (card.s !== state.trumpSuit) return;
    if (!best || card.r < best.r) best = card;
  });
  return best;
}

/* Первый ход — у младшего козыря; если козырей на руках нет ни у кого,
   партию начинает игрок (козырная карта пока лежит в колоде). */
function decideFirstAttacker() {
  const mine = lowestTrumpOf(state.you);
  const theirs = lowestTrumpOf(state.ai);
  if (mine && theirs) return mine.r < theirs.r ? 'you' : 'ai';
  if (mine) return 'you';
  if (theirs) return 'ai';
  return 'you';
}

function resetTableDom() {
  el.playerFan.innerHTML = '';
  el.opponentFan.innerHTML = '';
  el.slotEls.forEach(function (node) {
    node.className = 'slot';
    node.innerHTML = '';
  });
  el.table.classList.remove('is-droppable');
}

async function startNewGame() {
  let bet = currentBetChoice();

  /* баланс ушёл в ноль — демо-баланс восстанавливаем до начального
     (но минимум до минимальной ставки, иначе играть невозможно) */
  if (state.balance < MIN_BET) {
    const refill = Math.max(initialBalance, MIN_BET);
    state.balance = refill;
    storeBalance(state.balance);
    renderBalance();
    flashBalance('win');
    Sound.play('draw');
    hint('Демо-баланс восстановлен до ' + fmtMoney(refill) + ' ₽');
  }
  if (bet > state.balance) {
    /* ставка не по карману — автоматически понижаем до доступной */
    const affordable = BETS.filter(function (v) { return v <= state.balance; }).pop();
    if (!affordable) return;
    bet = affordable;
    flashBalance('lose');
    Sound.play('error');
    hint('Ставка ' + currentBetChoice() + ' ₽ больше баланса · играем на ' + bet + ' ₽');
    el.betInputs.forEach(function (input) {
      if (parseInt(input.value, 10) === bet) input.checked = true;
    });
    syncBetUi();
  }

  state.epoch++;
  const epoch = state.epoch;
  clearTimers();
  if (hintTimer) { clearTimeout(hintTimer); hintTimer = null; }
  hideGameOver();

  /* ставка списывается с баланса в момент раздачи */
  state.bet = bet;
  state.balance = Math.max(0, state.balance - bet);
  storeBalance(state.balance);

  state.deck = buildDeck();
  state.trump = state.deck[0];
  state.trumpSuit = state.deck[0].s;
  state.you = [];
  state.ai = [];
  state.table = [];
  state.bito = 0;
  state.round = 1;
  state.over = false;
  state.started = true;
  state.busy = true;
  state.selected = null;
  state.clearAnim = null;
  state.lastTaker = null;
  state.youTookLast = false;
  state.aiTookLast = false;
  state.phase = 'deal';

  resetTableDom();
  renderAll();
  syncBetUi();
  replayTrumpFlip();
  el.deck.classList.add('is-dealing');
  setStatus('ai', '🂠', 'Раздача ' + HAND_SIZE + ' карт · козырь ' + SUITS[state.trumpSuit].ch);

  /* раздаём по одной карте, чтобы вееры прилетали по очереди */
  for (let i = 0; i < HAND_SIZE; i++) {
    if (state.deck.length) state.you.push(state.deck.pop());
    renderYou(); renderDeck(); renderCounters();
    Sound.play('deal');
    await sleep(T_DEAL);
    if (!sameEpoch(epoch)) return;
    if (state.deck.length) state.ai.push(state.deck.pop());
    renderAi(); renderDeck(); renderCounters();
    await sleep(T_DEAL);
    if (!sameEpoch(epoch)) return;
  }

  if (!sameEpoch(epoch)) return;
  el.deck.classList.remove('is-dealing');

  state.attacker = decideFirstAttacker();
  state.defender = rival(state.attacker);
  state.phase = 'attack';
  state.busy = false;
  renderAll();

  /* первая атака соперника — чуть позже, чтобы игрок успел оценить руку */
  advance();

  /* объявляем козырь и первый ход уже после диспетчера — иначе статус перебивается */
  const first = state.attacker === 'you' ? 'первый ход ваш' : 'первым ходит соперник';
  setStatus(state.attacker === 'you' ? 'you' : 'ai', '🃏',
    'Козырь ' + SUITS[state.trumpSuit].ch + ' · ' + first + ' · ставка ' + state.bet + ' ₽');
  haptic('medium');
}

/* ══════════════════ 17 · УПРАВЛЕНИЕ: КЛИКИ, КЛАВИАТУРА, КНОПКИ ════════ */

function findInHand(who, cardId) {
  const hand = handOf(who);
  for (let i = 0; i < hand.length; i++) if (hand[i].id === cardId) return hand[i];
  return null;
}

function errorFeedback(message) {
  Sound.play('error');
  haptic('error');
  hint(message);
}

function commitSelected(card) {
  if (state.phase === 'defend' && state.defender === 'you') { playDefendCard('you', card); return; }
  if ((state.phase === 'attack' || state.phase === 'toss') && state.attacker === 'you') { playAttackCard('you', card); return; }
  errorFeedback(explainBlock(card));
}

/* Клик по своей карте: первый раз — выбор (.is-selected), второй — ход/отбой. */
function selectOrPlayCard(cardId) {
  if (!cardId) return;
  const card = findInHand('you', cardId);
  if (!card) return;

  if (!state.started || state.over || state.busy) { errorFeedback(explainBlock(card)); return; }
  if (legalMoveIds().indexOf(cardId) < 0) { errorFeedback(explainBlock(card)); return; }

  if (state.selected === cardId) { commitSelected(card); return; }

  state.selected = cardId;
  Sound.play('select');
  haptic('light');
  renderYou();
  renderControls();
  const action = state.phase === 'defend' ? 'отбой' : 'ход';
  hint('Выбрано «' + card.id + '» · нажмите ещё раз или по столу — ' + action, '👆');
}

function elementFromEvent(event) {
  const target = event.target;
  if (!target) return null;
  if (target.nodeType === 1) return target;
  return target.parentElement;
}

/* closest() с фоллбэком для старых WebView */
function closestBy(node, selector) {
  if (!node) return null;
  if (node.closest) return node.closest(selector);
  while (node && node.nodeType === 1) {
    if (node.matches && node.matches(selector)) return node;
    node = node.parentElement;
  }
  return null;
}

function onPlayerFanClick(event) {
  const node = closestBy(elementFromEvent(event), '.card');
  if (!node || !node.dataset || !node.dataset.card) return;
  selectOrPlayCard(node.dataset.card);
}

/* Клик по столу или слоту — сбрасывает выбранную карту в дело (ход либо отбой).
   Колода, отбой и плашки игроков в счёт не идут: там свои смыслы. */
function onTableClick(event) {
  const node = elementFromEvent(event);
  if (!node) return;
  if (closestBy(node, '.actions') ||   /* крупные кнопки под большим пальцем */
      closestBy(node, '.fan') ||       /* веера обрабатываются своим хендлером */
      closestBy(node, '.side') ||      /* колода и стопка «БИТО» */
      closestBy(node, '.seat')) return;/* плашки «ВЫ» и «ИИ» */

  const wantsAction = !!closestBy(node, '.slot') || !!closestBy(node, '.slots');
  if (!state.started || state.over) return;

  if (!state.selected) {
    if (wantsAction) errorFeedback('Сначала выберите карту в своей руке');
    return;
  }
  if (state.busy) {
    if (wantsAction) errorFeedback('Сейчас думает соперник · подождите');
    return;
  }

  const card = findInHand('you', state.selected);
  if (!card) { state.selected = null; renderYou(); renderControls(); return; }
  if (legalMoveIds().indexOf(card.id) < 0) { errorFeedback(explainBlock(card)); return; }
  commitSelected(card);
}

function onBitoClick() {
  if (!state.started || state.over) { hint('Партия ещё не началась'); return; }
  if (state.busy) { hint('Подождите хода соперника'); return; }
  if (state.phase !== 'toss' || state.attacker !== 'you') {
    errorFeedback('«БИТО» доступно, когда все карты отбиты и подкидывать можете вы');
    return;
  }
  Sound.play('tap');
  playBito('you');
}

function onTakeClick() {
  if (!state.started || state.over) { hint('Партия ещё не началась'); return; }
  if (state.busy) { hint('Подождите хода соперника'); return; }
  if (state.phase !== 'defend' || state.defender !== 'you') {
    errorFeedback('«Беру» доступно только тогда, когда отбиваетесь вы');
    return;
  }
  Sound.play('tap');
  playTake('you');
}

function onNewClick() {
  if (state.busy) { hint('Подождите окончания обмена картами'); return; }
  Sound.play('tap');
  if (state.started && !state.over) hint('Партия сброшена · ставка этой партии уже в банке соперника');
  startNewGame();
}

function syncSoundUi() {
  el.btnSound.classList.toggle('is-on', Sound.on);
  el.btnSound.classList.toggle('is-off', !Sound.on);
  el.btnSound.setAttribute('aria-pressed', Sound.on ? 'true' : 'false');
  el.btnSound.setAttribute('aria-label', Sound.on ? 'Звук включён' : 'Звук выключен');
}

function onSoundClick() {
  Sound.toggle();
  syncSoundUi();
}

/* ═══════════ 17.1 · ФИНАЛ СЕССИИ · WebApp.sendData боту (ЭТАП 3) ═══════
   Чистый профит за сессию = текущий баланс − стартовый баланс сессии.
   Сумма округляется до копеек и уходит боту одним JSON-сообщением. После
   успешной отправки отсчёт (state.initialBalance) перебазивируется на
   текущий баланс: если мини-апп по какой-то причине не закрылся и игрок
   продолжит партию, повторный «ВЫХОД» пришлёт боту только новый прирост,
   а не ту же сумму второй раз.                                            */

let exitCloseTimer = null;

function settleSession() {
  const settled = Math.round((state.balance - state.initialBalance) * 100) / 100;
  const payload = JSON.stringify({
    session_id: state.sessionId,
    session_profit: settled,
    profit: settled,
    final_balance: state.balance
  });

  let sent = false;
  try {
    const webApp = window.Telegram?.WebApp;
    if (typeof webApp?.sendData === 'function') {
      window.Telegram?.WebApp?.sendData(payload);   /* ровно как в ТЗ ЭТАПА 3 */
      sent = true;
    }
  } catch (err) { console.warn('[durak] WebApp.sendData:', err); }

  if (sent) {
    state.sessionSettled = true;
    state.sessionProfit = Math.round((state.sessionProfit + settled) * 100) / 100;
    state.initialBalance = state.balance;           /* счётчик профита обнулён */
  }

  storeBalance(state.balance);                      /* копия баланса — в LS/облако */
  console.info('[durak] sendData(' + state.sessionId + ') →', payload, sent ? '· доставлено' : '· Telegram недоступен');
  return { settled: settled, payload: payload, sent: sent };
}

function onExitClick() {
  Sound.play('tap');
  haptic('light');

  /* ЭТАП 3: без блокирующих popup-окон — сначала sendData, потом close.
     TG.showPopup со своей кнопкой «Выйти» перехватывал тап и мог сорвать
     отправку данных боту, поэтому путь с popup убран полностью.           */
  settleSession();

  const running = state.started && !state.over;
  const profit = state.sessionProfit;
  const shown = (profit >= 0 ? '+' : '−') + fmtMoney(Math.abs(profit));

  if (running) {
    hint('Партия на ' + fmtMoney(state.bet) + ' ₽ прервана · профит ' + shown + ' ₽ отправлен боту');
  } else {
    hint('Баланс ' + fmtMoney(state.balance) + ' ₽ · профит ' + shown + ' ₽ отправлен боту');
  }

  if (window.Telegram?.WebApp?.close) {
    if (exitCloseTimer === null) {
      exitCloseTimer = setTimeout(() => {
        exitCloseTimer = null;
        try { window.Telegram?.WebApp?.close(); } catch (err) { /* noop */ }
      }, 250);
    }
    return;
  }

  /* Вне Telegram закрывать нечем: баланс уже лежит в localStorage. */
  hint('Вы вне Telegram: мини-апп закрывается свайпом или кнопкой «×» · ' +
       'баланс ' + fmtMoney(state.balance) + ' ₽ сохранён');
}

function onBetChange() {
  syncBetUi();
  Sound.play('tap');
  const bet = currentBetChoice();
  if (state.started && !state.over) hint('Ставка ' + bet + ' ₽ вступит в силу со следующей партии');
  else if (bet > state.balance) hint('Ставка ' + bet + ' ₽ больше баланса ' + fmtMoney(state.balance) + ' ₽');
}

function onKeydown(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = elementFromEvent(event);
  const tag = target && target.tagName ? target.tagName.toLowerCase() : '';
  const isRadio = !!(target && target.type === 'radio');
  if (tag === 'textarea' || (tag === 'input' && !isRadio)) return;

  const key = event.key;

  if (key === 'Escape') {
    if (state.selected) { state.selected = null; renderYou(); renderControls(); }
    return;
  }

  if (key === 't' || key === 'T' || key === 'e' || key === 'E' || key === 'б' || key === 'Б' || key === 'ь') {
    if (!el.btnTake.disabled) { event.preventDefault(); onTakeClick(); }
    return;
  }

  if (key === ' ' || key === 'Enter') {
    if (tag === 'button' || isRadio) return;   /* пусть нативный клик отработает сам */
    event.preventDefault();
    if (!state.started || state.over) { onNewClick(); return; }
    if (!el.btnBito.disabled) { onBitoClick(); return; }
    if (state.selected) {
      const card = findInHand('you', state.selected);
      if (card) { commitSelected(card); return; }
    }
    if (!el.btnTake.disabled) onTakeClick();
    return;
  }

  if (/^[1-9]$/.test(key)) {
    const index = parseInt(key, 10) - 1;
    const hand = sortHand(state.you);
    if (hand[index]) { event.preventDefault(); selectOrPlayCard(hand[index].id); }
  }
}

/* ═══════════════════ 18 · ИНИЦИАЛИЗАЦИЯ ИВИНИГА ══════════════════════ */

function bindEvents() {
  el.playerFan.addEventListener('click', onPlayerFanClick);
  el.table.addEventListener('click', onTableClick);
  el.btnBito.addEventListener('click', onBitoClick);
  el.btnTake.addEventListener('click', onTakeClick);
  el.btnNew.addEventListener('click', onNewClick);
  el.btnSound.addEventListener('click', onSoundClick);
  el.btnExit.addEventListener('click', onExitClick);
  el.betSelector.addEventListener('change', onBetChange);
  document.addEventListener('keydown', onKeydown);

  /* Telegram/мобильные браузеры требуют жеста пользователя перед звуком */
  const unlock = function () { Sound.ensure(); };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });

  /* ЭТАП 3: уход свайпом / «×» / Escape мимо кнопки «ВЫХОД» тоже обязан
     донести профит до бота. Дубль исключён флагом state.sessionSettled,
     а возврат в back/forward cache (persisted) пропускается.              */
  const flushOnLeave = function (event) {
    if (event && event.persisted) return;
    if (state.sessionSettled) return;
    settleSession();
  };
  if (typeof window.addEventListener === 'function') {
    window.addEventListener('pagehide', flushOnLeave);
    window.addEventListener('beforeunload', flushOnLeave);
  }
}

/* Стартовое «безмолвное» состояние: колода 36, козырь ещё не открыт,
   статичные демо-карты ЭТАПА 1 улетучиваются. */
function initIdleBoard() {
  state.deck = buildDeck();
  state.trump = null;
  state.trumpSuit = -1;
  state.you = [];
  state.ai = [];
  state.table = [];
  state.bito = 0;
  state.phase = 'idle';
  state.selected = null;

  el.slotEls.forEach(function (node) { node.className = 'slot'; node.innerHTML = ''; });
  renderAll();
  refreshStatus();
}

function init() {
  tgInit();
  Sound.startup();
  syncSoundUi();

  if (!DOM_OK) {
    console.warn('[durak] Не найден обязательный DOM-контракт — логика ЭТАПА 2 не запущена.');
    return;
  }

  syncBetUi();
  state.balance = initialBalance;
  state.bet = currentBetChoice();
  storeBalance(state.balance);
  renderBalance();

  bindEvents();
  initIdleBoard();

  console.info('[durak] сессия:', SESSION_ID, '· баланс:', state.balance, '· ставок доступно:', BETS.join('/'));
}

/* ══════════════════ 19 · DEV-HOOK (состояние движка наружу) ══════════
   Нужен для отладки в консоли Telegram и внешних проверок ЭТАПА 3:
   window.__DURAK__.state / .rules / .ai / .moves / .render / .exit   */

window.__DURAK__ = {
  version: 'stage2',
  state: state,
  config: { BETS, MIN_BET, HAND_SIZE, TABLE_SLOTS, AI_MIN_DELAY, AI_MAX_DELAY, SESSION_ID, initialBalance },
  rules: {
    canBeat, canTossCard, canAttackMore, attackLimit, tableRanks, legalMoveIds,
    beatsList, sortHand, cardCost, decideFirstAttacker, checkGameOver, openAttackCard
  },
  ai: { aiPickAttack, aiDecideToss, aiDecideDefense, tableValue, trumpsOnTable },
  moves: { playAttackCard, playDefendCard, playBito, playTake, startNewGame, advance },
  render: { renderAll, showGameOver, hideGameOver },
  exit: { settleSession, onExitClick, tgClose }
};

init();
