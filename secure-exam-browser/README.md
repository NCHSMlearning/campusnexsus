# Campus Nexus Secure Exam Browser (CN-SEB)

Windows desktop client for the existing Campus Nexus examination web application.

## Build outputs

The repository includes a Windows GitHub Actions workflow at `.github/workflows/build-cnseb.yml`. Every push that changes this folder (or a manual workflow dispatch) builds:

- Windows NSIS installer
- Windows portable executable

The workflow uploads both files as the artifact **campus-nexus-secure-exam-browser-windows**. Download it from the successful run's **Actions → Build Campus Nexus Secure Exam Browser → Artifacts** section. Artifacts are retained for 14 days.

## Modes

- **Fullscreen monitored mode (development only)**: launches borderless in fullscreen kiosk presentation, limits navigation/popups and exposes a minimal device-information bridge. Run `npm start` for this development mode; it remains fullscreen.
- **Strict kiosk mode (default for packaged Windows builds)**: additionally blocks common in-app shortcuts and close requests. This is not, by itself, an operating-system lockdown.

## Requirements

- Windows 10/11 (64-bit recommended)
- Node.js 20+ and npm (for local development/build)
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
npm run start:strict
```


Build both Windows outputs locally:

```powershell
npm run dist:all
```

The generated files are placed in `secure-exam-browser/dist/`.

## Security boundary

A normal Windows desktop app cannot safely or reliably terminate arbitrary running applications, disable Task Manager, suppress Ctrl+Alt+Delete, or guarantee that a student cannot escape a kiosk. Those controls belong to Windows device-management policy.

For institution-owned devices, deploy strict mode only alongside a managed Windows kiosk account and Windows Assigned Access / Shell Launcher configuration. Use App Control for Business (WDAC) or AppLocker to allow-list the approved exam client and required Windows components. Pilot policies on dedicated test devices first; never apply them to personal or staff computers. Maintain an invigilator/admin recovery account and documented exit/recovery process.

The exam page now keeps attempt-scoped local drafts and synchronizes them to a server-side, session-validated draft table; the final grading/submission RPC remains authoritative. Display and application-focus changes are forwarded as proctoring events. The current client does **not** install or change Windows policies, kill processes, disable security tools, or modify the registry. It must not be described as tamper-proof. Strict mode is a kiosk presentation layer until the institution's managed Windows policy is separately provisioned.

## Integration contract

The student examination cards now route the Open Exam action through `/secure-exam-browser.html`. That page explains the Windows app download and launches the installed client with the `campusnexus-seb://` protocol. The app accepts only HTTPS exam URLs on `campusnexus.co.ke/exam.html`, then opens the existing exam engine so institution detection, Supabase authentication and submission remain authoritative. Students may use the browser fallback only where their institution permits it. A small on-screen badge identifies the CN-SEB mode. The preload bridge exposes only:

- `CNSEB.getDeviceInfo()`
- `CNSEB.requestExit()` and `CNSEB.requestLogout()`
- `CNSEB.onSecurityEvent(callback)` for display and application focus events
- `CNSEB.onExitBlocked(callback)`

No Supabase service-role key or privileged secret belongs in this desktop client. Device registration, exam launch authorization and audit events must be validated by trusted server-side code. The client-reported mode is informational and must not be treated as proof of device compliance.

## Before institutional deployment

1. Add a server-issued, short-lived exam launch ticket bound to user, institution, exam, attempt and device registration.
2. Add server-side client/session checks; do not trust a client-supplied `strictMode` flag.
3. Add an institution-controlled managed-device policy deployment package and tested recovery workflow.
4. Test camera permissions, written-answer autosave, timer warnings, automatic submission, offline/network loss, crashes and forced restarts.
5. Code-sign the Windows installer before distributing it.
6. Pilot with invigilators and institution IT on dedicated test devices before live examinations.

## Automatic updates

Installed Windows (NSIS) builds check the GitHub Releases feed immediately on every startup, again every hour while running, and when the student selects **Check updates**. Updates download in the background and are installed only when the student chooses **Update and restart** or closes the application; the app does not force a restart during an active examination. The release workflow publishes `latest.yml`, the versioned NSIS installer referenced by that manifest, and its blockmap files. The stable-name installer is provided for first-time installation.

The portable executable is provided as a convenience build; automatic installation/update behavior is intended for the installed NSIS version. The in-app Campus Nexus control header is part of the normal page layout, not a floating overlay.
