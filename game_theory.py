"""Game-theoretic model of price competition between two EV charging stations.

This module is the single source of truth for every number shown by the app,
report and presentation. It has no Streamlit dependency.

Model (normal-form, simultaneous, non-cooperative, 2 players x 2 strategies):
    Players     : Station A, Station B
    Strategies  : "Low" (price p_L) or "High" (price p_H)
    Demand share: s_A = 0.5 if p_A = p_B, q if p_A < p_B, 1 - q if p_A > p_B
    Energy sold : E_A = D * s_A,  E_B = D * (1 - s_A)
    Profit      : pi_i = (p_i - c_i) * E_i

The equilibrium functions (best responses, Nash, mixed strategies, dominance)
work on any 2-player finite payoff matrix, not just the pricing game.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict

import numpy as np

LOW, HIGH = "Low", "High"
STRATEGIES: tuple[str, str] = (LOW, HIGH)
TOL = 1e-6  # payoffs within this many rupees are treated as equal (ties)

# A payoff matrix maps (strategy of A, strategy of B) -> (payoff A, payoff B).
PayoffMatrix = dict[tuple[str, str], tuple[float, float]]


# --------------------------------------------------------------------------
# Parameters and validation
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class MarketParams:
    """Assumptions of the pricing game. Defaults are the project baseline."""

    low_price: float = 10.0      # Rs per kWh
    high_price: float = 12.0     # Rs per kWh
    demand: float = 1000.0       # total market demand, kWh
    cost_a: float = 6.0          # Station A variable cost, Rs per kWh
    cost_b: float = 6.0          # Station B variable cost, Rs per kWh
    cheap_share: float = 0.8     # q: share won by the cheaper station

    def price(self, strategy: str) -> float:
        if strategy == LOW:
            return self.low_price
        if strategy == HIGH:
            return self.high_price
        raise ValueError(f"Unknown strategy {strategy!r}; use 'Low' or 'High'.")


BASELINE = MarketParams()


def validation_errors(p: MarketParams) -> list[str]:
    """Return human-readable problems with the parameters (empty if valid)."""
    errors = []
    if any(not math.isfinite(v) for v in asdict(p).values()):
        return ["All parameters must be finite numbers."]
    if p.low_price <= 0 or p.high_price <= 0:
        errors.append("Prices must be positive.")
    if p.high_price <= p.low_price:
        errors.append("The high price must be greater than the low price.")
    if p.demand <= 0:
        errors.append("Total market demand must be positive.")
    if p.cost_a < 0 or p.cost_b < 0:
        errors.append("Operating costs cannot be negative.")
    if p.cost_a >= p.low_price or p.cost_b >= p.low_price:
        errors.append(
            "Operating costs must be below the low price, so that every "
            "price earns a positive margin."
        )
    if not 0.5 <= p.cheap_share <= 1.0:
        errors.append(
            "The cheaper station's share q must lie between 0.5 and 1 "
            "(0.5 = price has no effect, 1 = winner takes all)."
        )
    return errors


def validate_params(p: MarketParams) -> MarketParams:
    """Raise ValueError listing every problem; return the params if valid."""
    errors = validation_errors(p)
    if errors:
        raise ValueError(" ".join(errors))
    return p


# --------------------------------------------------------------------------
# Demand, revenue, cost and profit
# --------------------------------------------------------------------------
def demand_shares(price_a: float, price_b: float, q: float) -> tuple[float, float]:
    """Market shares (s_A, s_B). Depends only on which price is lower."""
    if not 0.5 <= q <= 1.0:
        raise ValueError("q must lie in [0.5, 1].")
    if math.isclose(price_a, price_b, abs_tol=TOL):
        share_a = 0.5
    elif price_a < price_b:
        share_a = q
    else:
        share_a = 1.0 - q
    return share_a, 1.0 - share_a


@dataclass(frozen=True)
class StationResult:
    strategy: str
    price: float
    share: float
    energy: float
    revenue: float
    variable_cost: float
    profit: float


@dataclass(frozen=True)
class Outcome:
    """Full accounting for one strategy profile."""

    a: StationResult
    b: StationResult

    @property
    def profile(self) -> tuple[str, str]:
        return self.a.strategy, self.b.strategy

    @property
    def joint_profit(self) -> float:
        return self.a.profit + self.b.profit


def _station(strategy: str, price: float, share: float, demand: float, cost: float) -> StationResult:
    energy = demand * share
    revenue = price * energy
    variable_cost = cost * energy
    return StationResult(strategy, price, share, energy, revenue, variable_cost, revenue - variable_cost)


def compute_outcome(p: MarketParams, strategy_a: str, strategy_b: str) -> Outcome:
    """Prices, shares, energy, revenue, cost and profit for one profile."""
    validate_params(p)
    price_a, price_b = p.price(strategy_a), p.price(strategy_b)
    share_a, share_b = demand_shares(price_a, price_b, p.cheap_share)
    return Outcome(
        _station(strategy_a, price_a, share_a, p.demand, p.cost_a),
        _station(strategy_b, price_b, share_b, p.demand, p.cost_b),
    )


def all_outcomes(p: MarketParams) -> dict[tuple[str, str], Outcome]:
    return {(sa, sb): compute_outcome(p, sa, sb) for sa in STRATEGIES for sb in STRATEGIES}


def payoff_matrix(p: MarketParams) -> PayoffMatrix:
    """(Profit A, Profit B) for every strategy profile, computed from formulas."""
    return {k: (o.a.profit, o.b.profit) for k, o in all_outcomes(p).items()}


# --------------------------------------------------------------------------
# Generic 2-player analysis (works on any finite payoff matrix)
# --------------------------------------------------------------------------
def strategies_of(matrix: PayoffMatrix) -> tuple[list[str], list[str]]:
    rows = list(dict.fromkeys(a for a, _ in matrix))
    cols = list(dict.fromkeys(b for _, b in matrix))
    return rows, cols


def _argmax_all(options: dict[str, float]) -> list[str]:
    best = max(options.values())
    return [s for s, v in options.items() if math.isclose(v, best, abs_tol=TOL)]


def best_responses_a(matrix: PayoffMatrix) -> dict[str, list[str]]:
    """For each strategy of B, every strategy of A that maximises A's payoff."""
    rows, cols = strategies_of(matrix)
    return {b: _argmax_all({a: matrix[(a, b)][0] for a in rows}) for b in cols}


