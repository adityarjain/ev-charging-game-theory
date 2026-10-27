// Browser port of game_theory.py. Same formulas, same tie tolerance.
// tests/test_js_parity.py checks this file against the Python model.

export const LOW = "Low";
export const HIGH = "High";
export const STRATEGIES = [LOW, HIGH];
export const TOL = 1e-6;

export const BASELINE = Object.freeze({
  lowPrice: 10, highPrice: 12, demand: 1000, costA: 6, costB: 6, cheapShare: 0.8,
});

export function validationErrors(p) {
  const e = [];
  if (Object.values(p).some((v) => !Number.isFinite(v))) return ["All parameters must be finite numbers."];
  if (p.lowPrice <= 0 || p.highPrice <= 0) e.push("Prices must be positive.");
  if (p.highPrice <= p.lowPrice) e.push("The high price must be greater than the low price.");
  if (p.demand <= 0) e.push("Total market demand must be positive.");
  if (p.costA < 0 || p.costB < 0) e.push("Operating costs cannot be negative.");
  if (p.costA >= p.lowPrice || p.costB >= p.lowPrice) e.push("Operating costs must be below the low price.");
  if (p.cheapShare < 0.5 || p.cheapShare > 1) e.push("The cheaper station's share must be between 0.5 and 1.");
  return e;
}

const price = (p, s) => (s === LOW ? p.lowPrice : p.highPrice);
const close = (a, b) => Math.abs(a - b) <= TOL;
const key = (a, b) => `${a}|${b}`;

export function demandShares(pa, pb, q) {
  const sa = close(pa, pb) ? 0.5 : pa < pb ? q : 1 - q;
  return [sa, 1 - sa];
}

function station(strategy, pr, share, demand, cost) {
  const energy = demand * share;
  const revenue = pr * energy;
  const variableCost = cost * energy;
  return { strategy, price: pr, share, energy, revenue, variableCost, profit: revenue - variableCost };
}

export function outcome(p, sa, sb) {
  const pa = price(p, sa), pb = price(p, sb);
  const [shA, shB] = demandShares(pa, pb, p.cheapShare);
  const a = station(sa, pa, shA, p.demand, p.costA);
  const b = station(sb, pb, shB, p.demand, p.costB);
  return { a, b, joint: a.profit + b.profit };
}

export function payoffMatrix(p) {
  const m = {};
  for (const a of STRATEGIES) for (const b of STRATEGIES) {
    const o = outcome(p, a, b);
    m[key(a, b)] = [o.a.profit, o.b.profit];
  }
  return m;
}

const argmaxAll = (opts) => {
  const best = Math.max(...Object.values(opts));
  return Object.keys(opts).filter((k) => close(opts[k], best));
};

export function bestResponsesA(m) {
  return Object.fromEntries(STRATEGIES.map((b) =>
    [b, argmaxAll(Object.fromEntries(STRATEGIES.map((a) => [a, m[key(a, b)][0]])))]));
}

export function bestResponsesB(m) {
  return Object.fromEntries(STRATEGIES.map((a) =>
    [a, argmaxAll(Object.fromEntries(STRATEGIES.map((b) => [b, m[key(a, b)][1]])))]));
}

export function nashEquilibria(m) {
  const ba = bestResponsesA(m), bb = bestResponsesB(m);
  const out = [];
  for (const a of STRATEGIES) for (const b of STRATEGIES)
    if (ba[b].includes(a) && bb[a].includes(b)) out.push([a, b]);
  return out;
}

export function deviations(m, [a, b]) {
  const other = (s) => (s === LOW ? HIGH : LOW);
  return [
    { player: "A", from: a, to: other(a), now: m[key(a, b)][0], next: m[key(other(a), b)][0] },
    { player: "B", from: b, to: other(b), now: m[key(a, b)][1], next: m[key(a, other(b))][1] },
  ].map((d) => ({ ...d, gain: d.next - d.now }));
}

