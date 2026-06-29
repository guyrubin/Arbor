#2b7fff` is real, `--glass-blur:none`, navy ink `#14225a`. I have enough ground truth to resolve the audit conflict decisively. Writing the plan.

# Arbor Design ↔ Production Reconciliation Plan

## 1. The diagnosis (why prod looks nothing like the design)

Prod is **one token-scope line from the design, not a rebuild.** The canonical flat-sapphire design system already ships verbatim in `app/src/index.css` as the `.arbor-parent` block (lines 689-741): `--arbor-clay #2b7fff`, flat `#ffffff`/`#eef3fb` surfaces, `--glass-blur:none`, neutral shadows, navy ink `#14225a` — an exact match to `_ds/.../tokens/colors.css`. But `Shell.tsx:199` applies `.arbor-parent` to `<main>` **only**, while the global `:root` (lines 9-67) is still the old **2035 glassmorphism** set: `--arbor-paper` is a gradient, `--arbor-clay` is the lighter `#58a6ff`, `--glass-blur:blur(12px)` and `--arbor-clay-glow` are ON, hairlines are blue-tinted. The shell chrome (Sidebar/Topbar/AiRail/MobileNav) and the `.arbor-app` canvas wash are **siblings of `<main>`, outside the scope**, so they resolve against glass `:root`. The result is exactly Guy's complaint: **flat clinical content surrounded by old blue-glass chrome** — a split-theme seam, not a design that was never built.

## 2. The keystone: token-layer sync

**Decision — resolve the audit conflict:** the Care/Kid/Playbank audits propose swapping `:root` wholesale; the Tokens/Shell/Today/Growth/Academy audits warn that's a high-blast-radius re-skin of *every* surface (auth, modals, kid-mode, marketing shells) at once. **The safe path is the scoped one: promote the flat-sapphire values into a shared scope covering shell+canvas+content, and demote the glass `:root` to an opt-in `[data-skin="2035"]`** — not a destructive `:root` overwrite. This eliminates the seam app-wide while making rollback a one-attribute change.

What the sync fixes app-wide once chrome shares the flat tokens:
- Topbar gradient → flat `#eef3fb`; sidebar/topbar hairlines blue-tinted → neutral `#e8eee9`; unscoped `--arbor-clay #58a6ff` → `#2b7fff`; `.arbor-app` radial wash → flat canvas; every primary CTA gradient/glow → flat.

The **three regression guardrails** that make this safe:
1. **184 hardcoded hex literals bypass tokens** (`LoginScreen`, `AiRail`, `SettingsModal`, `HeroArcade`, `practice/*`). A token sync will NOT reach them → do the **scope fix first, then sweep shell-adjacent literals**, never the reverse, or you create *new* seams.
2. **Gradient-dependent components:** `--arbor-*-soft` change *type* from gradient (`:root`) to solid tint under the flat scope; `--arbor-gradient-primary` and any `boxShadow:var(--arbor-clay-glow)` (AskSpecialist hardcodes 2) flatten. Verify no chip/pill/CTA relied on the gradient/glow for depth or affordance; add explicit focus rings if so.
3. **Contrast:** `#2b7fff` (3.76:1) is an *improvement* over `#58a6ff` (3.0:1) for UI components, but **fails AA for normal text** — confirm no body text uses raw clay as foreground, and keep `--arbor-muted` at the AA-passing `#6b7a6e`, never the design's failing `#8a958e`.

**Insulate the two intentional scopes:** `.arbor-play` (kid comic register — gradient/animated *by design*) and `KidModeOverlay` self-define their `--comic-*` tokens and must NOT be flattened.

## 3. Per-domain gap table

