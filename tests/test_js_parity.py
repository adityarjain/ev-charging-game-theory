"""The website's JS model (web/src/model.js) must agree with game_theory.py."""
import itertools
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import game_theory as gt  # noqa: E402

pytestmark = pytest.mark.skipif(shutil.which("node") is None, reason="node not installed")

GRID = [
    dict(low_price=lo, high_price=hi, demand=1000.0, cost_a=ca, cost_b=cb, cheap_share=q)
    for lo, hi, ca, cb, q in itertools.product(
        [10.0], [12.0, 16.0], [2.0, 6.0, 8.0], [2.0, 6.0, 8.0],
        [0.5, 0.6, 2 / 3, 0.7, 0.75, 0.8, 0.9, 1.0])
] + [dict(low_price=9.0, high_price=15.0, demand=500.0, cost_a=3.0, cost_b=5.0, cheap_share=0.7)]


def to_js(p):
    return {"lowPrice": p["low_price"], "highPrice": p["high_price"], "demand": p["demand"],
            "costA": p["cost_a"], "costB": p["cost_b"], "cheapShare": p["cheap_share"]}


def test_js_model_matches_python():
    out = subprocess.run(["node", str(ROOT / "web" / "scripts" / "parity.mjs")],
                         input=json.dumps([to_js(p) for p in GRID]), capture_output=True,
                         text=True, check=True)
    results = json.loads(out.stdout)
    assert len(results) == len(GRID)
    for p, js in zip(GRID, results):
        an = gt.analyze(gt.MarketParams(**p))
        py_matrix = [v for a in gt.STRATEGIES for b in gt.STRATEGIES for v in an.matrix[(a, b)]]
        assert [v for cell in js["matrix"] for v in cell] == pytest.approx(py_matrix), p
        assert [tuple(e) for e in js["equilibria"]] == an.equilibria, p
        assert tuple(js["dominantA"]) == an.dominant_a, p
        assert tuple(js["dominantB"]) == an.dominant_b, p
        assert js["pd"] == an.pd.is_prisoners_dilemma, p
        assert js["mixedExists"] == an.mixed.exists, p
        assert [tuple(k) for k in js["jointMax"]] == an.joint_max, p
