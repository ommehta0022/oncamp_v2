# 🌊 AQUA-APP: OnCampus AI Agent Build System
## Start Here → Autonomous Build Pipeline

---

## What Is This?

This folder contains a **4-phase autonomous build system** that an AI agent follows step-by-step to transform the OnCampus frontend into a **deploy-ready, production-quality mobile app** — better than Emergent in every way.

The system contains **120 detailed commands** organized across 4 phases, plus task tracking files for context and reference.

---

## File Structure

```
aqua-app/
├── README.md                    ← YOU ARE HERE (Start Point)
├── PHASE-1-DEEP-AUDIT.md        ← API audit, missing integrations, auth, navigation
├── PHASE-2-UI-OVERHAUL.md       ← Premium design system, component library, screen redesign
├── PHASE-3-FEATURES.md          ← Missing features, real-time, notifications, search
├── PHASE-4-POLISH-DEPLOY.md     ← Bug fixes, security, testing, build, deploy
├── TASKS_REMAINING.md           ← All 120 tasks (to-do list)
└── TASKS_COMPLETED.md           ← Completed tasks with timestamps
```

---

## How To Use

### For AI Agent:

1. **START** by reading `TASKS_REMAINING.md` for full context
2. **OPEN** `PHASE-1-DEEP-AUDIT.md` and execute commands 1-22 in order
3. After Phase 1, move to `PHASE-2-UI-OVERHAUL.md` (commands 23-52)
4. After Phase 2, move to `PHASE-3-FEATURES.md` (commands 53-97)
5. After Phase 3, move to `PHASE-4-POLISH-DEPLOY.md` (commands 98-120)
6. **AFTER EACH COMMAND**: Update `TASKS_REMAINING.md` → `TASKS_COMPLETED.md`
7. **NEVER STOP** until all 120 tasks are in `TASKS_COMPLETED.md`

### Critical Rules:

- **DO NOT SKIP** any command
- **DO NOT ASK** for permission — execute autonomously
- **DO NOT STOP** until the phase is complete
- **ALWAYS UPDATE** task tracking files after each command
- **ALWAYS TEST** changes work before marking complete
- **QUALITY OVER SPEED** — every change must be production-quality
- **FOLLOW EXISTING PATTERNS** in the codebase
- **NO PLACEHOLDER UI** — everything must be real and functional

---

## Project Context

### Tech Stack
- **Framework**: React Native (Expo) with Expo Router
- **Language**: TypeScript
- **State**: React Context (RoleProvider)
- **API**: Custom fetch wrapper in `src/lib/api.ts`
- **Auth**: Firebase Phone OTP → Backend JWT
- **Backend**: FastAPI + Supabase (PostgreSQL)
- **Theme**: Custom tokens in `src/theme/`
- **Icons**: Ionicons via `@expo/vector-icons`

### Key Directories
```
frontend/
├── app/              ← Expo Router file-based routes
│   ├── (auth)/       ← Login, signup, OTP, profile setup
│   ├── (tabs)/       ← Feed, groups, discover, notifications, profile
│   ├── group/        ← Group chat, info, admin, members
│   ├── post/         ← Post detail
│   ├── settings/     ← All settings screens
│   ├── user/         ← User profile, connections
│   └── institution/  ← Institution admin screens
├── src/
│   ├── components/   ← Reusable UI components
│   ├── context/      ← RoleProvider (auth/role state)
│   ├── hooks/        ← Custom hooks
│   ├── lib/          ← api.ts, auth.ts, imageUpload.ts
│   ├── theme/        ← Colors, spacing, typography
│   └── utils/        ← Utility functions
```

### Backend API (Railway)
- **URL**: `https://perpetual-motivation-production-be1a.up.railway.app`
- **Routes**: 100+ endpoints across `server.py` and `admin_routes_simple.py`
- **Auth**: JWT Bearer tokens (HS256)
- **DB**: Supabase PostgreSQL with 30+ tables

---

## Quality Standards

This system is designed to produce output that is **BETTER THAN EMERGENT** in every way:

| Aspect | Emergent | Our Target |
|--------|----------|------------|
| Design | Clean but generic | Premium, polished, micro-animated |
| Components | Basic | Full library with variants |
| Error handling | Minimal | Comprehensive with retry |
| Loading states | Basic spinner | Skeleton + shimmer |
| Offline | None | Cached data + offline banner |
| Accessibility | None | Full VoiceOver/TalkBack |
| Performance | OK | Optimized lists, lazy loading |
| Auth | Basic | Auto-refresh, edge cases |
| Real-time | None | Supabase Realtime |
| Notifications | Basic | Full push + in-app |

---

## Getting Started

Tell the AI agent:

> Read `aqua-app/PHASE-1-DEEP-AUDIT.md` and start executing. Do not stop until all tasks are complete. Update `TASKS_REMAINING.md` and `TASKS_COMPLETED.md` after each command.

---

*Built with ❤️ for OnCampus*