def best_responses_b(matrix: PayoffMatrix) -> dict[str, list[str]]:
    """For each strategy of A, every strategy of B that maximises B's payoff."""
    rows, cols = strategies_of(matrix)
    return {a: _argmax_all({b: matrix[(a, b)][1] for b in cols}) for a in rows}


def pure_nash_equilibria(matrix: PayoffMatrix) -> list[tuple[str, str]]:
    """Every profile where both players are simultaneously best-responding."""
    br_a, br_b = best_responses_a(matrix), best_responses_b(matrix)
    return [(a, b) for (a, b) in matrix if a in br_a[b] and b in br_b[a]]


@dataclass(frozen=True)
class Deviation:
    player: str           # "A" or "B"
    from_strategy: str
    to_strategy: str
    current_payoff: float
    new_payoff: float

    @property
    def gain(self) -> float:
        return self.new_payoff - self.current_payoff


def unilateral_deviations(matrix: PayoffMatrix, profile: tuple[str, str]) -> list[Deviation]:
    """Every single-player switch from `profile`, profitable or not."""
    rows, cols = strategies_of(matrix)
    a, b = profile
    devs = [Deviation("A", a, a2, matrix[profile][0], matrix[(a2, b)][0]) for a2 in rows if a2 != a]
    devs += [Deviation("B", b, b2, matrix[profile][1], matrix[(a, b2)][1]) for b2 in cols if b2 != b]
    return devs


def profitable_deviations(matrix: PayoffMatrix, profile: tuple[str, str]) -> list[Deviation]:
    return [d for d in unilateral_deviations(matrix, profile) if d.gain > TOL]


def dominant_strategy(matrix: PayoffMatrix, player: str) -> tuple[str | None, str]:
    """(strategy, kind) with kind 'strict', 'weak' or 'none' for player 'A' or 'B'."""
    rows, cols = strategies_of(matrix)
    own, other = (rows, cols) if player == "A" else (cols, rows)

    def pay(s: str, t: str) -> float:
        return matrix[(s, t)][0] if player == "A" else matrix[(t, s)][1]

    def diffs(s: str) -> list[float]:
        return [pay(s, t) - pay(r, t) for r in own if r != s for t in other]

    for s in own:
        if all(d > TOL for d in diffs(s)):
            return s, "strict"
    for s in own:
        if all(d >= -TOL for d in diffs(s)) and any(d > TOL for d in diffs(s)):
            return s, "weak"
    return None, "none"


def joint_profits(matrix: PayoffMatrix) -> dict[tuple[str, str], float]:
    return {k: a + b for k, (a, b) in matrix.items()}


