import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import game_theory as gt  # noqa: E402
from game_theory import BASELINE, HIGH, LOW, with_changes  # noqa: E402


def test_baseline_is_valid():
    assert gt.validation_errors(BASELINE) == []


@pytest.mark.parametrize("changes, fragment", [
    ({"low_price": 0}, "positive"),
    ({"high_price": 9}, "greater than the low price"),
    ({"high_price": 10}, "greater than the low price"),
    ({"demand": 0}, "demand must be positive"),
    ({"cost_a": -1}, "cannot be negative"),
    ({"cost_b": 10}, "below the low price"),
    ({"cheap_share": 0.4}, "between 0.5 and 1"),
    ({"cheap_share": 1.1}, "between 0.5 and 1"),
    ({"demand": float("nan")}, "finite"),
])
def test_invalid_params_raise_clear_errors(changes, fragment):
    p = with_changes(BASELINE, **changes)
    assert any(fragment in e for e in gt.validation_errors(p))
    with pytest.raises(ValueError, match=fragment):
        gt.analyze(p)


def test_unknown_strategy_rejected():
    with pytest.raises(ValueError, match="Unknown strategy"):
        gt.compute_outcome(BASELINE, "Medium", LOW)


def test_boundary_q_half_price_irrelevant():
    # q = 0.5: shares never depend on price, so High is strictly dominant.
    an = gt.analyze(with_changes(BASELINE, cheap_share=0.5))
    assert an.equilibria == [(HIGH, HIGH)]
    assert an.dominant_a == (HIGH, "strict")


def test_boundary_q_one_winner_takes_all():
    an = gt.analyze(with_changes(BASELINE, cheap_share=1.0))
    assert an.matrix[(LOW, HIGH)] == pytest.approx((4000, 0))
    assert an.equilibria == [(LOW, LOW)]
