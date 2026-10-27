// Reads a JSON array of parameter sets on stdin, prints the JS model's results.
// Used by tests/test_js_parity.py to compare with game_theory.py.
import { analyze, payoffMatrix, STRATEGIES } from "../src/model.js";

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  const out = JSON.parse(input).map((p) => {
    const an = analyze(p);
    const m = payoffMatrix(p);
    return {
      matrix: STRATEGIES.flatMap((a) => STRATEGIES.map((b) => m[`${a}|${b}`])),
      equilibria: an.equilibria,
      dominantA: an.dominantA,
      dominantB: an.dominantB,
      pd: an.pd.holds,
      mixedExists: an.mixed.exists,
      jointMax: an.jointMax,
    };
  });
  process.stdout.write(JSON.stringify(out));
});
