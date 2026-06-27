# Prepaid Sessions — Tutor Guide

A guide to running prepaid (pay-ahead) families in Love2Learn: creating plans,
tracking session usage, handling rollover, and reading the warnings.

---

## What "prepaid" means

A prepaid family **pays up front for a bucket of sessions** instead of being
invoiced after lessons happen. Each completed lesson draws one session from that
month's bucket. When the bucket runs low, you top it up for the next month.

Prepaid works **per subject**. A family can be:

- **Fully prepaid** — every subject draws from prepaid, or
- **Hybrid** — some subjects are prepaid (e.g. Piano), others are invoiced
  (e.g. Math). Each prepaid subject has its own bucket and its own card.

---

## The key thing to understand: sessions are *counted*, not *tracked*

You never manually increment or "+1" a session counter. **"Sessions used" is
calculated automatically by counting the completed lessons** for that subject in
that month.

What this means for you day-to-day:

- **Mark a lesson complete** → it counts against the bucket. Nothing else to do.
- **Un-complete or delete a lesson by mistake** → the count corrects itself
  instantly. No drift, no manual fixing.
- **Edit a lesson's date or subject** → the count re-evaluates on its own.

Because the count is derived from real lessons, every screen (Payments, Student
detail, Parent view) always shows the **same, correct number**.

---

## Creating a prepaid plan

From **Payments**, find the family and open **Create Prepaid Plan**.

1. **Pick a subject.** Only the family's actual subjects appear. A subject
   already covered this month shows **"(covered)"** and is disabled — you can't
   double-create a bucket for the same subject.

2. **Set the number of new sessions.** Use the −/＋ steppers or type a number.
   The default is 8.

3. **Set the amount.** Tap **Suggest** to auto-fill at $45/session, or type your
   own. The Summary shows the **per-session price** so you can sanity-check it.

4. **Add notes** (optional).

5. **Save** — choose one of:
   - **Create & Mark Paid** — for families who pay up front. Creates the plan
     *and* records payment in one step. This is the normal path.
   - **Create (unpaid)** — creates the plan but leaves it owing. Use this when
     you're setting up the plan before the family has paid; mark it paid later
     from the family's card.

### Carry-forward defaults

When you pick a subject that had a plan last month, the **sessions and amount
auto-fill from last month's plan** so you can confirm-and-go. Adjust if needed —
typing your own values won't be overwritten.

---

## Rollover (unused sessions carry over)

If a family didn't use all their sessions last month, the leftovers roll into the
new plan automatically.

- In the create modal, a blue note shows **"N sessions rolling over from last
  month,"** and the Summary's total reflects **new + rollover**.
- On the family's status card, you'll see a **"N rolled over"** detail.

Rollover is calculated the same way usage is — *purchased minus actually
completed* — so it's always accurate even if lessons were edited.

---

## Reading a prepaid status card

Each prepaid bucket shows as a card on the Payments screen:

| Element | What it tells you |
|---|---|
| **Prepaid / Unpaid badge** | Whether the family has paid for this bucket |
| **Sessions X / Y** | Sessions used vs. total available |
| **Progress bar** | Fills as sessions are used. Turns **amber at 75%**, **red at 100%** |
| **used / remaining / rolled over** | The breakdown of the bucket |
| **View sessions used (N)** | Tap to expand an **auditable list** of exactly which completed lessons consumed the balance (date · student · subject) |
| **Over-limit warning** | Red banner if more lessons were completed than were purchased |

Use **"View sessions used"** when a parent questions the count — it shows the
exact lessons behind the number.

### Card actions

- **Mark as Paid** — appears on unpaid buckets.
- **Preview Parent View** — see exactly what the parent sees, with the same
  derived count.
- **Switch to Invoice Billing** — move the family off prepaid and back to
  after-the-fact invoicing.

---

## Warnings when completing lessons

When you mark prepaid-subject lessons complete, the app checks coverage and may
warn you about two situations:

1. **No active prepaid package for the month** — the lesson's subject is set up
   as prepaid, but there's no bucket purchased for this month. The lesson is
   effectively **uncharged**. Fix: create a prepaid plan for that subject/month.

2. **Over the purchased session count** — completing the lesson pushed the family
   **past the sessions they paid for** (e.g. 9 used against an 8-session bucket).
   The lesson still counts; you'll want to **top up the bucket** or settle the
   extra.

Both are heads-up warnings — the lesson is still marked complete. They just make
sure no session slips through unbilled.

---

## Seeing prepaid status from a student

On a **student's detail screen**, a **Prepaid Sessions** section shows compact
cards for the family's active buckets this month (one per prepaid subject), with
remaining sessions at a glance. It only appears if the family has a prepaid plan
for the current month.

---

## Common tasks — quick reference

| I want to… | Do this |
|---|---|
| Set up a pay-ahead family | Create Prepaid Plan → pick subject → **Create & Mark Paid** |
| Start a new month | Create Prepaid Plan again — last month's values + rollover are pre-filled |
| Check how many sessions are left | Look at the family's card on Payments, or the student's detail screen |
| Prove which lessons used the balance | Tap **View sessions used** on the card |
| A family overpaid/underused | Rollover handles it automatically next month |
| A family ran out mid-month | Heed the over-capacity warning; create another plan to top up |
| Move a family off prepaid | **Switch to Invoice Billing** on their card |
| See what the parent sees | **Preview Parent View** on their card |