| Domain | How far off | Keystone fix | Regression risk |
|---|---|---|---|
| **Shell / Nav / Topbar / Canvas** | **Critical** — split theme; chrome+canvas on glass `:root`, content on flat scope | Extend flat scope to shell+`.arbor-app`; drop radial wash | Med — many `!important` `.arbor-app` overrides written for a glass root; prune by visual diff |
| **Design Tokens (keystone)** | **Critical** — `:root` glass vs `.arbor-parent` flat already shipped | Promote flat values to a shared `.arbor-shell` scope; glass → `[data-skin="2035"]` | Med — `*-soft` gradient→solid type change |
| **Kid Mode** | **Critical** — live `main` = old 3-tab overlay; design-matching `KidDashboard` built but **unmerged** on `rel/kidmode/prod` + English-only strings | Token sync + add HE/RTL i18n, then merge `rel/kidmode/prod` behind L3 gate | Med — view-router replaces overlay; preserve hold-to-exit/focus-trap; avatarless fallback |
| **MORE / All-Tools hub** | **High** — surface doesn't exist; weekly hidden in Ctrl+K, no mobile "More" | Add additive `MoreHubTab` (new tab + MobileNav/Sidebar entry) tiling existing leaves | Med — 5→6 mobile tabs (≥44px targets, HE label wrap); all 4 edits land together |
| **Today / Home** | Low-med — ~95% reconciled; **green-token leak** (translucent blobs) | Add `--arbor-green-soft #e7f6ef`/`-ink #047857` to the flat scope | Low — cosmetic; do NOT restore the firewall-forbidden % ring |
| **Grow / Milestones / Weekly** | Med — flat tokens already inherited; 3 missing **firewall-safe signals** (Dev-Map ring, band chips, weekly trend) | Re-add ring/bands/trend driven by parent-owned LOG (count/band), never a clinical score | Med — must NOT reintroduce 0-100 child % (reverses Wave-3 CI-22/23/24) |
| **Care Network** | Med — functionally *ahead*; visual off via tokens; gradient CTAs vs solid navy | Token sync; redefine `--arbor-gradient-primary`→solid (zero-JSX) | Med — keep redaction packet + `requestConsult()` + share-grants; never swap to thin design list |
| **Academy** | Med — on flat scope already; missing hero "Learning Map" ring + 2-col IA | Add conic ring + 2-col grid fed by existing explored/available counts | Low — preserve cleared child-safety copy (no deficit/ranked framing) |
| **Playbank / Practice** | Low — already implements comic register + worlds + bilingual share loop | Inherited token sync only; no structural change | Low — leave intentional comic-ink literals; audit stray `#58a6ff` literals |

## 4. Reconciliation waves

Each wave = one green branch behind Guy's L3 merge gate, extending the existing `claude/redesign-wave*` lineage (no parallel track).

