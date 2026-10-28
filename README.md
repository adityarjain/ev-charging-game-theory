# Game-Theoretic Analysis of EV Charging Station Competition

A Game Theory project (Section C) that models two EV charging stations choosing a price per kWh as a two-player, simultaneous, non-cooperative game. It computes the payoff matrix, best responses, Nash equilibria, joint-profit outcomes, a Prisoner's Dilemma check, mixed strategies and a sensitivity analysis, and presents them in an animated, interactive website (`web/`).

**Team:** Aditya Raj Jain (2427030117), Arnav Khandelwal (2427030196), Pranav Chauhan (2427030220), Khushi Yadav (2427030186)

## Problem statement

Charging at a higher price earns more per kWh, but customers move to the cheaper station. Each station's best price depends on its rival's price. The project asks which prices the stations will choose, and how that compares with the prices that maximise their combined profit.

## Key features

- Mathematical model in `game_theory.py`, the single source of truth. No payoff or equilibrium is hard-coded.
- A general solver that finds every pure Nash equilibrium (unique, multiple or none) and keeps ties.
- Strict and weak dominance, unilateral-deviation diagnostics, joint-profit comparison, and a computed Prisoner's Dilemma test.
- The 2×2 mixed-strategy equilibrium with validity checks.
- Sensitivity analysis over q, plus a two-parameter equilibrium map over cost or high price.
- A single-page website with GSAP scroll animations: an interactive payoff matrix, a simulator where you set both prices and see who wants to switch, market sliders with validation and restore baseline, and a live sensitivity chart.
- The website runs the same model in the browser (`web/src/model.js`), and a parity test checks it against `game_theory.py` on 145 parameter sets.
- 49 automated pytest tests.
- An editable report (`report.docx`, plus `report.pdf`) and a 10-slide editable `presentation.pptx` with speaker notes.

## Game-theory concepts used

Normal-form games, players and strategies, payoff matrices, best responses, strict and weak dominance, pure-strategy Nash equilibrium, joint-profit maximisation, the Prisoner's Dilemma, and mixed-strategy equilibrium via indifference conditions.

## Mathematical model and assumptions

```
s_A = 0.5 if p_A = p_B ;  q if p_A < p_B ;  1 − q if p_A > p_B
E_A = D · s_A          E_B = D · (1 − s_A)
π_i = (p_i − c_i) · E_i
```

| Parameter | Baseline |
|---|---|
| Low / High price | ₹10 / ₹12 per kWh |
| Total demand D | 1,000 kWh |
| Cost c_A = c_B | ₹6 per kWh |
| Share of the cheaper station q | 0.80 |

The model makes these assumptions:

- Total demand is fixed.
- Market share depends only on which price is lower.
- Equal prices split the market 50/50.
- Variable cost is constant, and there are no fixed costs, capacity limits or queues.
- Both stations have complete information.

The values are illustrative, not market data.

## Baseline results

| A \ B | Low | High |
|---|---|---|
| **Low** | (₹2,000, ₹2,000) ← Nash equilibrium | (₹3,200, ₹1,200) |
| **High** | (₹1,200, ₹3,200) | (₹3,000, ₹3,000) ← max joint profit |

- Low is strictly dominant for both stations, so (Low, Low) is the unique pure Nash equilibrium.
- High/High maximises combined profit (₹6,000 vs ₹4,000) but is unstable, because each station gains ₹200 by undercutting.
- T > R > P > S (3,200 > 3,000 > 2,000 > 1,200), so the game is a Prisoner's Dilemma.
- The q thresholds are 2/3 and 3/4. Below 2/3 the outcome is (High, High). Between 2/3 and 3/4 there are two equilibria. Above 3/4 it is (Low, Low).

## Technology stack

- **Website:** HTML, CSS and vanilla JavaScript built with Vite, animated with GSAP and ScrollTrigger, and set in the Geist font (self-hosted).
- **Model, tests and documents:** Python 3, NumPy, Matplotlib, pytest, python-docx and python-pptx.
- **Optional:** pandoc, used to rebuild the report.

## Folder structure

```
ev-charging-game-theory/
├── web/                    # the website
│   ├── index.html          # page structure and copy
│   ├── src/model.js        # browser port of game_theory.py
│   ├── src/main.js         # rendering, interaction, GSAP animation
│   ├── src/style.css       # design
│   └── public/             # photos and report.pdf
├── game_theory.py          # model + analysis (source of truth)
├── team.py                 # project title and team details
├── make_docs.py            # builds report figures + presentation.pptx
├── report.md               # report source
├── report.docx / report.pdf
├── presentation.pptx
├── presentation_outline.md # slide outline + speaker script
├── requirements.txt
├── tests/
│   ├── test_game_theory.py
│   ├── test_validation.py
│   └── test_js_parity.py   # website model == Python model
└── assets/
    ├── figures/            # generated charts used in the report and slides
    └── screenshots/        # website screenshots used in the report and slides
```

## Running the website (macOS)

The website needs Node.js 20 or newer.

```bash
cd ~/Documents/PROJECTS/ev-charging-game-theory/web
```

```bash
npm install
```

```bash
npm run dev
```

It opens at <http://localhost:5173>. Everything runs in the browser, with no Python server, API keys or internet services needed.

To build a static copy you can host anywhere or open offline:

```bash
npm run build
```

The output goes to `web/dist/`.

## Running the tests

```bash
python3 -m venv .venv
```

```bash
source .venv/bin/activate
```

```bash
pip install -r requirements.txt
```

```bash
python -m pytest -v
```

The last run passed all 49 tests (Python 3.14.6, pytest 9.1.1). The JS parity test needs Node and is skipped without it.

## Using the website

1. **Hero:** the question in one line, with buttons to play or see the maths.
2. **The game:** the payoff matrix. Hover a cell to see who would switch and why.
3. **The argument:** a paragraph that lights up as you scroll, showing why cutting always wins.
4. **How it works:** five steps from a price choice to the Nash equilibrium.
5. **Play:** set each station's price, and the site tells you whether either would rather switch alone. Open *Change the market* to move prices, costs, the share q and demand. Invalid values are explained and not applied, and *Restore baseline* resets everything.
6. **What changes it:** drag the share slider to watch the stable outcome flip.
7. **Applications** and **Questions worth asking:** context and likely viva questions.

## Known limitations

- Fixed demand and a simplified 80/20 split.
- Two price levels only.
- No capacity, queues, location or network effects.
- No fixed costs.
- Parameters are illustrative, with no empirical calibration.

The model explains incentives. It does not predict real prices.

## Screenshots

`assets/screenshots/` holds five captures of the website (hero, payoff matrix, game simulator, analysis arrows, sensitivity chart), used in the report and slide 8.

## Updating the report and presentation

1. Edit `team.py` for names and IDs, and `report.md` for the report text and title block.
2. Regenerate the figures and slides:

   ```bash
   python make_docs.py
   ```

3. Rebuild the Word report, which requires pandoc (`brew install pandoc`):

   ```bash
   pandoc report.md -o report.docx --toc --toc-depth=2 --resource-path=.
   ```

4. For a PDF, open `report.docx` in Word and use **File → Save As → PDF**. The included `report.pdf` was rendered from `report.md` through pandoc's HTML output and Chrome.
5. When opening `report.docx`, accept Word's prompt to update fields so the table of contents fills in.
6. Fill in the faculty name and submission date on the title page.

## Optional: put the website online

The build in `web/dist/` is a plain static site. Any static host works, for example Netlify, Vercel or GitHub Pages.

1. Set the project root to `web`.
2. Set the build command to `npm run build`.
3. Set the output folder to `dist`.
