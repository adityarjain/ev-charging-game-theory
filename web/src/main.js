import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./style.css";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  BASELINE, LOW, HIGH, STRATEGIES, analyze, validationErrors, deviations, expectedPayoffs,
  qThresholds, isEq, isJointMax,
} from "./model.js";

gsap.registerPlugin(ScrollTrigger);

// Keep in sync with team.py.
const TEAM = [
  ["Aditya Raj Jain", "2427030117"],
  ["Arnav Khandelwal", "242703019"],
  ["Pranav Chauhan", "2427030220"],
  ["Khushi Yadav", "2427030186"],
];

const $ = (s) => document.querySelector(s);
const rs = (v) => `${v < -0.5 ? "−" : ""}₹${Math.abs(Math.round(v)).toLocaleString("en-IN")}`;
const num = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const pct = (v) => `${Math.round(v * 100)}%`;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const state = { params: { ...BASELINE }, a: HIGH, b: HIGH };

function priceOf(p, s) { return s === LOW ? p.lowPrice : p.highPrice; }

function describe(p, [a, b]) {
  if (a === b) return `both charge ₹${num(priceOf(p, a))}`;
  return `A charges ₹${num(priceOf(p, a))}, B charges ₹${num(priceOf(p, b))}`;
}

function eqSentence(an) {
  const p = an.params, eq = an.equilibria;
  if (!eq.length) return "No stable pair of prices exists.";
  if (eq.length === 1) return `Stable outcome: ${describe(p, eq[0])}.`;
  return `Two stable outcomes: ${eq.map((e) => describe(p, e)).join(", or ")}.`;
}

// Count numbers up instead of snapping, so changes are visible.
function setNumber(el, to, fmt) {
  const from = Number(el.dataset.v ?? to);
  el.dataset.v = to;
  if (reduceMotion || from === to) { el.textContent = fmt(to); return; }
  const o = { v: from };
  gsap.to(o, { v: to, duration: 0.7, ease: "power3.out", onUpdate: () => (el.textContent = fmt(o.v)) });
}

/* ---------------------------------------------------------------- bento */
function renderMatrix() {
  const an = analyze(BASELINE);
  const box = $("#matrix");
  const p = BASELINE;
  box.innerHTML =
    `<div></div>` +
    STRATEGIES.map((b) => `<div class="matrix__h"><span><b>B: ₹${num(priceOf(p, b))}</b>${b === LOW ? "cuts" : "holds"}</span></div>`).join("");
  for (const a of STRATEGIES) {
    box.insertAdjacentHTML("beforeend",
      `<div class="matrix__h matrix__h--row"><span><b>A: ₹${num(priceOf(p, a))}</b>${a === LOW ? "cuts" : "holds"}</span></div>`);
    for (const b of STRATEGIES) {
      const [ua, ub] = an.at(a, b);
      const brA = an.brA[b].includes(a), brB = an.brB[a].includes(b);
      const tags = [
        isEq(an, a, b) ? `<span class="tag tag--eq">Stable</span>` : "",
        isJointMax(an, a, b) ? `<span class="tag">Best together</span>` : "",
      ].join("");
      box.insertAdjacentHTML("beforeend", `
        <button class="cell${isEq(an, a, b) ? " is-eq" : ""}" data-a="${a}" data-b="${b}">
          <span class="cell__pay"><span class="pa${brA ? " br" : ""}">A ${rs(ua)}</span><br><span class="pb${brB ? " br" : ""}">B ${rs(ub)}</span></span>
          <span class="cell__tags">${tags}</span>
        </button>`);
    }
  }
  const explain = (a, b) => {
    const devs = deviations(an.matrix, [a, b]);
    const moves = devs.filter((d) => d.gain > 1e-6);
    const d0 = describe(p, [a, b]);
    const head = `<strong>${d0[0].toUpperCase()}${d0.slice(1)}.</strong> `;
    $("#matrix-explain").innerHTML = head + (moves.length
      ? moves.map((d) => `Station ${d.player} would switch to ₹${num(priceOf(p, d.to))} and gain ${rs(d.gain)}.`).join(" ")
      : `Neither station gains by switching alone, so this is where the game settles.`);
    box.querySelectorAll(".cell").forEach((c) => c.classList.toggle("is-active", c.dataset.a === a && c.dataset.b === b));
  };
  box.querySelectorAll(".cell").forEach((c) => {
    const go = () => explain(c.dataset.a, c.dataset.b);
    c.addEventListener("mouseenter", go);
    c.addEventListener("focus", go);
    c.addEventListener("click", go);
  });
  explain(HIGH, HIGH);

  const eq = an.equilibria[0];
  const gap = an.joint[`${HIGH}|${HIGH}`] - an.joint[`${eq[0]}|${eq[1]}`];
  $("#bento-eq").textContent = `Both charge ₹${num(BASELINE.lowPrice)}`;
  $("#bento-eq-text").textContent = `Cutting is the better move whatever the rival does, so each earns ${rs(an.at(...eq)[0])} a day.`;
  $("#bento-gap").textContent = rs(gap);
  $("#bento-gap-text").textContent = "Together they would earn more at ₹12, but neither can trust the other to hold.";
  const best = an.joint[`${HIGH}|${HIGH}`];
  $("#bento-bars").innerHTML = [
    ["Both ₹12", best, ""], ["Both ₹10", an.joint[`${LOW}|${LOW}`], " minibar__fill--muted"],
  ].map(([l, v, cls]) => `<div class="minibar"><span>${l} · ${rs(v)}</span><span class="minibar__fill${cls}" style="width:${(v / best) * 100}%"></span></div>`).join("");
  $("#bento-q").textContent = pct(BASELINE.cheapShare);
}

