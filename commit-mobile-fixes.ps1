# Commit Mobile Frontend Fixes and Important Changes

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Committing Mobile Frontend Fixes" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Reset any previous staging
git reset

# Add ONLY the important mobile frontend files
Write-Host "1. Adding mobile app configuration files..." -ForegroundColor Yellow
git add frontend/app.config.js
git add frontend/app.json
git add frontend/package.json
git add frontend/package-lock.json

Write-Host "2. Adding fixed mobile utilities..." -ForegroundColor Yellow
git add frontend/src/lib/imageUpload.ts
git add frontend/src/lib/api.ts

Write-Host "3. Adding new mobile components and hooks..." -ForegroundColor Yellow
git add frontend/src/components/ImageViewer.tsx
git add frontend/src/hooks/useTabBadges.ts
git add frontend/src/data/onboarding.ts

Write-Host "4. Adding fixed settings screens..." -ForegroundColor Yellow
git add frontend/app/settings/data-export.tsx
git add frontend/app/settings/report.tsx
git add frontend/app/settings/activity.tsx

Write-Host "5. Adding mobile app screens (auth, feed, groups, etc)..." -ForegroundColor Yellow
git add "frontend/app/(auth)/*.tsx"
git add "frontend/app/(tabs)/*.tsx"
git add frontend/app/create-group.tsx
git add frontend/app/create-post.tsx
git add "frontend/app/group/*.tsx"
git add "frontend/app/institution/*.tsx"
git add "frontend/app/post/*.tsx"
git add frontend/app/saved.tsx
git add frontend/app/search.tsx
git add "frontend/app/settings/*.tsx"
git add frontend/app/_layout.tsx

Write-Host "6. Removing mock data file..." -ForegroundColor Yellow
git rm frontend/src/data/mock.ts

Write-Host ""
Write-Host "Files staged successfully!" -ForegroundColor Green
Write-Host ""

# Show what will be committed
Write-Host "Files to be committed:" -ForegroundColor Cyan
git status --short

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Ready to commit!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