def joint_profit_maximizers(matrix: PayoffMatrix) -> list[tuple[str, str]]:
    totals = joint_profits(matrix)
    best = max(totals.values())
    return [k for k, v in totals.items() if math.isclose(v, best, abs_tol=TOL)]


# --------------------------------------------------------------------------
# Prisoner's Dilemma check (pricing game: cooperate = High, defect = Low)
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class PDPayoffs:
    temptation: float   # undercut a rival who charges High
    reward: float       # both charge High
    punishment: float   # both charge Low
    sucker: float       # charge High while the rival undercuts

    @property
    def ordering_holds(self) -> bool:
        return (self.temptation > self.reward + TOL
                and self.reward > self.punishment + TOL
                and self.punishment > self.sucker + TOL)

    @property
    def cooperation_efficient(self) -> bool:
        """2R > T + S: mutual cooperation beats taking turns exploiting."""
        return 2 * self.reward > self.temptation + self.sucker + TOL


@dataclass(frozen=True)
class PDResult:
    a: PDPayoffs
    b: PDPayoffs

    @property
    def is_prisoners_dilemma(self) -> bool:
        return self.a.ordering_holds and self.b.ordering_holds


def prisoners_dilemma(matrix: PayoffMatrix, cooperate: str = HIGH, defect: str = LOW) -> PDResult:
    c, d = cooperate, defect
    pa = PDPayoffs(matrix[(d, c)][0], matrix[(c, c)][0], matrix[(d, d)][0], matrix[(c, d)][0])
    pb = PDPayoffs(matrix[(c, d)][1], matrix[(c, c)][1], matrix[(d, d)][1], matrix[(d, c)][1])
    return PDResult(pa, pb)


# --------------------------------------------------------------------------
# Mixed strategies (2x2 games)
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class MixedResult:
    exists: bool
    p_a_first: float | None   # probability A plays its first strategy
    q_b_first: float | None   # probability B plays its first strategy
    reason: str


def mixed_equilibrium_2x2(matrix: PayoffMatrix) -> MixedResult:
    """Fully mixed (interior) Nash equilibrium of a 2x2 game, if one exists.

    With A's payoffs a, b, c, d in row-major order, B mixes so that A is
    indifferent:  q* = (d - b) / (a - b - c + d). Symmetrically for A using
    B's payoffs e, f, g, h:  p* = (h - g) / (e - f - g + h).
    """
    rows, cols = strategies_of(matrix)
    if len(rows) != 2 or len(cols) != 2:
        raise ValueError("Mixed-strategy formula applies to 2x2 games only.")
    (r1, r2), (c1, c2) = rows, cols
    a, b, c, d = (matrix[(r, k)][0] for r in (r1, r2) for k in (c1, c2))
    e, f, g, h = (matrix[(r, k)][1] for r in (r1, r2) for k in (c1, c2))

    den_q, den_p = a - b - c + d, e - f - g + h
    if abs(den_q) <= TOL or abs(den_p) <= TOL:
        return MixedResult(False, None, None,
                           "A denominator is zero: one player's payoff gap does not depend on "
                           "the rival's mix, so no unique interior mixed equilibrium exists.")
    q = (d - b) / den_q
    p = (h - g) / den_p
    if TOL < q < 1 - TOL and TOL < p < 1 - TOL:
        return MixedResult(True, p, q, "Both indifference probabilities lie strictly between 0 and 1.")
    return MixedResult(False, p, q,
                       "The indifference probabilities do not lie strictly between 0 and 1, so "
                       "no interior mixed equilibrium exists; the game is solved by pure strategies.")


def expected_payoffs(matrix: PayoffMatrix, p_a_first: float, q_b_first: float) -> tuple[float, float]:
    """Expected (payoff A, payoff B) when each player mixes independently."""
    rows, cols = strategies_of(matrix)
    pa = dict(zip(rows, (p_a_first, 1 - p_a_first)))
    qb = dict(zip(cols, (q_b_first, 1 - q_b_first)))
    ua = sum(pa[r] * qb[k] * matrix[(r, k)][0] for r in rows for k in cols)
    ub = sum(pa[r] * qb[k] * matrix[(r, k)][1] for r in rows for k in cols)
    return ua, ub


# --------------------------------------------------------------------------
# Bundled analysis and sensitivity
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class Analysis:
    params: MarketParams
    outcomes: dict[tuple[str, str], Outcome]
    matrix: PayoffMatrix
    br_a: dict[str, list[str]]
    br_b: dict[str, list[str]]
    equilibria: list[tuple[str, str]]
    dominant_a: tuple[str | None, str]
    dominant_b: tuple[str | None, str]
    joint: dict[tuple[str, str], float]
    joint_max: list[tuple[str, str]]
    pd: PDResult
    mixed: MixedResult


