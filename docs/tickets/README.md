# Tickets

One file per ticket, worked in dependency order. Start each ticket in a **fresh Claude session** (`/clear`), e.g.:

> Implement docs/tickets/M1-01-brown-noise-end-to-end.md. Use /tdd for the pure logic.

When a ticket is done: tick its checkboxes, set **Status** to `done`, commit.

## M1 — Noise core

| # | Ticket | Blocked by | Status |
|---|---|---|---|
| 01 | [Brown noise end to end](M1-01-brown-noise-end-to-end.md) | — | done |
| 02 | [White and pink layers](M1-02-white-and-pink-layers.md) | 01 | done |
| 03 | [Master EQ and volume](M1-03-master-eq-and-volume.md) | 01 | ready |
| 04 | [Smooth transport](M1-04-smooth-transport.md) | 01 | ready |
| 05 | [Offline render check](M1-05-offline-render-check.md) | 02 | ready |

After 01, tickets 02, 03 and 04 can be done in any order.

## Later

[M2–M4 outline](M2-M4-outline.md) — broken into tickets when each milestone starts.
