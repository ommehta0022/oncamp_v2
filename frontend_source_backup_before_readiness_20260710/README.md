# OnCampus Frontend

Welcome to the frontend application for OnCampus, the dedicated social platform built for academic institutions.

## Tech Stack
- **Framework**: React Native with Expo (SDK 54)
- **Navigation**: Expo Router (File-based routing)
- **Language**: TypeScript
- **State & Data**: React hooks + custom caching (`src/lib/cache.ts`)
- **Backend**: Express API with Supabase PostgreSQL

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

2. **Environment Configuration**
   The application communicates with a backend API. The API URL is determined in the following priority:
   - `EXPO_PUBLIC_API_URL` environment variable
   - `apiBaseUrl` in `app.json` `extra` configuration
   - `http://localhost:4000/v1` (fallback)

3. **Start Development Server**
   ```bash
   npx expo start
   ```

## Build & Deployment

This project uses EAS (Expo Application Services) for building native binaries.

1. **Prebuild (Optional)**
   To generate native iOS and Android folders locally:
   ```bash
   npx expo prebuild --clean
   ```

2. **Build for Production**
   ```bash
   eas build --profile production --platform all
   ```

## Architecture Overview

- `app/` - File-based routing screens.
  - `(auth)/` - Authentication flows (login, welcome).
  - `(tabs)/` - Main tab navigation (Feed, Groups, Discover).
  - `group/`, `post/`, `user/` - Entity-specific routes.
- `src/components/` - Reusable UI components conforming to strict design tokens.
- `src/lib/` - Utilities (API service, caching, image uploads).
- `src/context/` - Global React Contexts (RoleProvider, PushNotificationProvider).
- `src/theme/` - Design system tokens (colors, typography, shadows).

## Contributing Guidelines
1. Ensure strict typing. Avoid `any`.
2. Do not use inline arbitrary colors. Rely solely on `colors.ts` and `typography.ts`.
3. Check code health by running `npx tsc --noEmit` and `npx expo-doctor` before opening PRs.