/* ---------------------------------------------------------------- scrub text */
function renderScrub() {
  const an = analyze(BASELINE);
  const lo = num(BASELINE.lowPrice), hi = num(BASELINE.highPrice);
  const text =
    `If your rival charges ₹${hi}, cutting to ₹${lo} earns you ${rs(an.at(LOW, HIGH)[0])} instead of ${rs(an.at(HIGH, HIGH)[0])}. ` +
    `If your rival charges ₹${lo}, matching earns ${rs(an.at(LOW, LOW)[0])} instead of ${rs(an.at(HIGH, LOW)[0])}. ` +
    `Whatever the rival does, cutting wins. So both cut, and both earn less than if they had trusted each other.`;
  $("#scrub").innerHTML = text.split(" ").map((w) => `<span class="w${/₹/.test(w) ? " hl" : ""}">${w}</span>`).join(" ");
}

/* ---------------------------------------------------------------- steps */
function renderSteps() {
  const p = BASELINE, an = analyze(p);
  const o = an.outcome(LOW, HIGH);
  const ea = Math.round(o.a.energy), eb = Math.round(o.b.energy);  // 1000 * 0.2 is 199.999... in floats
  const steps = [
    ["Both pick a price", "Each station chooses ₹10 or ₹12 per kWh at the same moment, without seeing the other.",
      `<span class="pa">A: ₹10 or ₹12</span><span class="pb">B: ₹10 or ₹12</span>`],
    ["Drivers follow the cheaper charger", "Equal prices split the 1,000 kWh evenly. Otherwise the cheaper station takes 80% of it.",
      `<span>Equal: 500 / 500</span><span>Different: ${ea} / ${eb}</span>`],
    ["Profit is margin times energy", "Each kWh costs ₹6 to supply, so ₹10 leaves ₹4 and ₹12 leaves ₹6 per kWh.",
      `<span class="pa">(10 − 6) × ${ea} = ${rs(o.a.profit)}</span>`],
    ["Each looks for its best reply", "Against ₹12 the best reply is ₹10. Against ₹10 the best reply is also ₹10.",
      `<span>${rs(an.at(LOW, HIGH)[0])} beats ${rs(an.at(HIGH, HIGH)[0])}</span><span>${rs(an.at(LOW, LOW)[0])} beats ${rs(an.at(HIGH, LOW)[0])}</span>`],
    ["Nobody wants to move", "At ₹10 each, switching alone to ₹12 would drop profit, so both stay. That is the Nash equilibrium.",
      `<span class="pa">A ${rs(an.at(LOW, LOW)[0])}</span><span class="pb">B ${rs(an.at(LOW, LOW)[1])}</span>`],
  ];
  $("#steps").innerHTML = steps.map(([h, t, v]) =>
    `<li class="step"><div><h3>${h}</h3><p>${t}</p></div><div class="step__visual">${v}</div></li>`).join("");
}

