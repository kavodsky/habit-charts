'use strict';
// Habit Charts — draws habit progress (% of daily goal) from note frontmatter.
// No dependencies, no network, no code execution from notes: only a YAML config is read.
const { Plugin, MarkdownRenderChild, parseYaml, moment } = require('obsidian');

const ISO = 'YYYY-MM-DD';
const SVG_NS = 'http://www.w3.org/2000/svg';
const PALETTE = ['#4285f4', '#db4437', '#f4b400', '#0f9d58', '#ab47bc', '#00acc1', '#ff7043'];

/* ---------- small helpers ---------- */

function h(tag, cls, parent, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

function s(tag, attrs, parent, text) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

const fmt = (v) => v.toFixed(2);

/* ---------- translations ---------- */

// UI language: `lang: en | de | hu | uk` in the block config; with no `lang` (or `lang: auto`)
// the Obsidian language is used; anything else falls back to English.
// Month names and date formats are kept here, so nothing depends on which moment.js locales are loaded.
const STRINGS = {
  en: {
    month: 'Month',
    year: 'Year',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthLabel: (y, m) => `${m} ${y}`,
    dateFmt: 'YYYY-MM-DD',
    from: (d) => `from ${d}`,
    until: (d) => `until ${d}`,
    range: (a, b) => `${a} – ${b}`,
    min: 'min',
    avgTitle: 'monthly average',
    avgTip: (n) => `average, ${n} d`,
    noHabits: 'No active habits in this period',
    errGroups: 'A "groups:" list with a title and series is required (see examples/dashboard.md in the plugin repository).',
    errMonth: '"month" must be in YYYY-MM format, for example 2026-11.',
    errNoSeries: (t) => `Group "${t}" has no "series".`,
    errKey: 'Every habit needs a "key" (the frontmatter field name).',
    errGoal: (n) => `"${n}" needs a goal greater than 0 (minutes per day).`,
    errDate: (n, w, v) => `"${n}": "${w}" must be a date in YYYY-MM-DD format, got "${v}".`,
    errOrder: (n, a, b) => `"${n}": "from" (${a}) is after "to" (${b}).`,
  },
  de: {
    month: 'Monat',
    year: 'Jahr',
    months: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monthLabel: (y, m) => `${m} ${y}`,
    dateFmt: 'DD.MM.YYYY',
    from: (d) => `ab ${d}`,
    until: (d) => `bis ${d}`,
    range: (a, b) => `${a} – ${b}`,
    min: 'Min.',
    avgTitle: 'Monatsdurchschnitt',
    avgTip: (n) => `Ø, ${n} T.`,
    noHabits: 'Keine aktiven Gewohnheiten in diesem Zeitraum',
    errGroups: 'Eine Liste "groups:" mit title und series ist erforderlich (siehe examples/dashboard.md im Plugin-Repository).',
    errMonth: '"month" muss im Format YYYY-MM angegeben werden, zum Beispiel 2026-11.',
    errNoSeries: (t) => `Die Gruppe "${t}" hat keine "series".`,
    errKey: 'Jede Gewohnheit braucht einen "key" (den Namen des Frontmatter-Felds).',
    errGoal: (n) => `"${n}" braucht ein Ziel größer als 0 (Minuten pro Tag).`,
    errDate: (n, w, v) => `"${n}": "${w}" muss ein Datum im Format YYYY-MM-DD sein, gefunden: "${v}".`,
    errOrder: (n, a, b) => `"${n}": "from" (${a}) liegt nach "to" (${b}).`,
  },
  hu: {
    month: 'Hónap',
    year: 'Év',
    months: ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'],
    monthLabel: (y, m) => `${y}. ${m}`,
    dateFmt: 'YYYY. MM. DD.',
    from: (d) => `kezdete: ${d}`,
    until: (d) => `vége: ${d}`,
    range: (a, b) => `${a} – ${b}`,
    min: 'perc',
    avgTitle: 'havi átlag',
    avgTip: (n) => `átlag, ${n} nap`,
    noHabits: 'Ebben az időszakban nincs aktív szokás',
    errGroups: 'Szükség van egy "groups:" listára title és series mezőkkel (lásd az examples/dashboard.md fájlt a bővítmény tárolójában).',
    errMonth: 'A "month" értékét YYYY-MM formátumban kell megadni, például 2026-11.',
    errNoSeries: (t) => `A(z) "${t}" csoportnak nincs "series" listája.`,
    errKey: 'Minden szokáshoz kell egy "key" (a frontmatter mező neve).',
    errGoal: (n) => `A(z) "${n}" szokáshoz 0-nál nagyobb cél kell (perc naponta).`,
    errDate: (n, w, v) => `"${n}": a(z) "${w}" értéke YYYY-MM-DD formátumú dátum legyen, de ez van megadva: "${v}".`,
    errOrder: (n, a, b) => `"${n}": a "from" (${a}) a "to" (${b}) után van.`,
  },
  uk: {
    month: 'Місяць',
    year: 'Рік',
    months: ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'],
    monthLabel: (y, m) => `${m} ${y}`,
    dateFmt: 'DD.MM.YYYY',
    from: (d) => `з ${d}`,
    until: (d) => `до ${d}`,
    range: (a, b) => `${a} – ${b}`,
    min: 'хв',
    avgTitle: 'середнє за місяць',
    avgTip: (n) => `середнє, ${n} дн.`,
    noHabits: 'У цей період немає активних звичок',
    errGroups: 'Потрібен список "groups:" з title і series (див. examples/dashboard.md у репозиторії плагіна).',
    errMonth: '"month" має бути у форматі YYYY-MM, наприклад 2026-11.',
    errNoSeries: (t) => `У групі "${t}" немає "series".`,
    errKey: 'У кожної звички має бути "key" (назва поля у frontmatter).',
    errGoal: (n) => `Для "${n}" потрібна ціль більша за 0 (хвилин на день).`,
    errDate: (n, w, v) => `"${n}": "${w}" має бути датою у форматі YYYY-MM-DD, а тут "${v}".`,
    errOrder: (n, a, b) => `"${n}": "from" (${a}) пізніше за "to" (${b}).`,
  },
};

let L = STRINGS.en; // strings of the block that is being drawn right now (set at the start of draw())

function pickLang(cfgLang) {
  const explicit = cfgLang != null && String(cfgLang).trim().toLowerCase() !== 'auto';
  const code = String((explicit ? cfgLang : moment.locale()) || '').trim().toLowerCase().split(/[-_]/)[0];
  return STRINGS[code] || STRINGS.en;
}

function isoOf(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return moment(v).format(ISO);
  return String(v).slice(0, 10);
}

/* ---------- series / periods ---------- */

// A series is either { name, key, goal } or { periods: [ { from?, to?, name, key, goal }, ... ] }.
// Periods let you switch a direction (e.g. Jeremiah -> Isaiah) without losing old history.
// `prefix` (block-level config) is put in front of every key, so only the fields listed in the
// config are ever read from the note, e.g. prefix "hc_" + key "chemistry" -> frontmatter "hc_chemistry".
function checkDate(v, name, what) {
  if (v == null) return;
  if (!moment(v, ISO, true).isValid()) {
    throw new Error(L.errDate(name, what, v));
  }
}

function periodsOf(series, prefix) {
  const raw = Array.isArray(series.periods) ? series.periods : [series];
  const out = raw.map((p) => ({
    from: isoOf(p.from),
    to: isoOf(p.to),
    name: p.name != null ? String(p.name) : String(p.key),
    key: String(p.key),
    field: (prefix || '') + String(p.key),
    goal: Number(p.goal),
  }));
  for (const p of out) {
    if (!p.key || p.key === 'undefined') throw new Error(L.errKey);
    if (!(p.goal > 0)) throw new Error(L.errGoal(p.name));
    checkDate(p.from, p.name, 'from');
    checkDate(p.to, p.name, 'to');
    if (p.from && p.to && p.from > p.to) throw new Error(L.errOrder(p.name, p.from, p.to));
  }
  return out;
}

function periodAt(periods, iso) {
  return periods.find((p) => (!p.from || p.from <= iso) && (!p.to || iso <= p.to));
}

// Missing file, missing field or non-number -> 0%.
// A day outside every period of the series (before the direction started, after it ended) -> null:
// nothing is drawn and the day does not count in averages.
function valueAt(periods, iso, fm) {
  const p = periodAt(periods, iso);
  if (!p) return { pct: null, mins: 0, name: null, goal: null };
  const raw = fm ? Number(fm[p.field]) : 0;
  const mins = Number.isFinite(raw) ? raw : 0;
  return { pct: (mins / p.goal) * 100, mins, name: p.name, goal: p.goal };
}

// Does the series live at all inside [a, b] (ISO dates)?
function activeIn(periods, a, b) {
  return periods.some((p) => !((p.from && p.from > b) || (p.to && p.to < a)));
}

const dmy = (iso) => moment(iso, ISO).format(L.dateFmt);

function periodNote(p) {
  if (p.from && p.to) return L.range(dmy(p.from), dmy(p.to));
  if (p.from) return L.from(dmy(p.from));
  if (p.to) return L.until(dmy(p.to));
  return '';
}

function legendName(periods, a, b) {
  const act = periods.filter((p) => !((p.from && p.from > b) || (p.to && p.to < a)));
  const names = [];
  for (const p of act) if (!names.includes(p.name)) names.push(p.name);
  let text = names.join(' → ') || (periods[0] && periods[0].name) || '?';
  // a single direction with a start and/or end date: show the dates right in the legend
  if (act.length === 1 && periods.length === 1) {
    const note = periodNote(act[0]);
    if (note) text += ` (${note})`;
  }
  return text;
}

// Markers for "ended on DATE" / "started on DATE" when that date falls inside [a, b] and is not in the future.
function marksFor(periods, a, b, color, indexOfDate) {
  const todayIso = moment().format(ISO);
  const marks = [];
  for (const p of periods) {
    if (p.from && p.from >= a && p.from <= b && p.from <= todayIso && indexOfDate(p.from) >= 0) {
      marks.push({ idx: indexOfDate(p.from), side: 'from', text: `${p.name}: ${L.from(dmy(p.from))}`, color });
    }
    if (p.to && p.to >= a && p.to <= b && p.to <= todayIso && indexOfDate(p.to) >= 0) {
      marks.push({ idx: indexOfDate(p.to), side: 'to', text: `${p.name}: ${L.until(dmy(p.to))}`, color });
    }
  }
  return marks;
}

/* ---------- data building ---------- */

function loadDays(app, folder, dateFormat) {
  const prefix = folder ? folder.replace(/\/+$/, '') + '/' : '';
  const byDate = new Map();
  for (const f of app.vault.getMarkdownFiles()) {
    if (prefix && !f.path.startsWith(prefix)) continue;
    const m = moment(f.basename, dateFormat, true);
    if (!m.isValid()) continue;
    const iso = m.format(ISO);
    if (byDate.has(iso)) continue;
    const cache = app.metadataCache.getFileCache(f);
    byDate.set(iso, (cache && cache.frontmatter) || {});
  }
  return byDate;
}

// One calendar month (1st .. last day). Days after today stay empty (null), they are not drawn as 0%.
function buildMonth(group, byDate, monthStart, prefix) {
  const todayIso = moment().format(ISO);
  const lastDay = monthStart.clone().endOf('month');
  const dates = [];
  for (const d = monthStart.clone(); d.isSameOrBefore(lastDay, 'day'); d.add(1, 'day')) dates.push(d.format(ISO));
  const a = dates[0];
  const b = dates[dates.length - 1];
  const series = [];
  const marks = [];
  group.series.forEach((sr, i) => {
    const periods = periodsOf(sr, prefix);
    // a direction that does not exist in this month at all is not shown
    if (!activeIn(periods, a, b)) return;
    const color = sr.color || PALETTE[i % PALETTE.length];
    const values = [];
    const tips = [];
    for (const d of dates) {
      if (d > todayIso) {
        values.push(null);
        tips.push('');
        continue;
      }
      const r = valueAt(periods, d, byDate.get(d));
      values.push(r.pct);
      tips.push(r.name ? `${r.name}: ${fmt(r.pct)}% (${+r.mins.toFixed(1)} / ${r.goal} ${L.min})` : '');
    }
    series.push({ legend: legendName(periods, a, b), color, values, tips });
    marks.push(...marksFor(periods, a, b, color, (iso) => dates.indexOf(iso)));
  });
  return {
    labels: dates.map((d) => moment(d, ISO).format('D')),
    heads: dates.map((d) => moment(d, ISO).format(L.dateFmt)),
    series,
    marks,
    dots: false,
    every: 3,
  };
}

function buildYear(group, byDate, months, prefix) {
  const today = moment().startOf('day');
  const spans = [];
  for (let i = months - 1; i >= 0; i--) {
    const first = moment().startOf('month').subtract(i, 'months');
    const last = moment.min(first.clone().endOf('month').startOf('day'), today);
    spans.push({ first: first.format(ISO), last: last.format(ISO), firstM: first, lastM: last });
  }
  const a = spans[0].first;
  const b = spans[spans.length - 1].last;
  // index of the month that contains an ISO date, or -1
  const monthIndexOf = (iso) => spans.findIndex((sp) => iso >= sp.first && iso <= sp.last);
  const series = [];
  const marks = [];
  group.series.forEach((sr, i) => {
    const periods = periodsOf(sr, prefix);
    // a direction that does not exist in the whole window is not shown
    if (!activeIn(periods, a, b)) return;
    const color = sr.color || PALETTE[i % PALETTE.length];
    const values = [];
    const tips = [];
    for (const sp of spans) {
      let sum = 0;
      let n = 0;
      const names = [];
      for (const d = sp.firstM.clone(); d.isSameOrBefore(sp.lastM, 'day'); d.add(1, 'day')) {
        const r = valueAt(periods, d.format(ISO), byDate.get(d.format(ISO)));
        if (r.pct == null) continue; // outside the life of the direction: not counted
        sum += r.pct;
        n++;
        if (r.name && !names.includes(r.name)) names.push(r.name);
      }
      if (!n) {
        values.push(null);
        tips.push('');
      } else {
        values.push(sum / n);
        tips.push(`${names.join(' → ')}: ${fmt(sum / n)}% (${L.avgTip(n)})`);
      }
    }
    series.push({ legend: legendName(periods, a, b), color, values, tips });
    marks.push(...marksFor(periods, a, b, color, monthIndexOf));
  });
  return {
    labels: spans.map((sp) => sp.firstM.format('MM.YY')),
    heads: spans.map((sp) => sp.firstM.format('MM.YYYY')),
    series,
    marks,
    dots: true,
    every: 1,
  };
}

/* ---------- SVG chart ---------- */

// Monotone cubic interpolation: smooth like Google Sheets, but never overshoots below 0.
function smoothPath(pts) {
  const n = pts.length;
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`;
  const dx = [];
  const m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i];
  }
  const t = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
    } else {
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const q = a * a + b * b;
      if (q > 9) {
        const tau = 3 / Math.sqrt(q);
        t[i] = tau * a * m[i];
        t[i + 1] = tau * b * m[i];
      }
    }
  }
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3;
    d += ` C${(pts[i][0] + k).toFixed(1)},${(pts[i][1] + t[i] * k).toFixed(1)}`
      + ` ${(pts[i + 1][0] - k).toFixed(1)},${(pts[i + 1][1] - t[i + 1] * k).toFixed(1)}`
      + ` ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

function niceTop(maxVal) {
  const steps = [25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const step = steps.find((x) => maxVal / x <= 6) || 10000;
  return { step, top: Math.ceil(maxVal / step) * step };
}

function drawChart(parent, title, data, smooth) {
  const wrap = h('div', 'hc-wrap', parent);
  h('div', 'hc-title', wrap, title);

  const legend = h('div', 'hc-legend', wrap);
  for (const sr of data.series) {
    const item = h('span', 'hc-legend-item', legend);
    const dot = h('span', 'hc-dot', item);
    dot.style.background = sr.color;
    h('span', null, item, sr.legend);
  }

  const W = 800;
  const H = 300;
  const L = 46;
  const R = 16;
  const T = 12;
  const B = 30;
  const pw = W - L - R;
  const ph = H - T - B;
  const n = data.labels.length;
  const maxVal = Math.max(100, ...data.series.flatMap((sr) => sr.values).filter((v) => v != null));
  const { step, top } = niceTop(maxVal);
  const X = (i) => L + (n === 1 ? 0.5 : i / (n - 1)) * pw;
  const Y = (v) => T + ph - (v / top) * ph;

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hc-svg', role: 'img', 'aria-label': title }, wrap);

  for (let v = 0; v <= top; v += step) {
    s('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: v === 0 ? 'hc-axis' : 'hc-grid' }, svg);
    s('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'hc-tick' }, svg, `${v}%`);
  }
  s('line', { x1: L, x2: W - R, y1: Y(100), y2: Y(100), class: 'hc-target' }, svg);

  const every = data.every || (n <= 12 ? 1 : Math.ceil(n / 8));
  for (let i = 0; i < n; i += every) {
    s('text', { x: X(i), y: H - 10, 'text-anchor': 'middle', class: 'hc-tick' }, svg, data.labels[i]);
  }

  // "ended on / started on" markers: a dashed vertical line in the series colour with a label.
  // "to" labels go to the left of the line, "from" labels to the right, so a handover
  // (ended on 10.12, started on 11.12) does not overlap; each label sits on its own row.
  // Drawn after the lines (see below), so the labels stay readable on top of them.
  const marks = data.marks || [];
  const drawMarks = () => marks.forEach((mk, k) => {
    const x = X(mk.idx);
    s('line', { x1: x, x2: x, y1: T, y2: T + ph, stroke: mk.color, 'stroke-width': 1.5, 'stroke-dasharray': '2 3' }, svg);
    let anchor = mk.side === 'to' ? 'end' : 'start';
    if (anchor === 'end' && x < L + 130) anchor = 'start';
    if (anchor === 'start' && x > W - R - 130) anchor = 'end';
    const dx = anchor === 'start' ? 5 : -5;
    s('text', { x: x + dx, y: T + 12 + (k % 3) * 14, 'text-anchor': anchor, class: 'hc-mark', fill: mk.color }, svg, mk.text);
  });

  for (const sr of data.series) {
    // Days without a value (future days, or outside the life of the direction) are not drawn.
    // A gap splits the line into separate segments.
    const runs = [];
    let run = [];
    sr.values.forEach((v, i) => {
      if (v == null) {
        if (run.length) runs.push(run);
        run = [];
      } else {
        run.push([X(i), Y(v)]);
      }
    });
    if (run.length) runs.push(run);
    for (const pts of runs) {
      if (pts.length === 1) {
        s('circle', { cx: pts[0][0], cy: pts[0][1], r: 3, fill: sr.color }, svg);
        continue;
      }
      const d = smooth ? smoothPath(pts) : 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L');
      s('path', { d, fill: 'none', stroke: sr.color, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      if (data.dots) {
        for (const p of pts) s('circle', { cx: p[0], cy: p[1], r: 3, fill: sr.color }, svg);
      }
    }
  }

  drawMarks();

  if (!data.series.length) {
    s('text', { x: W / 2, y: T + ph / 2, 'text-anchor': 'middle', class: 'hc-tick' }, svg, L.noHabits);
  }

  // hover: vertical guide + tooltip
  const guide = s('line', { y1: T, y2: T + ph, class: 'hc-hover' }, svg);
  const tip = h('div', 'hc-tip', wrap);
  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const xs = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.max(0, Math.min(n - 1, Math.round(((xs - L) / pw) * (n - 1))));
    guide.setAttribute('x1', X(idx));
    guide.setAttribute('x2', X(idx));
    guide.style.opacity = '1';
    tip.replaceChildren();
    h('div', 'hc-tip-head', tip, data.heads[idx]);
    for (const sr of data.series) {
      if (sr.values[idx] == null) continue;
      const row = h('div', null, tip);
      const dot = h('span', 'hc-dot', row);
      dot.style.background = sr.color;
      dot.style.marginRight = '6px';
      row.appendChild(document.createTextNode(sr.tips[idx]));
    }
    tip.style.display = 'block';
    const px = (X(idx) / W) * rect.width + svg.offsetLeft;
    const flip = X(idx) > W * 0.6;
    tip.style.left = flip ? 'auto' : `${px + 12}px`;
    tip.style.right = flip ? `${wrap.clientWidth - px + 12}px` : 'auto';
  });
  svg.addEventListener('mouseleave', () => {
    guide.style.opacity = '0';
    tip.style.display = 'none';
  });
}

/* ---------- code block ---------- */

class HabitsBlock extends MarkdownRenderChild {
  constructor(app, source, el) {
    super(el);
    this.app = app;
    this.source = source;
    this.shift = 0; // months back from the base month, changed by the ‹ › buttons
    this.view = null; // 'month' | 'year', changed by the Month | Year switch
  }

  onload() {
    this.render();
    let timer = null;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.render(), 400);
    };
    this.registerEvent(this.app.metadataCache.on('changed', later));
    this.registerEvent(this.app.vault.on('create', later));
    this.registerEvent(this.app.vault.on('delete', later));
    this.registerEvent(this.app.vault.on('rename', later));
    this.register(() => clearTimeout(timer));
  }

  render() {
    const root = this.containerEl;
    root.replaceChildren();
    try {
      this.draw(root);
    } catch (e) {
      h('div', 'hc-error', root, `habits: ${(e && e.message) || e}`);
    }
  }

  draw(root) {
    const cfg = parseYaml(this.source) || {};
    L = pickLang(cfg.lang);
    if (!Array.isArray(cfg.groups) || !cfg.groups.length) {
      throw new Error(L.errGroups);
    }
    const months = Number(cfg.months) || 12;
    let views = (cfg.views ? [].concat(cfg.views) : ['month']).map(String).filter((v) => v === 'month' || v === 'year');
    views = views.filter((v, i) => views.indexOf(v) === i);
    if (!views.length) views = ['month'];
    // With both views configured, a Month | Year switch shows one of them at a time.
    if (!this.view || !views.includes(this.view)) this.view = views[0];
    const active = this.view;
    const smooth = cfg.smooth !== false;
    // Optional: a prefix for every key, so the plugin reads only its own fields (e.g. "hc_").
    const prefix = cfg.prefix != null ? String(cfg.prefix) : '';
    const byDate = loadDays(this.app, cfg.folder || '', cfg.dateFormat || ISO);

    // Month view = one calendar month: the current one, or `month: YYYY-MM` from the config.
    const thisMonth = moment().startOf('month');
    let base = thisMonth.clone();
    if (cfg.month) {
      base = moment(String(cfg.month), 'YYYY-MM', true);
      if (!base.isValid()) throw new Error(L.errMonth);
      base.startOf('month');
    }
    const maxShift = Math.max(0, thisMonth.diff(base, 'months'));
    this.shift = Math.min(this.shift, maxShift);
    const target = base.clone().add(this.shift, 'months');

    const nav = views.length > 1 || active === 'month' ? h('div', 'hc-nav', root) : null;
    if (views.length > 1) {
      const tabs = h('span', 'hc-tabs', nav);
      for (const v of views) {
        const b = h('button', v === active ? 'hc-tab is-active' : 'hc-tab', tabs, v === 'year' ? L.year : L.month);
        b.addEventListener('click', () => {
          this.view = v;
          this.render();
        });
      }
    }
    if (active === 'month') {
      const prev = h('button', null, nav, '‹');
      prev.addEventListener('click', () => {
        this.shift--;
        this.render();
      });
      h('span', 'hc-nav-label', nav, L.monthLabel(target.year(), L.months[target.month()]));
      const next = h('button', null, nav, '›');
      next.disabled = this.shift >= maxShift;
      next.addEventListener('click', () => {
        this.shift++;
        this.render();
      });
    }

    for (const group of cfg.groups) {
      if (!Array.isArray(group.series) || !group.series.length) {
        throw new Error(L.errNoSeries(group.title || '?'));
      }
      const title = group.title || group.series.map((x) => x.name || x.key).join(', ');
      if (active === 'year') {
        drawChart(root, `${title} — ${L.avgTitle}`, buildYear(group, byDate, months, prefix), smooth);
      } else {
        drawChart(root, title, buildMonth(group, byDate, target, prefix), smooth);
      }
    }
  }
}

module.exports = class HabitChartsPlugin extends Plugin {
  async onload() {
    this.registerMarkdownCodeBlockProcessor('habits', (source, el, ctx) => {
      ctx.addChild(new HabitsBlock(this.app, source, el));
    });
  }
};
