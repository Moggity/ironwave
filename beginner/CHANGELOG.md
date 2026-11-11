# Beginner app changelog

## Package 1: scaffold
- Skeleton for the beginner app: bare `index.html`, empty `BEGINNER_CONFIG`, `BEGINNER_EXERCISES`, `Coach`, `Store`, `UI`, test harnesses, `scripts/assemble-beginner.js`, and a `beginner` CI job on Node 18 and 20.

## Package 3: store
- Versioned state with idempotent migration, memory and IndexedDB adapters, a serialised write-through session (every call resolves after the write; failed writes roll back), and one-file export and import.
- Package 3 review fixes: migration never loses a set (extra open workouts are closed, duplicate ids made unique), frozen state, memo slot, import summary, export needs a time, hardened IndexedDB adapter (strict durability, reconnect, write timeout).