/* ---------------------------------------------------------------- play */
function renderSeg(player) {
  const seg = document.querySelector(`.seg[data-player="${player}"]`);
  const chosen = state[player];
  seg.innerHTML = STRATEGIES.map((s) =>
    `<button role="radio" aria-checked="${s === chosen}" data-s="${s}">₹${num(priceOf(state.params, s))} · ${s === LOW ? "cut" : "hold"}</button>`).join("");
  seg.querySelectorAll("button").forEach((btn) => btn.addEventListener("click", () => {
    state[player] = btn.dataset.s;
    renderPlay();
  }));
}

function renderStats(el, r) {
  if (!el.children.length) {
    el.innerHTML = [["Price", "price"], ["Share", "share"], ["Energy", "energy"], ["Revenue", "revenue"],
      ["Cost", "variableCost"], ["Profit", "profit"]]
      .map(([l, k]) => `<div class="${k === "profit" ? "profit" : ""}"><dt>${l}</dt><dd data-k="${k}"></dd></div>`).join("");
  }
  const fmts = { price: (v) => `₹${num(Math.round(v * 2) / 2)}`, share: pct, energy: (v) => `${Math.round(v)} kWh`,
    revenue: rs, variableCost: rs, profit: rs };
  el.querySelectorAll("dd").forEach((dd) => setNumber(dd, r[dd.dataset.k], fmts[dd.dataset.k]));
}

function renderPlay() {
  const an = analyze(state.params);
  const p = state.params;
  renderSeg("a"); renderSeg("b");
  const o = an.outcome(state.a, state.b);
  renderStats($("#stats-a"), o.a);
  renderStats($("#stats-b"), o.b);

  const dur = reduceMotion ? 0 : 0.8;
  gsap.to("#bar-a", { width: `${o.a.share * 100}%`, duration: dur, ease: "power3.inOut" });
  gsap.to("#bar-b", { width: `${o.b.share * 100}%`, duration: dur, ease: "power3.inOut" });
  $("#bar-legend").innerHTML = `<span>A ${Math.round(o.a.energy)} kWh</span><span>B ${Math.round(o.b.energy)} kWh</span>`;

  const stable = isEq(an, state.a, state.b);
  const v = $("#verdict");
  v.className = `verdict ${stable ? "good" : "bad"}`;
  v.textContent = stable
    ? "Stable. Neither station gains by switching alone."
    : "Unstable. Someone has a reason to switch.";
  $("#devs").innerHTML = deviations(an.matrix, [state.a, state.b]).map((d) => {
    const word = d.gain > 1e-6 ? `gains ${rs(d.gain)}` : d.gain < -1e-6 ? `loses ${rs(-d.gain)}` : "gains nothing";
    return `<li>If <b>Station ${d.player}</b> switches to ₹${num(priceOf(p, d.to))}: ${rs(d.now)} → ${rs(d.next)}, it <b>${word}</b>.</li>`;
  }).join("");
  if (!reduceMotion) gsap.fromTo("#devs li", { y: 10, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.06, duration: 0.5, ease: "power2.out" });

  renderSummary(an);
  renderLab(an);
}

function renderSummary(an) {
  const p = an.params;
  const parts = [eqSentence(an)];
  parts.push(an.pd.holds ? "It is a prisoner's dilemma." : "It is not a prisoner's dilemma.");
  if (an.mixed.exists) {
    const [ua] = expectedPayoffs(an.matrix, an.mixed.p, an.mixed.q);
    parts.push(`There is also a mixed equilibrium: each cuts with probability ${an.mixed.p.toFixed(2)} and expects ${rs(ua)}.`);
  }
  $("#tweak-summary").textContent = parts.join(" ");
  $("#tweak-now").textContent =
    `₹${num(p.lowPrice)} / ₹${num(p.highPrice)} · cost ₹${num(p.costA)} / ₹${num(p.costB)} · q ${p.cheapShare.toFixed(2)}`;
}

