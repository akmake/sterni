# Tether — Full Module Context

Load this context before working on anything Tether-related. Do NOT explore the codebase from scratch.

## File Map

### Server
- `server/routes/tetherRoutes.js` — ALL Tether endpoints (prefix `/api/tether`)
- `server/models/TetherDevice.js` — device schema: `deviceId`, `devicePolicy` (per-device overrides), `protectionStatus`, `installedApps`, `pendingCommands`, `allowUninstall`, `deviceNickname`
- `server/models/TetherCommunity.js` — community schema: `policy` (base policy), `adminId`, `code`
- `server/models/TetherAdmin.js` — separate admin auth (NOT main app users)

### Client UI
- `client/src/pages/TetherAdminPage.jsx` — entry point (65 lines), imports from `pages/tether/`
- `client/src/pages/tether/tetherApi.js` — axios instance + shared helpers
- `client/src/pages/tether/DeviceDetailPanel.jsx` — full per-device management panel
- `client/src/pages/tether/DevicesTab.jsx` — all-devices list
- `client/src/pages/tether/CommunitiesTab.jsx` — communities + CommunityCard + PolicyEditor
- `client/src/pages/tether/Dashboard.jsx` — stats + activity
- `client/src/pages/tether/ApprovalsTab.jsx` — pending approvals
- `client/src/pages/tether/AdminsTab.jsx` — admin management
- `client/src/pages/tether/DeviceLockModal.jsx` — lock device by time
- `client/src/pages/tether/AppTimeLockModal.jsx` — lock app by time
- `client/src/pages/tether/PolicyEditor.jsx` — community policy form
- `client/src/pages/tether/LockCommunityModal.jsx` — lock all devices in community

### Android App (ManagerApk repo)
- `admin/TetherPolicyManager.kt` — applies policy via DPM + app suspend
- `admin/TetherAccessibilityService.kt` — real-time UI blocking
- `admin/TetherVpnService.kt` — DNS blocking
- `sync/PolicySyncWorker.kt` — 5-min heartbeat + policy fetch
- `data/model/TetherModels.kt` — all data classes

## Policy System

Community policy = base. Device policy = per-device overrides where `null` means "inherit from community".

```
mergePolicy(communityPolicy, devicePolicy):
  for each field: devicePolicy[field] ?? communityPolicy[field]
```

3-way boolean toggle in UI: `null` (קהילה) → `true` (חסום) → `false` (מותר) → `null`

## Key API Endpoints

```
GET    /api/tether/admin/devices              — all devices across admin's communities
GET    /api/tether/admin/devices/:deviceId    — single device with mergedPolicy
PUT    /api/tether/admin/devices/:deviceId/device-policy   — replace devicePolicy
PUT    /api/tether/admin/devices/:deviceId/nickname
PUT    /api/tether/admin/devices/:deviceId/allow-uninstall
DELETE /api/tether/admin/devices/:deviceId
POST   /api/tether/admin/devices/:deviceId/commands  — { type: SHOW_MESSAGE|FORCE_SYNC|RELEASE_ALL, payload }
GET    /api/tether/admin/communities
POST   /api/tether/admin/communities
PUT    /api/tether/admin/communities/:id/policy
GET    /api/tether/admin/dashboard
GET    /api/tether/admin/approvals/all
PUT    /api/tether/admin/approvals/:id        — { status: approved|rejected }
```

## Auth

Tether has its own JWT — separate from main app auth.
- Token stored in `localStorage` as `tetherToken`
- All requests: `Authorization: Bearer <tetherToken>`
- `authHeader()` helper in `tetherApi.js`

## Common Pitfalls

- When `GET /admin/devices/:deviceId` populates `communityId`, do NOT pass populated doc to `formatDevice()` — build response inline using `communityDoc._id.toString()`
- `pendingCommands` are cleared atomically when the device fetches them (not on admin side)
- `allowUninstall` is a top-level device field, NOT inside `devicePolicy`
