# Presentation outline and speaker script

Source outline for `presentation.pptx`, which `make_docs.py` generates. All numbers come from `game_theory.py` at baseline parameters. The speaker notes are also embedded in the `.pptx`.

Suggested split for 4 speakers: **Aditya** slides 1–3, **Arnav** 4–6, **Pranav** 7–8 (including the live demo), **Khushi** 9–10.

---

## Slide 1: Title and team
- Game-Theoretic Analysis of EV Charging Station Competition
- Game Theory · Section C
- Aditya Raj Jain (2427030117), Arnav Khandelwal (2427030196), Pranav Chauhan (2427030220), Khushi Yadav (2427030186)

**Script:** "We model how two EV charging stations choose prices when each one's profit depends on the other's choice."

## Slide 2: Problem statement
- Two stations share drivers; each sets a price per kWh.
- A higher price earns more per kWh, but drivers go to the cheaper station.
- Margins: Low ₹10 − ₹6 = ₹4; High ₹12 − ₹6 = ₹6. Shares: 50/50 if equal, otherwise 80/20.

**Script:** "Charging High earns ₹6 per kWh instead of ₹4, but if the rival is cheaper you keep only 20% of the market."

## Slide 3: Objectives and scope
- Research question: which prices will they choose, and how does that compare with the joint-profit-maximising prices?
- Formulate the game, derive payoffs, compute best responses and Nash equilibria, compare with joint profit, test the Prisoner's Dilemma, run a sensitivity analysis, build a website.
- The numbers are illustrative, not an empirical forecast.

## Slide 4: Game-theory formulation
- Players: Station A, Station B. Strategies: Low (₹10) or High (₹12).
- Payoff = profit. Simultaneous, non-cooperative, finite, normal-form, complete information.

**Script:** "Non-cooperative means they can't sign a binding agreement. Simultaneous means neither sees the other's price first."

## Slide 5: Mathematical model
- s_A = 0.5 if p_A = p_B; q if p_A < p_B; 1 − q if p_A > p_B
- E_A = D·s_A, E_B = D·(1 − s_A); π_i = (p_i − c_i)·E_i
- D = 1,000 kWh; c = ₹6; q = 0.8

**Script:** "Worked example, Low/High: A serves 800 kWh and earns (10 − 6) × 800 = ₹3,200; B serves 200 kWh and earns ₹1,200."

## Slide 6: Payoff matrix

| A \ B | Low | High |
|---|---|---|
| Low | (₹2,000, ₹2,000) **Nash equilibrium** | (₹3,200, ₹1,200) |
| High | (₹1,200, ₹3,200) | (₹3,000, ₹3,000) ★ max joint |

- If B plays Low, A prefers Low (₹2,000 vs ₹1,200). If B plays High, A prefers Low (₹3,200 vs ₹3,000).

## Slide 7: Nash equilibrium
- Low is strictly dominant for both, so (Low, Low) is the unique pure Nash equilibrium (₹2,000 each).
- High/High gives ₹6,000 combined but each station gains ₹200 by undercutting.
- T > R > P > S: 3,200 > 3,000 > 2,000 > 1,200, which is a Prisoner's Dilemma.
- No interior mixed equilibrium (q* = −1/3).

**Script (viva point):** "A Nash equilibrium is stable against one player switching alone. The joint maximum is not, so the firms forgo ₹2,000 together, while drivers pay less."

## Slide 8: Website and implementation
- Screenshots: the "Follow the arrows" analysis section and the game simulator (captures of the running website).
- `game_theory.py` holds the logic; `web/` is the Vite + GSAP website, whose `model.js` runs the same model in the browser. All 49 pytest tests pass, including a parity test between the two models.

**Live demo (about 1 minute):**
1. Run `cd web && npm install && npm run dev` and open http://localhost:5173.
2. In *Play*, set both stations to ₹12 and show that each gains ₹200 by switching alone.
3. In *Analysis*, show that every arrow points to (₹10, ₹10), then press *Present full screen*.
4. Open *Change the market*, set q = 0.70, and show two equilibria and the mixed equilibrium (p* = 0.5).
5. Click *Restore baseline*.

## Slide 9: Results, sensitivity and applications
- q > 0.75: Low dominant, (Low, Low), Prisoner's Dilemma.
- 0.667 < q < 0.75: both (Low, Low) and (High, High).
- q < 0.667: (High, High).
- Higher operating costs raise both thresholds (heatmap).
- Applications: operator pricing, price wars, individual vs joint profit. Limitation: illustrative, fixed demand, two prices.

## Slide 10: Conclusion and future scope
- Competition drives both stations to the low price; the equilibrium is stable but not the joint maximum.
- The result depends on driver price sensitivity and margins.
- Future work: continuous prices, elastic demand, capacity and queues, location, repeated games, real data.
- Answer to the research question: (Low, Low) with ₹4,000 combined versus ₹6,000 at (High, High).