/* ---------------------------------------------------------------- market controls */
const FIELDS = {
  lowPrice: (v) => `₹${num(v)}`, highPrice: (v) => `₹${num(v)}`, costA: (v) => `₹${num(v)}`,
  costB: (v) => `₹${num(v)}`, cheapShare: pct, demand: (v) => `${v.toLocaleString("en-IN")} kWh`,
};

function syncControls() {
  for (const [k, fmt] of Object.entries(FIELDS)) {
    $(`#${k}`).value = state.params[k];
    $(`#o-${k}`).textContent = fmt(state.params[k]);
  }
  $("#q2").value = state.params.cheapShare;
  $("#o-q2").textContent = pct(state.params.cheapShare);
}

function applyCandidate(candidate) {
  const errors = validationErrors(candidate);
  $("#tweak-error").textContent = errors.length ? `${errors.join(" ")} Using the last valid values.` : "";
  if (!errors.length) state.params = candidate;
  for (const [k, fmt] of Object.entries(FIELDS)) $(`#o-${k}`).textContent = fmt(candidate[k]);
  renderPlay();
  renderChart();
}

function bindControls() {
  for (const k of Object.keys(FIELDS)) {
    $(`#${k}`).addEventListener("input", () => {
      const candidate = { ...state.params };
      for (const f of Object.keys(FIELDS)) candidate[f] = Number($(`#${f}`).value);
      applyCandidate(candidate);
      $("#q2").value = candidate.cheapShare;
      $("#o-q2").textContent = pct(candidate.cheapShare);
    });
  }
  $("#q2").addEventListener("input", (e) => {
    $("#cheapShare").value = e.target.value;
    $("#o-q2").textContent = pct(Number(e.target.value));
    applyCandidate({ ...state.params, cheapShare: Number(e.target.value) });
  });
  $("#reset").addEventListener("click", () => {
    state.params = { ...BASELINE };
    $("#tweak-error").textContent = "";
    syncControls();
    renderPlay();
    renderChart();
  });
}

/* ---------------------------------------------------------------- sensitivity chart */
const REGION = {
  "Low|Low": ["Both cut to the low price", "rgba(94,196,201,0.12)"],
  "High|High": ["Both hold the high price", "rgba(226,170,92,0.13)"],
  multi: ["Either outcome can stick", "rgba(255,255,255,0.05)"],
  none: ["No stable outcome", "rgba(239,157,143,0.10)"],
};

function regionKey(eq) {
  if (eq.length > 1) return "multi";
  if (!eq.length) return "none";
  return eq[0].join("|") in REGION ? eq[0].join("|") : "multi";
}

function niceStep(raw) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw);
}

