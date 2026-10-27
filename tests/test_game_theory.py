import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import game_theory as gt  # noqa: E402
from game_theory import BASELINE, HIGH, LOW, MarketParams, with_changes  # noqa: E402

approx = pytest.approx


# ---------------------------------------------------------------- baseline
@pytest.mark.parametrize("profile, expected", [
    ((LOW, LOW), (2000, 2000)),
    ((LOW, HIGH), (3200, 1200)),
    ((HIGH, LOW), (1200, 3200)),
    ((HIGH, HIGH), (3000, 3000)),
])
def test_baseline_payoffs(profile, expected):
    assert gt.payoff_matrix(BASELINE)[profile] == approx(expected)


def test_baseline_low_high_accounting():
    o = gt.compute_outcome(BASELINE, LOW, HIGH)
    assert (o.a.energy, o.b.energy) == approx((800, 200))
    assert (o.a.revenue, o.b.revenue) == approx((8000, 2400))
    assert (o.a.variable_cost, o.b.variable_cost) == approx((4800, 1200))
    assert o.joint_profit == approx(4400)


# ---------------------------------------------------------------- demand
def test_equal_prices_split_evenly():
    assert gt.demand_shares(10, 10, 0.8) == approx((0.5, 0.5))


def test_cheaper_a_gets_q_and_dearer_a_gets_1_minus_q():
    assert gt.demand_shares(10, 12, 0.8) == approx((0.8, 0.2))
    assert gt.demand_shares(12, 10, 0.8) == approx((0.2, 0.8))


@pytest.mark.parametrize("q", [0.5, 0.6, 0.75, 0.9, 1.0])
def test_shares_and_energy_sum_to_total(q):
    p = with_changes(BASELINE, cheap_share=q, demand=1234)
    for o in gt.all_outcomes(p).values():
        assert o.a.share + o.b.share == approx(1)
        assert o.a.energy + o.b.energy == approx(1234)


# ---------------------------------------------------------------- profit
def test_revenue_cost_profit_identity():
    p = MarketParams(low_price=9, high_price=15, demand=500, cost_a=3, cost_b=5, cheap_share=0.7)
    o = gt.compute_outcome(p, HIGH, LOW)
    # A is dearer: 30% of 500 = 150 kWh at Rs 15, cost Rs 3
    assert o.a.energy == approx(150)
    assert o.a.revenue == approx(150 * 15)
    assert o.a.variable_cost == approx(150 * 3)
    assert o.a.profit == approx(150 * 12)
    # B is cheaper: 350 kWh at Rs 9, cost Rs 5
    assert o.b.profit == approx(350 * 4)


def test_asymmetric_costs():
    p = with_changes(BASELINE, cost_a=4, cost_b=8)
    m = gt.payoff_matrix(p)
    assert m[(LOW, LOW)] == approx((3000, 1000))
    assert m[(HIGH, HIGH)] == approx((4000, 2000))


def test_profit_scales_with_demand():
    m1 = gt.payoff_matrix(BASELINE)
    m2 = gt.payoff_matrix(with_changes(BASELINE, demand=2000))
    for k in m1:
        assert m2[k] == approx(tuple(2 * v for v in m1[k]))


# ---------------------------------------------------------------- best responses / NE
def test_baseline_best_responses():
    m = gt.payoff_matrix(BASELINE)
    assert gt.best_responses_a(m) == {LOW: [LOW], HIGH: [LOW]}
    assert gt.best_responses_b(m) == {LOW: [LOW], HIGH: [LOW]}


def test_baseline_unique_nash_and_dominance():
    an = gt.analyze(BASELINE)
    assert an.equilibria == [(LOW, LOW)]
    assert an.dominant_a == (LOW, "strict") and an.dominant_b == (LOW, "strict")
    assert gt.profitable_deviations(an.matrix, (LOW, LOW)) == []


def test_high_high_not_equilibrium_deviation_identified():
    m = gt.payoff_matrix(BASELINE)
    devs = gt.profitable_deviations(m, (HIGH, HIGH))
    assert {(d.player, d.to_strategy) for d in devs} == {("A", LOW), ("B", LOW)}
    assert all(d.gain == approx(200) for d in devs)


def test_coordination_region_has_two_equilibria():
    # 2/3 < q < 3/4 at baseline prices/costs
    an = gt.analyze(with_changes(BASELINE, cheap_share=0.7))
    assert sorted(an.equilibria) == [(HIGH, HIGH), (LOW, LOW)]
    assert an.mixed.exists


def test_low_q_makes_high_high_the_equilibrium():
    an = gt.analyze(with_changes(BASELINE, cheap_share=0.6))
    assert an.equilibria == [(HIGH, HIGH)]
    assert not an.pd.is_prisoners_dilemma


def test_ties_are_kept():
    # q = 0.75: vs High, Low gives 4*750 = 3000 = High's 6*500
    m = gt.payoff_matrix(with_changes(BASELINE, cheap_share=0.75))
    assert gt.best_responses_a(m)[HIGH] == [LOW, HIGH]
    assert sorted(gt.pure_nash_equilibria(m)) == [(HIGH, HIGH), (LOW, LOW)]


