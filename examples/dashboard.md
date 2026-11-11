# Habit dashboard (example)

Copy the `habits` block below into any note. All habit names and numbers here are invented.

```habits
folder: 100 Calendar/Daily      # folder with the daily notes, named YYYY-MM-DD.md
prefix: hc_                     # fields in the notes are hc_spanish, hc_italian, ...
lang: en                        # en | de | hu | uk. Without it the Obsidian language is used.
views: [month, year]            # a Month | Year switch appears at the top
months: 12                      # length of the year view
# month: 2026-11                # optional: month shown by default (otherwise the current one)
groups:
  - title: Languages
    series:
      - { name: Spanish, key: spanish, goal: 30 }   # goal = minutes per day
      - { name: Italian, key: italian, goal: 15 }
  - title: Reading
    series:
      # Switching to a new habit without losing history: two separate lines.
      - { name: Book A, key: book_a, goal: 20, to: "2026-12-10" }
      - { name: Book B, key: book_b, goal: 20, from: "2026-12-11" }
      # Or one continuous line with a handover:
      # - periods:
      #     - { to: "2026-12-10", name: Book A, key: book_a, goal: 20 }
      #     - { from: "2026-12-11", name: Book B, key: book_b, goal: 20 }
```

A matching daily note, for example `100 Calendar/Daily/2026-12-05.md`:

```yaml
---
tags: [daily]
hc_spanish: 30
hc_italian: 10
hc_book_a: 20
---
```