function renderChart() {
  const svg = $("#chart");
  const p = state.params;
  const W = 800, H = 380, L = 64, R = 20, T = 34, B = 48;
  const qs = Array.from({ length: 101 }, (_, i) => 0.5 + i * 0.005);
  const rows = qs.map((q) => {
    const an = analyze({ ...p, cheapShare: q });
    return { q, vsLow: an.at(LOW, LOW)[0] - an.at(HIGH, LOW)[0], vsHigh: an.at(LOW, HIGH)[0] - an.at(HIGH, HIGH)[0], key: regionKey(an.equilibria) };
  });
  const ys = rows.flatMap((r) => [r.vsLow, r.vsHigh]).concat(0);
  let yMin = Math.min(...ys), yMax = Math.max(...ys);
  const padY = (yMax - yMin) * 0.12 || 100;
  yMin -= padY; yMax += padY;
  const x = (q) => L + ((q - 0.5) / 0.5) * (W - L - R);
  const y = (v) => T + (1 - (v - yMin) / (yMax - yMin)) * (H - T - B);

  let out = "";
  // Equilibrium regions, from the solver at every q.
  let start = 0;
  for (let i = 1; i <= rows.length; i++) {
    if (i === rows.length || rows[i].key !== rows[start].key) {
      const x0 = x(rows[start].q), x1 = x(rows[i - 1].q);
      const [label, fill] = REGION[rows[start].key];
      out += `<rect x="${x0}" y="${T}" width="${Math.max(x1 - x0, 1)}" height="${H - T - B}" fill="${fill}"/>`;
      if (x1 - x0 > 150) out += `<text class="lbl" x="${x0 + 10}" y="${T + 18}">${label}</text>`;
      else if (x1 - x0 > 50) out += `<text class="lbl" x="${(x0 + x1) / 2}" y="${T + 18}" text-anchor="middle">Either</text>`;
      start = i;
    }
  }
  // Grid and axes.
  const step = niceStep((yMax - yMin) / 4);
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) {
    out += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${Math.abs(v) < 1e-9 ? 0.3 : 0.06})"/>`;
    out += `<text x="${L - 10}" y="${y(v) + 4}" text-anchor="end">${Math.abs(v) < 1e-9 ? "0" : rs(v)}</text>`;
  }
  for (let q = 0.5; q <= 1.0001; q += 0.1) out += `<text x="${x(q)}" y="${H - B + 22}" text-anchor="middle">${Math.round(q * 100)}%</text>`;
  out += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Share of drivers won by the cheaper station</text>`;
  // Lines.
  const path = (k) => rows.map((r, i) => `${i ? "L" : "M"}${x(r.q).toFixed(1)},${y(r[k]).toFixed(1)}`).join("");
  out += `<path d="${path("vsLow")}" fill="none" stroke="#5ec4c9" stroke-width="3"/>`;
  out += `<path d="${path("vsHigh")}" fill="none" stroke="#e6eaee" stroke-width="2.5" stroke-dasharray="7 6"/>`;
  out += `<text x="${W - R}" y="${y(rows.at(-1).vsLow) - 10}" text-anchor="end" fill="#5ec4c9">rival cuts</text>`;
  out += `<text x="${W - R}" y="${y(rows.at(-1).vsHigh) + 28}" text-anchor="end" fill="#e6eaee">rival holds</text>`;
  // Current q marker.
  const cur = analyze(p);
  const gl = cur.at(LOW, LOW)[0] - cur.at(HIGH, LOW)[0], gh = cur.at(LOW, HIGH)[0] - cur.at(HIGH, HIGH)[0];
  const cx = x(p.cheapShare);
  out += `<line x1="${cx}" x2="${cx}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,0.45)" stroke-dasharray="3 4"/>`;
  out += `<circle cx="${cx}" cy="${y(gl)}" r="6" fill="#5ec4c9" stroke="#0b0d10" stroke-width="2"/>`;
  out += `<circle cx="${cx}" cy="${y(gh)}" r="6" fill="#e6eaee" stroke="#0b0d10" stroke-width="2"/>`;
  out += `<text x="${L}" y="${T - 14}" class="lbl">Station A's extra profit from cutting the price</text>`;
  svg.innerHTML = out;

  const say = (g) => (g > 1e-6 ? `earns ${rs(g)} more` : g < -1e-6 ? `earns ${rs(-g)} less` : "earns the same");
  let read = `At <strong>${pct(p.cheapShare)}</strong>, cutting ${say(gl)} when the rival cuts and ${say(gh)} when the rival holds. <strong>${eqSentence(cur)}</strong>`;
  if (p.costA === p.costB) {
    const [t1, t2] = qThresholds(p);
    if (t2 <= 1) read += ` Cutting always wins once the share passes ${pct(t2)}; below ${pct(Math.max(t1, 0.5))} both prefer to hold.`;
  }
  $("#chart-read").innerHTML = read;
}

