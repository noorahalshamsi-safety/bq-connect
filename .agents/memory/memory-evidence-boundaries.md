---
name: Memory evidence boundaries
description: How to interpret guarded development memory and capacity measurements.
---

Keep live heap, temporary allocation pressure, external buffers, RSS and whole-scenario completion separate. Do not call a large-post workload successful merely because its lighter profile bursts completed.

**Why:** The guarded workload can finish profile reads and then exceed the same RSS budget while hydrating or constructing its full feed. Explicit diagnostic GC can reveal a smaller live set without making the ordinary no-forced-GC workload safe.

**How to apply:** Preserve the comparison guard, label phase-isolated/forced-GC probes as diagnostic only, and report stopped full workflows as NOT COMPLETED. Treat finite repeated-request heap checks as bounded observations, not proof of long-running leak freedom or sustained user capacity.
