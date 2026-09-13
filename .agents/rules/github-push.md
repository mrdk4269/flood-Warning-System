---
trigger: always_on
---

## Commit & Push Policy

- Repository: https://github.com/mrdk4269/flood-Warning-System.git

- Do NOT commit or push after every small edit.
- Only commit and push once the ENTIRE assigned task is fully complete —
  all code changes, fixes, and related updates finished and verified working.
- Before committing, confirm:
  1. The task's full scope is done (not partially done).
  2. Code builds/runs without errors.
  3. No leftover debug code, TODOs, or incomplete logic remain.
- Group all changes belonging to the task into a single, clean commit
  (or a small logical set of commits) — do not push work-in-progress
  or unrelated partial changes.
- Write a clear commit message summarizing the completed task, e.g.:
  `git commit -m "Complete: <task description>"`
- Only after committing, run:
  `git push origin <branch-name>`
- If the task is large and naturally splits into independent completed
  sub-parts, each sub-part may be committed separately — but never push
  incomplete or broken code.