/* ---------------------------------------------------------------- live analysis: arrow matrix + proofs */
const prob = (v) => `${v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;

function renderLab(an) {
  const p = an.params;
  const pr = (s) => `₹${num(priceOf(p, s))}`;
  const box = $("#amx");
  const sel = [state.a, state.b];
  // Grid: [head] [col Low] [B arrows] [col High] across; same shape down for rows and A arrows.
  let html = `<div class="amx__corner">A ↓ &nbsp; B →</div>`;
  html += `<div class="amx__head" style="grid-area:1/2">B ${pr(LOW)}</div><div class="amx__head" style="grid-area:1/4">B ${pr(HIGH)}</div>`;
  html += `<div class="amx__head amx__head--row" style="grid-area:2/1">A ${pr(LOW)}</div><div class="amx__head amx__head--row" style="grid-area:4/1">A ${pr(HIGH)}</div>`;
  STRATEGIES.forEach((a, i) => STRATEGIES.forEach((b, j) => {
    const [ua, ub] = an.at(a, b);
    const eq = isEq(an, a, b), jm = isJointMax(an, a, b), on = sel[0] === a && sel[1] === b;
    const tags = [eq && `<span class="tag tag--eq">Nash equilibrium</span>`, jm && `<span class="tag">Best together</span>`,
      on && `<span class="tag tag--sel">In the game</span>`].filter(Boolean).join("");
    html += `<button class="amx__cell${eq ? " is-eq" : ""}${on ? " is-sel" : ""}" style="grid-area:${2 + i * 2}/${2 + j * 2}"
      data-a="${a}" data-b="${b}" aria-label="A ${pr(a)}, B ${pr(b)}: A earns ${rs(ua)}, B earns ${rs(ub)}${eq ? ", Nash equilibrium" : ""}">
      <span class="amx__pay"><span class="pa">A ${rs(ua)}</span><span class="pb">B ${rs(ub)}</span></span>
      <span class="cell__tags">${tags}</span></button>`;
  }));
  // Station A compares rows within each column; Station B compares columns within each row.
  STRATEGIES.forEach((b, j) => {
    const diff = an.at(LOW, b)[0] - an.at(HIGH, b)[0];
    const body = Math.abs(diff) <= 1e-6 ? `<b>=</b><small>A indifferent</small>`
      : `<b>${diff > 0 ? "▲" : "▼"}</b><small>A +${rs(Math.abs(diff))}</small>`;
    html += `<div class="chip chip--a" style="grid-area:3/${2 + j * 2}">${body}</div>`;
  });
  STRATEGIES.forEach((a, i) => {
    const diff = an.at(a, LOW)[1] - an.at(a, HIGH)[1];
    const body = Math.abs(diff) <= 1e-6 ? `<b>=</b><small>B even</small>`
      : `<b>${diff > 0 ? "◀" : "▶"}</b><small>B +${rs(Math.abs(diff))}</small>`;
    html += `<div class="chip chip--b" style="grid-area:${2 + i * 2}/3">${body}</div>`;
  });
  box.innerHTML = html;
  box.querySelectorAll(".amx__cell").forEach((c) => c.addEventListener("click", () => {
    state.a = c.dataset.a; state.b = c.dataset.b;
    renderPlay();
  }));
  if (!reduceMotion) {
    gsap.fromTo("#amx .chip", { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.05, ease: "back.out(2)" });
  }
  renderProofs(an, pr);
}

function renderProofs(an, pr) {
  const vs = (x, y) => `${rs(x)} vs ${rs(y)}`;
  const brLine = (who, other, s) => {
    const best = who === "A" ? an.brA[s] : an.brB[s];
    const [lo, hi] = who === "A" ? [an.at(LOW, s)[0], an.at(HIGH, s)[0]] : [an.at(s, LOW)[1], an.at(s, HIGH)[1]];
    const pick = best.length > 1 ? "either price" : pr(best[0]);
    return `<li>If ${other} charges ${pr(s)}, ${who}'s best is <b>${pick}</b> <span class="muted">(${vs(lo, hi)})</span></li>`;
  };
  const dom = (who, [s, kind]) => kind === "none"
    ? `<li>${who} has <b>no dominant price</b>: its best move depends on the rival.</li>`
    : `<li><b>${pr(s)}</b> is ${kind}ly dominant for ${who}: best whatever the rival does.</li>`;
  const chain = (x) => {
    const gt = (u, v) => (u > v + 1e-6 ? `<span class="ok">&gt;</span>` : `<span class="no">≤</span>`);
    return `T ${rs(x.T)} ${gt(x.T, x.R)} R ${rs(x.R)} ${gt(x.R, x.P)} P ${rs(x.P)} ${gt(x.P, x.S)} S ${rs(x.S)}`;
  };
  const prof = STRATEGIES.flatMap((a) => STRATEGIES.map((b) => [a, b]));
  const top = Math.max(...prof.map(([a, b]) => an.joint[`${a}|${b}`]));
  const bars = prof.map(([a, b]) => {
    const v = an.joint[`${a}|${b}`];
    const mark = `${isEq(an, a, b) ? " · Nash" : ""}${isJointMax(an, a, b) ? " · best" : ""}`;
    return `<div class="jbar"><span>${pr(a)} / ${pr(b)}${mark}</span><span class="jbar__track"><span class="jbar__fill${isJointMax(an, a, b) ? " is-max" : ""}" style="width:${Math.max(v / top, 0) * 100}%"></span></span><b>${rs(v)}</b></div>`;
  }).join("");
  const m = an.mixed;
  let mixed;
  if (m.exists) {
    const [ua, ub] = expectedPayoffs(an.matrix, m.p, m.q);
    mixed = `A cuts with probability <b>${prob(m.p)}</b>, B with <b>${prob(m.q)}</b>. Expected profit: A ${rs(ua)}, B ${rs(ub)}.`;
  } else if (m.p === null) {
    mixed = "None. One station is indifferent whatever the rival does, so there is no single mix.";
  } else {
    mixed = `None. The indifference formula gives q* = ${prob(m.q)} and p* = ${prob(m.p)}, which are not both strictly between 0 and 1, so pure strategies settle the game.`;
  }

  $("#proofs").innerHTML = `
    <article class="proof"><h3>Best responses</h3><ul>
      ${brLine("A", "B", LOW)}${brLine("A", "B", HIGH)}${brLine("B", "A", LOW)}${brLine("B", "A", HIGH)}</ul></article>
    <article class="proof"><h3>Dominant strategy</h3><ul>${dom("A", an.dominantA)}${dom("B", an.dominantB)}</ul></article>
    <article class="proof"><h3>Prisoner's dilemma test <span class="pill ${an.pd.holds ? "pill--yes" : "pill--no"}">${an.pd.holds ? "Yes" : "No"}</span></h3>
      <p class="mono chain">A: ${chain(an.pd.a)}</p><p class="mono chain">B: ${chain(an.pd.b)}</p>
      <p class="muted small">T: undercut a rival at the high price. R: both high. P: both low. S: stay high while undercut.</p></article>
    <article class="proof"><h3>Together vs alone</h3><div class="jbars">${bars}</div></article>
    <article class="proof"><h3>Mixed strategy</h3><p>${mixed}</p></article>`;
  if (!reduceMotion) {
    gsap.fromTo("#proofs .jbar__fill", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out", stagger: 0.06, transformOrigin: "left" });
  }
}

