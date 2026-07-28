# Event Logging: Operational Guidance (SQLite vs. Memory Backends)

This document outlines the operational characteristics, deployment trade-offs, and security/privacy boundaries for event logging backends in the Secondary Condition Finder application.

---

## 1. Backend Comparison Matrix

| Operational Dimension | SQLite Logger (`events.db`) | In-Memory Logger (`MemoryEventLogger`) |
| :--- | :--- | :--- |
| **Durability** | Persistent across server restarts and VM reboots. | Ephemeral (cleared on process restart or container scale-down). |
| **Concurrency** | Handles concurrent read/write operations via SQLite locking mechanisms. | Thread/Async safe within a single Node.js runtime instance. |
| **Storage Footprint** | Disk-backed (configured via `EVENT_LOG_SQLITE_PATH`). | RAM-backed; subject to array size limits or rolling ring-buffers. |
| **Primary Use Case** | Local development, audit logging, analytics persistence on single-node Azure VMs. | Unit/Integration testing, stateless serverless / containerized scaling where local disk is ephemeral. |

---

## 2. Privacy & Compliance Posture (Non-Negotiable)

Regardless of whether SQLite or Memory logging is active, both backends adhere to strict privacy rules:
1. **Zero Free Text Persistence:** Intake free text, unstructured user notes, and clinical narratives are **never** persisted to event logs.
2. **PII Masking:** Social security numbers, patient names, and raw medical diagnoses are automatically rejected or stripped by `sanitizeAndValidateEventPayload`.
3. **Audit Trail:** Only structured telemetry events (e.g., step progression, catalog category selection, error telemetry) are recorded.

---

## 3. Production Deployment Recommendations

- **Single-Node Azure VM:** Use **SQLite** backed by the persistent OS disk (`Premium LRS`). Ensure `.env.local` points `EVENT_LOG_SQLITE_PATH` to a secured directory (`./data/events.db`) with restricted file permissions (`chmod 600`).
- **Stateless / Horizontal Scaling:** If deploying across multiple load-balanced containers or serverless functions without shared persistent volumes, use **Memory Logger** or an external centralized telemetry sink to prevent split-brain SQLite locking issues.