| Wave | Branch | What ships | Effort | Risk |
|---|---|---|---|---|
| **W0 — Token sync (keystone)** | `claude/redesign-wave5-token-unify` | Flat-sapphire promoted to shared shell scope; glass→`[data-skin=2035]`; add leaked green tokens to flat scope; drop `.arbor-app` radial wash | M | Med |
| **W1 — Shell/Nav chrome** | `claude/redesign-wave5-shell` *(can fold into W0)* | Sidebar `#fbfdfc` / Topbar `#eef3fb` via tokens; replace literal `bg-white`; sweep shell-adjacent hex (`AiRail`, `LoginScreen`, `SettingsModal`); prune dead `.arbor-app` overrides | M | Low-Med |
| **W2 — Kid Mode merge** | `rel/kidmode/prod` (rebased post-W0) | Fold token sync + add kid HE/RTL i18n (native-voice gate), reconcile copy (My rooms/Today's Quest), merge `KidDashboard` | M | Med |
| **W3 — More hub** | `claude/redesign-wave6-morehub` | Additive `MoreHubTab` + MobileNav/Sidebar "More" entry; status subs from existing reads only | S-M | Low-Med |
| **W4 — Growth signals** | `claude/redesign-wave6-grow` | Firewall-safe Dev-Map ring + band chips + weekly trend (log-driven); clinical-board sign-off on framing | M | Med |
| **W5 — Academy IA** | `claude/redesign-wave6-academy` | Hero Learning-Map ring + 2-col layout from existing counts | M | Low |
| **W6 — Polish** | `claude/redesign-wave6-polish` | Residual literal sweep (`WeeklyTab #9a5a2a`, `MilestonesTab` green well), Care 2-col side-rail, navy-primary token | L | Low-Med |

Care/Today/Playbank need **no dedicated wave** — they reconcile entirely via W0's token sync (Today also needs the green tokens, already folded into W0). The 3-state milestone toggle (Grow) is an **XL data-model change, out of scope** — spin a separate spec only if Guy wants it.

## 5. No-regression protocol

Each wave verified before its L3 merge gate:
1. **Build green** — full dev ring (the 1128-test suite incl. RTL snapshots + a11y/WCAG contrast + child-data GDPR export/erase guard). W0 must pass across **all** domains, not just one, since it's app-wide.
2. **Visual diff vs handoff screenshots** in **both EN and HE/RTL**: chrome+content share flat `#2b7fff`, no glass seam, `.arbor-play` unchanged, contrast holds (`#2b7fff` 3.76:1 UI, text-on-clay AA-checked).
3. **Preserve behavior** — token/IA-only waves touch no routes, data, or i18n keys; richer prod surfaces (Care redaction, Academy masterclasses, Grow AI scaffold, kid worlds) are never naive-replaced by thin prototype screens.
4. **Child-safety invariants** — no 0-100 child % / ranked-deficit framing reintroduced (CI-22/23/24); every new growth signal is a parent-owned log fraction or qualitative band; new child-data sinks registered in `CHILD_SUBCOLLECTIONS`/`childData.ts`.
5. **Guard-test extension** per wave (navigation, academy ring, kid no-egress) to lock the IA.
6. **Branch only — never hand-deploy.** Merge = prod-promote = Guy's L3 call.

## 6. Fastest visible win + the exact first branch

**Fastest win = W0 token sync** — it is the single highest-leverage change: it kills the flat-content/glass-chrome seam across *every* domain at once, with zero component edits, and the flat values already exist verbatim in the codebase (`.arbor-parent` 689-741).

**Cut this branch this session:**
```
git checkout main && git checkout -b claude/redesign-wave5-token-unify
```
First edits, all in `app/src/index.css`:
1. Wrap the glass `:root` surface/primary/rule/glass/shadow values (lines 10-67) in `[data-skin="2035"]` (rollback = remove one attribute).
2. Lift the `.arbor-parent` flat values into a shared `.arbor-shell` (or `:root` default) so chrome+canvas+content all resolve flat-sapphire.
3. **Add the two leaked green tokens** to the flat set: `--arbor-green-soft:#e7f6ef; --arbor-green-ink:#047857;` (fixes Today's translucent-blob regression).
4. Set `Shell.tsx` outer `.arbor-app` div to the shared shell scope; drop the radial-gradient canvas wash.

Then build green, visual-diff EN+HE, **stop** for Guy's merge gate.

## 7. Open decisions for Guy

1. **Token strategy — scoped opt-in vs wholesale `:root` swap.** Recommendation: **scoped** (`[data-skin="2035"]` fallback). It eliminates the seam with one-attribute rollback and won't destructively re-skin auth/modals/marketing shells in a single irreversible move. Approve, or do you want a hard `:root` overwrite?
2. **`claude.ai/design` "remote supersedes" note.** Memory says the live Claude Design kit on `claude.ai/design` *supersedes* the local build — but this reconciliation makes the **prod React app** match the handoff export. Confirm the **handoff at the scratchpad path is the canonical target for the app**, so W0+ aren't overwriting a newer remote intent.
3. **Sapphire-flip gating.** The token sync *is* the sapphire flip (`#58a6ff`→`#2b7fff`) app-wide. Prior memory gates the sapphire-flip behind your L3 call — confirm W0's green branch is the artifact you'll review before that flip goes to prod.
4. **Kid Mode merge ordering.** `rel/kidmode/prod` (~85% design match) is built but unmerged and English-only. Approve: rebase on W0 → add HE/RTL i18n via the native-voice gate → merge — i.e. it ships *with* the token fix, not before.
5. **Growth firewall-safe signals.** Re-adding the Dev-Map ring/band chips/weekly trend needs **clinical-board sign-off** that a parent-noticed *log fraction* ("12 of 18 you've noticed") is acceptable where a child % is forbidden. Approve the framing before W4 builds.
6. **3-state milestone toggle** (design's Mastered/Practicing/Not-yet vs prod binary log) is an XL Firestore migration — **defer to a separate spec**, not this zero-regression track. Confirm deferral.

**Bottom line:** prod isn't a mess that needs rebuilding — it's a finished flat-sapphire design scoped to `<main>` only. One token-scope wave (W0) closes ~70% of the perceived gap across every domain; the remaining waves add three missing-by-design IA elements (More hub, Growth signals, Academy ring) and merge the already-built Kid dashboard. Files of record: `app/src/index.css` (`:root` 9-67 glass, `.arbor-parent` 689-741 flat), `app/src/components/layout/Shell.tsx:199` (scope boundary), branch `rel/kidmode/prod`.