function bindPresent() {
  const btn = $("#present"), lab = $("#lab");
  btn.addEventListener("click", () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else (lab.requestFullscreen || lab.webkitRequestFullscreen).call(lab);
  });
  document.addEventListener("fullscreenchange", () => {
    const on = document.fullscreenElement === lab;
    btn.textContent = on ? "Exit full screen" : "Present full screen";
    btn.setAttribute("aria-pressed", String(on));
  });
}

/* ---------------------------------------------------------------- accordion, faq, team */
function bindAccordion() {
  const slices = [...document.querySelectorAll(".slice")];
  const open = (s) => slices.forEach((x) => x.setAttribute("aria-expanded", String(x === s)));
  slices.forEach((s) => {
    s.addEventListener("mouseenter", () => open(s));
    s.addEventListener("focus", () => open(s));
    s.addEventListener("click", () => open(s));
  });
}

function renderFaq() {
  const an = analyze(BASELINE);
  const pd = an.pd.a;
  const [t1, t2] = qThresholds(BASELINE);
  const items = [
    ["Why use game theory for this?", "Each station's best price depends on the other's price. Game theory is built for decisions that depend on each other; normal profit maximisation treats the rival as fixed."],
    ["What makes ₹10 each the answer?", `Cutting is better whatever the rival does: ${rs(an.at(LOW, LOW)[0])} vs ${rs(an.at(HIGH, LOW)[0])} if the rival cuts, ${rs(an.at(LOW, HIGH)[0])} vs ${rs(an.at(HIGH, HIGH)[0])} if it holds. A move that wins either way is a dominant strategy, so both play it.`],
    ["Why not both charge ₹12?", `They would each make ${rs(an.at(HIGH, HIGH)[0])} instead of ${rs(an.at(LOW, LOW)[0])}, but each could grab ${rs(an.at(LOW, HIGH)[0] - an.at(HIGH, HIGH)[0])} more by undercutting. Without a binding deal, ₹12 does not hold.`],
    ["Is this a prisoner's dilemma?", `Yes. The temptation (${rs(pd.T)}) beats the reward for cooperating (${rs(pd.R)}), which beats mutual cutting (${rs(pd.P)}), which beats being undercut (${rs(pd.S)}).`],
    ["When does the answer change?", `It depends on how many drivers chase the cheaper price. Below ${pct(t1)} both stations hold ₹12. Between ${pct(t1)} and ${pct(t2)} either outcome can stick. Above that, both cut.`],
    ["Are these real prices?", "No. ₹10, ₹12 and ₹6 are illustrative numbers for a teaching model. The model explains incentives; it does not forecast real tariffs."],
  ];
  $("#faq").innerHTML = items.map(([q, a]) => `<details class="reveal"><summary>${q}</summary><p>${a}</p></details>`).join("");
}