def analyze(p: MarketParams) -> Analysis:
    validate_params(p)
    matrix = payoff_matrix(p)
    return Analysis(
        params=p,
        outcomes=all_outcomes(p),
        matrix=matrix,
        br_a=best_responses_a(matrix),
        br_b=best_responses_b(matrix),
        equilibria=pure_nash_equilibria(matrix),
        dominant_a=dominant_strategy(matrix, "A"),
        dominant_b=dominant_strategy(matrix, "B"),
        joint=joint_profits(matrix),
        joint_max=joint_profit_maximizers(matrix),
        pd=prisoners_dilemma(matrix),
        mixed=mixed_equilibrium_2x2(matrix),
    )


def profile_label(profile: tuple[str, str]) -> str:
    return f"{profile[0]} / {profile[1]}"


def equilibrium_label(equilibria: list[tuple[str, str]]) -> str:
    if not equilibria:
        return "No pure NE"
    return " & ".join(f"({a}, {b})" for a, b in equilibria)


def with_changes(p: MarketParams, **changes: float) -> MarketParams:
    return MarketParams(**{**asdict(p), **changes})


def sensitivity_q(p: MarketParams, q_values) -> list[dict]:
    """Re-solve the whole game for every q. Returns one row per q value."""
    rows = []
    for q in q_values:
        an = analyze(with_changes(p, cheap_share=float(q)))
        row = {"q": float(q), "equilibria": equilibrium_label(an.equilibria),
               "n_equilibria": len(an.equilibria),
               "joint_max": " & ".join(profile_label(k) for k in an.joint_max),
               "prisoners_dilemma": an.pd.is_prisoners_dilemma}
        for k, (ua, ub) in an.matrix.items():
            row[f"A {profile_label(k)}"] = ua
            row[f"B {profile_label(k)}"] = ub
        rows.append(row)
    return rows


EQ_CODES = {0: "(Low, Low) only", 1: "(High, High) only", 2: "Multiple pure NE",
            3: "No pure NE", 4: "Other single NE"}


def classify_equilibria(eq: list[tuple[str, str]]) -> int:
    if eq == [(LOW, LOW)]:
        return 0
    if eq == [(HIGH, HIGH)]:
        return 1
    if len(eq) > 1:
        return 2
    if not eq:
        return 3
    return 4


GRID_PARAMS = {"cost": "Operating cost (both stations), Rs/kWh",
               "high_price": "High price, Rs/kWh"}


def sensitivity_grid(p: MarketParams, q_values, values, param: str = "cost") -> np.ndarray:
    """Equilibrium class (see EQ_CODES) on a grid: rows = `param` values, cols = q.

    param="cost" sets both stations' cost; param="high_price" varies the high price.
    Invalid combinations (e.g. cost >= low price) are marked -1.
    """
    codes = np.full((len(values), len(q_values)), -1, dtype=int)
    for i, v in enumerate(values):
        changes = {"cost_a": float(v), "cost_b": float(v)} if param == "cost" else {param: float(v)}
        for j, q in enumerate(q_values):
            params = with_changes(p, cheap_share=float(q), **changes)
            if not validation_errors(params):
                codes[i, j] = classify_equilibria(pure_nash_equilibria(payoff_matrix(params)))
    return codes


def q_thresholds(p: MarketParams, cost: float | None = None) -> tuple[float, float]:
    """Thresholds on q for a station with the given cost (default cost_a).

    Low is the best reply to Low  iff  q > 1 - (p_L - c) / (2 (p_H - c)).
    Low is the best reply to High iff  q > (p_H - c) / (2 (p_L - c)).
    """
    c = p.cost_a if cost is None else cost
    ml, mh = p.low_price - c, p.high_price - c
    return 1 - ml / (2 * mh), mh / (2 * ml)


if __name__ == "__main__":
    an = analyze(BASELINE)
    for k, v in an.matrix.items():
        print(profile_label(k), v, "joint", an.joint[k])
    print("Nash:", an.equilibria, "| joint max:", an.joint_max)
    print("Dominant:", an.dominant_a, an.dominant_b, "| PD:", an.pd.is_prisoners_dilemma)
    print("Mixed:", an.mixed)
    print("Thresholds on q:", q_thresholds(BASELINE))
