# CN-SEB security architecture

## Trust model

The desktop shell is a client-side enforcement layer, not the authority for identity, exam eligibility, time limits, marks or submission. Campus Nexus server-side authorization and exam RPCs remain authoritative.

## Components

1. Electron main process: creates the isolated window, enforces trusted-origin navigation, controls kiosk presentation and mediates permissions.
2. Preload bridge: exposes a small, typed-by-contract API; no Node.js access is exposed to the page.
3. Existing Campus Nexus exam page: handles authentication, institution scoping, exam content, proctoring, autosave and secure submission.
4. Campus Nexus backend: validates the active exam attempt and live-session token for per-question draft writes; final submission and grading remain server-authoritative. Display/focus telemetry is client-reported and is evidence, not proof of compliance.
5. Managed Windows policy (strict mode): Assigned Access/Shell Launcher plus WDAC/AppLocker allow-listing on institution-owned devices.

## Current release scope\n\nWindows desktop is the supported lockdown target for this release. Android app lockdown is deferred. Browser fallback is permitted only by institution policy and must be recorded as browser mode.\n\n## Device trust boundary\n\nElectron `isKiosk()` and `getDeviceInfo().kioskRuntime` report only the current window state. They are not evidence of institution ownership, Windows Assigned Access, Device Owner, enrollment or policy compliance. The renderer currently reports device trust as `unverified`. Do not grant managed-device exam access from these values. Managed trust requires administrator enrollment, a hardware-backed device key, fresh challenge-response, server-side attestation/policy validation and revocation checks.\n\n## Mode matrix

| Control | Standard monitored | Institution-managed Windows (OS policy independently verified) |
|---|---|---|
| Dedicated exam window | Yes | Yes |
| Trusted-origin navigation | Yes | Yes |
| Common app shortcuts blocked in app | Yes | Yes |
| Kiosk/fullscreen request | Optional | Yes |
| OS application allow-list | No | Windows policy required and server-verified before managed classification |
| Ctrl+Alt+Delete suppression | No | Not claimed |
| Force-close other apps | No | Not implemented |
| Server-side exam authorization | Required | Required |

## Answer durability and monitoring

- Every answer is saved locally immediately and debounced to the authenticated server draft RPC.
- Server drafts are scoped to the signed-in student, active attempt, question, exam and live-session token.
- On reconnect/reload, server drafts are reconciled with the local attempt-scoped copy; final submission still sends the complete answer map to the secure grading RPC.
- External-display changes and app focus loss/return are recorded as proctoring events when the exam page is active.

## Recovery and safety

- Strict mode must only be deployed to institution-owned, preconfigured devices.
- Keep a separate administrator recovery account and tested recovery instructions.
- Do not terminate antivirus, endpoint security, accessibility, assistive technology or Windows shell processes.
- A crash or network loss must not silently mark an exam as submitted. The backend must reconcile attempt state.
- Device compliance must be verified server-side; renderer-supplied values are informational only.
