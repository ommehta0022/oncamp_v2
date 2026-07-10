# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-07-09

### Added
- Complete UI Overhaul using custom theme system (`colors.ts`, `typography.ts`).
- Full API integration for user profiles, groups, and feeds.
- Complex Post features: read more truncation, sharing, post types (announcements, events), and real-time reactions.
- Complete Chat/Group system: member management, muting, pinning, reply, date separators.
- Notifications Engine via `expo-notifications` with action handlers and preferences.
- Search with categorization tabs (Top, Groups, People, Posts).
- Deep offline caching strategy leveraging AsyncStorage.

### Changed
- Removed any boilerplate styles to enforce unique luxury LinkedIn-style aesthetic.
- Enhanced loading states with sophisticated SkeletonLoaders globally.
- Cleaned up React Context architecture (RoleProvider, PushNotificationProvider).

### Fixed
- Addressed 100% of TypeScript strict typing compilation errors across components and screens.
- Fixed 18/18 Expo doctor health checks and resolved duplicate dependency imports.
- Re-architected input safe areas and keyboard avoiding view bounds on form screens.