def test_generic_coordination_game():
    m = {("X", "X"): (2, 2), ("X", "Y"): (0, 0), ("Y", "X"): (0, 0), ("Y", "Y"): (1, 1)}
    assert gt.pure_nash_equilibria(m) == [("X", "X"), ("Y", "Y")]


def test_generic_anti_coordination_game():
    # Chicken / hawk-dove
    m = {("S", "S"): (3, 3), ("S", "T"): (1, 4), ("T", "S"): (4, 1), ("T", "T"): (0, 0)}
    assert sorted(gt.pure_nash_equilibria(m)) == [("S", "T"), ("T", "S")]


def test_matching_pennies_has_no_pure_equilibrium():
    m = {("H", "H"): (1, -1), ("H", "T"): (-1, 1), ("T", "H"): (-1, 1), ("T", "T"): (1, -1)}
    assert gt.pure_nash_equilibria(m) == []
    mixed = gt.mixed_equilibrium_2x2(m)
    assert mixed.exists and mixed.p_a_first == approx(0.5) and mixed.q_b_first == approx(0.5)


def test_asymmetric_costs_can_change_equilibrium():
    # Very low-cost A, high-cost B
    an = gt.analyze(with_changes(BASELINE, cost_a=1, cost_b=9.5, cheap_share=0.7))
    assert an.equilibria != [(LOW, LOW)]


# ---------------------------------------------------------------- mixed strategies
def test_mixed_equilibrium_makes_players_indifferent():
    m = gt.payoff_matrix(with_changes(BASELINE, cheap_share=0.7))
    r = gt.mixed_equilibrium_2x2(m)
    assert r.exists
    # A indifferent between Low and High given B's mix
    u_low, _ = gt.expected_payoffs(m, 1.0, r.q_b_first)
    u_high, _ = gt.expected_payoffs(m, 0.0, r.q_b_first)
    assert u_low == approx(u_high)
    _, v_low = gt.expected_payoffs(m, r.p_a_first, 1.0)
    _, v_high = gt.expected_payoffs(m, r.p_a_first, 0.0)
    assert v_low == approx(v_high)


def test_baseline_has_no_interior_mixed_equilibrium():
    r = gt.analyze(BASELINE).mixed
    assert not r.exists
    assert r.q_b_first == approx(-1 / 3)


def test_degenerate_mixed_case():
    m = {("X", "X"): (1, 1), ("X", "Y"): (1, 1), ("Y", "X"): (1, 1), ("Y", "Y"): (1, 1)}
    assert not gt.mixed_equilibrium_2x2(m).exists


# ---------------------------------------------------------------- joint profit / PD
def test_joint_profit_and_maximiser():
    an = gt.analyze(BASELINE)
    assert an.joint == approx({(LOW, LOW): 4000, (LOW, HIGH): 4400,
                               (HIGH, LOW): 4400, (HIGH, HIGH): 6000})
    assert an.joint_max == [(HIGH, HIGH)]
    assert an.joint_max != an.equilibria


def test_prisoners_dilemma_baseline():
    pd = gt.analyze(BASELINE).pd
    assert (pd.a.temptation, pd.a.reward, pd.a.punishment, pd.a.sucker) == approx((3200, 3000, 2000, 1200))
    assert pd.is_prisoners_dilemma and pd.a.cooperation_efficient


# ---------------------------------------------------------------- dynamic behaviour
def test_changing_q_changes_payoffs():
    m1 = gt.payoff_matrix(BASELINE)
    m2 = gt.payoff_matrix(with_changes(BASELINE, cheap_share=0.9))
    assert m2[(LOW, HIGH)] != approx(m1[(LOW, HIGH)])
    assert m2[(LOW, LOW)] == approx(m1[(LOW, LOW)])  # equal prices unaffected by q


def test_changing_cost_updates_matrix_and_analysis():
    an = gt.analyze(with_changes(BASELINE, cost_a=2, cost_b=2))
    assert an.matrix[(LOW, LOW)] == approx((4000, 4000))
    # margins 8 and 10: Low vs High needs q > 10/16 = 0.625 -> still Low/Low at 0.8
    assert an.equilibria == [(LOW, LOW)]


def test_sensitivity_is_recalculated():
    rows = gt.sensitivity_q(BASELINE, [0.55, 0.7, 0.8, 0.95])
    labels = [r["equilibria"] for r in rows]
    assert labels[0] == "(High, High)"
    assert rows[1]["n_equilibria"] == 2
    assert labels[2] == labels[3] == "(Low, Low)"
    assert rows[3]["A Low / High"] == approx(4 * 950)


def test_q_thresholds_match_solver():
    lo, hi = gt.q_thresholds(BASELINE)
    assert (lo, hi) == approx((2 / 3, 0.75))
    eps = 1e-3
    assert gt.analyze(with_changes(BASELINE, cheap_share=lo - eps)).equilibria == [(HIGH, HIGH)]
    assert gt.analyze(with_changes(BASELINE, cheap_share=hi + eps)).equilibria == [(LOW, LOW)]


def test_sensitivity_grid_codes():
    codes = gt.sensitivity_grid(BASELINE, [0.6, 0.7, 0.9], [6.0])
    assert codes.tolist() == [[1, 2, 0]]
