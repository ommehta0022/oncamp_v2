# CRITICAL: Remove Exposed Secrets from Git History
Write-Host "========================================" -ForegroundColor Red
Write-Host "SECURITY: Removing Exposed Secrets" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  WARNING: This will rewrite git history!" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Do you want to proceed? This cannot be undone! (yes/no)"

if ($confirm -ne "yes") {
    Write-Host "Operation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 1: Installing git-filter-repo (if needed)..." -ForegroundColor Cyan
try {
    git-filter-repo --version 2>&1 | Out-Null
    Write-Host "✅ git-filter-repo already installed" -ForegroundColor Green
} catch {
    Write-Host "Installing git-filter-repo via pip..." -ForegroundColor Yellow
    pip install git-filter-repo
}

Write-Host ""
Write-Host "Step 2: Creating backup..." -ForegroundColor Cyan
$backupDir = "d:\automate\oncamp_v2_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
Copy-Item -Path "d:\automate\oncamp_v2" -Destination $backupDir -Recurse -Force
Write-Host "✅ Backup created at: $backupDir" -ForegroundColor Green

Write-Host ""
Write-Host "Step 3: Creating secret pattern file..." -ForegroundColor Cyan

$secretPatterns = @"
# JWT Secrets
[REDACTED_JWT_SECRET]

# Supabase Service Role Keys
[REDACTED_SUPABASE_KEY]

# Vercel Tokens
[REDACTED_VERCEL_TOKEN]

# Railway Tokens
[REDACTED_RAILWAY_TOKEN_1]
[REDACTED_RAILWAY_TOKEN_2]
"@

$secretPatterns | Out-File -FilePath "secrets_to_remove.txt" -Encoding UTF8
Write-Host "✅ Pattern file created" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "IMMEDIATE ACTION REQUIRED!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "⚠️  CRITICAL SECURITY STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. ROTATE ALL SECRETS IMMEDIATELY:" -ForegroundColor Red
Write-Host "   - Generate new JWT_SECRET" -ForegroundColor White
Write-Host "   - Regenerate Supabase Service Role Key" -ForegroundColor White
Write-Host "   - Create new Vercel token" -ForegroundColor White
Write-Host "   - Create new Railway token" -ForegroundColor White
Write-Host ""
Write-Host "2. UPDATE ENVIRONMENT VARIABLES:" -ForegroundColor Red
Write-Host "   - Railway: Set new secrets" -ForegroundColor White
Write-Host "   - Vercel: Set new secrets" -ForegroundColor White
Write-Host "   - Supabase: Update if needed" -ForegroundColor White
Write-Host ""
Write-Host "3. REDEPLOY ALL SERVICES:" -ForegroundColor Red
Write-Host "   - Backend (Railway)" -ForegroundColor White
Write-Host "   - Frontend (Vercel)" -ForegroundColor White
Write-Host ""
Write-Host "4. DELETE EXPOSED TOKENS:" -ForegroundColor Red
Write-Host "   - Revoke old tokens in respective services" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Red
Write-Host "DO NOT SKIP THESE STEPS!" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Red
Write-Host ""
Write-Host "Press any key to continue after you've rotated secrets..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "To clean git history (AFTER rotating secrets):" -ForegroundColor Cyan
Write-Host ""
Write-Host "cd d:\automate\oncamp_v2" -ForegroundColor Yellow
Write-Host "git filter-repo --invert-paths --paths-from-file secrets_to_remove.txt --force" -ForegroundColor Yellow
Write-Host "git push origin main --force" -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  WARNING: Force push will rewrite history for all collaborators!" -ForegroundColor Red
