# Campus Nexus Secure Exam Browser (CN-SEB)

Windows desktop client for the existing Campus Nexus examination web application.

## Modes

- **Standard monitored mode**: `npm start`. Runs a dedicated app window, limits navigation/popups and exposes a minimal device-information bridge. It does not claim to prevent OS-level app switching.
- **Strict kiosk mode**: `npm start -- --strict`. Requests Electron kiosk/fullscreen mode and blocks common in-app shortcuts/close requests. This is not, by itself, an operating-system lockdown.

## Requirements

- Windows 10/11 (64-bit recommended)
- Node.js 20+ and npm
- Network access to `https://campusnexus.co.ke`
- Camera/microphone permission for proctored examinations

## Run locally

```powershell
cd secure-exam-browser
npm install
npm start
```

Strict kiosk preview:

```powershell
npm start -- --strict
```

Build Windows installer:

```powershell
npm run dist:win
```

## Security boundary

A normal Windows desktop app cannot safely or reliably terminate arbitrary running applications, disable Task Manager, suppress Ctrl+Alt+Delete, or guarantee that a student cannot escape a kiosk. Those controls belong to Windows device-management policy.

For institution-owned devices, deploy strict mode only alongside a managed Windows kiosk account and Windows Assigned Access / Shell Launcher configuration. Use App Control for Business (WDAC) or AppLocker to allow-list the approved exam client and required Windows components. Pilot policies on dedicated test devices first; never apply them to personal or staff computers. Maintain an invigilator/admin recovery account and documented exit/recovery process.

The current scaffold does **not** install or change Windows policies, kill processes, disable security tools, or modify the registry. It must not be described as tamper-proof.

## Integration contract

The client opens the existing `/exam.html` route so the current exam engine, institution detection, Supabase authentication and submission pipeline remain authoritative. The preload bridge exposes only:

- `CNSEB.getDeviceInfo()`
- `CNSEB.requestExit()`
- `CNSEB.onExitBlocked(callback)`

No Supabase service-role key or privileged secret belongs in this desktop client. Device registration, exam launch authorization and audit events must be validated by trusted server-side code.

## Next implementation steps

1. Add a server-issued, short-lived exam launch ticket bound to user, institution, exam, attempt and device registration.
2. Add server-side client attestation/session checks; do not trust a client-supplied `strictMode` flag.
3. Add an institution-controlled managed-device policy deployment package and recovery workflow.
4. Test camera permissions, written-answer autosave, timer warnings, automatic submission, offline/network loss, crashes and forced restarts.
5. Code-sign the Windows installer before distributing it.