function renderTeam() {
  $("#team-list").innerHTML = TEAM.map(([n, id]) => `<li>${n}<span>${id}</span></li>`).join("");
}

/* ---------------------------------------------------------------- motion */
function motion() {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    // Hero entrance: lines rise, then copy and buttons, while the photo settles.
    gsap.timeline({ defaults: { ease: "power4.out" } })
      .from(".hero__title .line > span", { yPercent: 110, duration: 1.2, stagger: 0.12 })
      .from(".hero__sub", { y: 24, opacity: 0, duration: 0.9 }, "-=0.7")
      .from(".hero__ctas > *", { y: 20, opacity: 0, duration: 0.8, stagger: 0.08 }, "-=0.6")
      .from(".nav", { y: -30, opacity: 0, duration: 0.9 }, "<")
      .to(".hero__img", { scale: 1.02, duration: 2.4, ease: "power2.out" }, 0);

    // Photo drifts and darkens as the hero scrolls away.
    gsap.to(".hero__media", { yPercent: 18, opacity: 0.35, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });

    gsap.utils.toArray(".reveal").forEach((el) => {
      gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%", once: true } });
    });

    // The core argument lights up word by word with scroll.
    gsap.to("#scrub .w", { opacity: 1, stagger: 0.05, ease: "none",
      scrollTrigger: { trigger: ".chapter--scrub", start: "top 70%", end: "bottom 60%", scrub: 0.6 } });

    // Image grows in, then fades as it leaves.
    gsap.utils.toArray(".zoom").forEach((el) => {
      gsap.fromTo(el, { scale: 0.82, opacity: 0.6 }, { scale: 1, opacity: 1, ease: "none",
        scrollTrigger: { trigger: el, start: "top bottom", end: "center center", scrub: true } });
      gsap.to(el, { opacity: 0.2, ease: "none", immediateRender: false,
        scrollTrigger: { trigger: el, start: "center 30%", end: "bottom top", scrub: true } });
    });

    gsap.from("#bento-bars .minibar__fill", { scaleX: 0, duration: 1.2, ease: "power3.out", stagger: 0.15,
      scrollTrigger: { trigger: "#bento-bars", start: "top 85%", once: true } });
  });

  // Pinned title on the left while the steps scroll on the right (desktop only).
  mm.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
    ScrollTrigger.create({ trigger: ".split__grid", start: "top 110px", end: () => `bottom ${window.innerHeight * 0.4 + 110}px`,
      pin: ".split__pin", pinSpacing: false });
    gsap.utils.toArray(".step").forEach((step) => {
      gsap.fromTo(step, { opacity: 0.25, scale: 0.96 }, { opacity: 1, scale: 1, ease: "none",
        scrollTrigger: { trigger: step, start: "top 85%", end: "top 45%", scrub: true } });
    });
  });
}

/* ---------------------------------------------------------------- boot */
renderMatrix();
renderScrub();
renderSteps();
renderFaq();
renderTeam();
syncControls();
bindControls();
bindAccordion();
bindPresent();
renderPlay();
renderChart();
motion();
window.addEventListener("load", () => ScrollTrigger.refresh());