export function dominantStrategy(m, player) {
  const pay = (s, t) => (player === "A" ? m[key(s, t)][0] : m[key(t, s)][1]);
  const diffs = (s) => STRATEGIES.filter((r) => r !== s).flatMap((r) => STRATEGIES.map((t) => pay(s, t) - pay(r, t)));
  for (const s of STRATEGIES) if (diffs(s).every((d) => d > TOL)) return [s, "strict"];
  for (const s of STRATEGIES) {
    const d = diffs(s);
    if (d.every((x) => x >= -TOL) && d.some((x) => x > TOL)) return [s, "weak"];
  }
  return [null, "none"];
}

export function prisonersDilemma(m) {
  const one = (i, t, r, pu, s) => {
    const T = m[t][i], R = m[r][i], P = m[pu][i], S = m[s][i];
    return { T, R, P, S, holds: T > R + TOL && R > P + TOL && P > S + TOL };
  };
  const a = one(0, key(LOW, HIGH), key(HIGH, HIGH), key(LOW, LOW), key(HIGH, LOW));
  const b = one(1, key(HIGH, LOW), key(HIGH, HIGH), key(LOW, LOW), key(LOW, HIGH));
  return { a, b, holds: a.holds && b.holds };
}

export function mixedEquilibrium(m) {
  const [a, b, c, d] = [key(LOW, LOW), key(LOW, HIGH), key(HIGH, LOW), key(HIGH, HIGH)].map((k) => m[k][0]);
  const [e, f, g, h] = [key(LOW, LOW), key(LOW, HIGH), key(HIGH, LOW), key(HIGH, HIGH)].map((k) => m[k][1]);
  const dq = a - b - c + d, dp = e - f - g + h;
  if (Math.abs(dq) <= TOL || Math.abs(dp) <= TOL) return { exists: false, p: null, q: null };
  const q = (d - b) / dq, p = (h - g) / dp;
  const inside = (x) => x > TOL && x < 1 - TOL;
  return { exists: inside(p) && inside(q), p, q };
}

export function expectedPayoffs(m, p, q) {
  const pa = { [LOW]: p, [HIGH]: 1 - p }, qb = { [LOW]: q, [HIGH]: 1 - q };
  let ua = 0, ub = 0;
  for (const r of STRATEGIES) for (const k of STRATEGIES) {
    ua += pa[r] * qb[k] * m[key(r, k)][0];
    ub += pa[r] * qb[k] * m[key(r, k)][1];
  }
  return [ua, ub];
}

export function analyze(p) {
  const errors = validationErrors(p);
  if (errors.length) throw new Error(errors.join(" "));
  const m = payoffMatrix(p);
  const joint = Object.fromEntries(Object.entries(m).map(([k, [x, y]]) => [k, x + y]));
  const bestJoint = Math.max(...Object.values(joint));
  return {
    params: p,
    matrix: m,
    at: (a, b) => m[key(a, b)],
    outcome: (a, b) => outcome(p, a, b),
    brA: bestResponsesA(m),
    brB: bestResponsesB(m),
    equilibria: nashEquilibria(m),
    dominantA: dominantStrategy(m, "A"),
    dominantB: dominantStrategy(m, "B"),
    joint,
    jointMax: Object.keys(joint).filter((k) => close(joint[k], bestJoint)).map((k) => k.split("|")),
    pd: prisonersDilemma(m),
    mixed: mixedEquilibrium(m),
  };
}

export function qThresholds(p, cost = p.costA) {
  const ml = p.lowPrice - cost, mh = p.highPrice - cost;
  return [1 - ml / (2 * mh), mh / (2 * ml)];
}

export const isEq = (an, a, b) => an.equilibria.some(([x, y]) => x === a && y === b);
export const isJointMax = (an, a, b) => an.jointMax.some(([x, y]) => x === a && y === b);
