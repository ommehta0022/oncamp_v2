# Diagnose Why Users Are Not Fetching
# Run this to identify the exact issue

Write-Host "🔍 Diagnosing Users Fetching Issue..." -ForegroundColor Cyan
Write-Host ""

$backendUrl = "https://perpetual-motivation-production-be1a.up.railway.app"

# Step 1: Check backend health
Write-Host "Step 1: Checking backend health..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$backendUrl/health" -Method Get
    Write-Host "✅ Backend is running" -ForegroundColor Green
    Write-Host "   Database configured: $($health.supabaseConfigured)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend is not responding" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Try to login
Write-Host ""
Write-Host "Step 2: Testing admin login..." -ForegroundColor Yellow
$loginBody = @{
    email = "admin@gmail.com"
    password = "admin@1234"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$backendUrl/admin/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"
    
    $token = $loginResponse.accessToken
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host "   Token: $($token.Substring(0, 20))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "⚠️  Please run the password fix SQL in Supabase:" -ForegroundColor Yellow
    Write-Host "   UPDATE admin_users SET password_hash = '054eff6ef923797ac42d1ea652d4d204fef31a08b449a43c74e58047a0e091e6' WHERE email = 'admin@gmail.com';" -ForegroundColor Gray
    exit 1
}

# Step 3: Test users endpoint
Write-Host ""
Write-Host "Step 3: Testing /admin/users endpoint..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $usersResponse = Invoke-RestMethod -Uri "$backendUrl/admin/users" `
        -Method Get `
        -Headers $headers
    
    $userCount = if ($usersResponse.data) { $usersResponse.data.Count } else { $usersResponse.Count }
    
    Write-Host "✅ Users endpoint responding" -ForegroundColor Green
    Write-Host "   Users found: $userCount" -ForegroundColor Gray
    Write-Host "   Total in DB: $($usersResponse.meta.total)" -ForegroundColor Gray
    
    if ($userCount -eq 0) {
        Write-Host ""
        Write-Host "⚠️  Users table is EMPTY!" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "📝 To fix: Run this SQL in Supabase:" -ForegroundColor Yellow
        Write-Host @"
-- Add test users
INSERT INTO users (id, phone_hash, name, city, status, verified, created_at)
VALUES
  (gen_random_uuid(), 'hash1', 'Test User 1', 'New York', 'active', true, NOW()),
  (gen_random_uuid(), 'hash2', 'Test User 2', 'Los Angeles', 'active', false, NOW()),
  (gen_random_uuid(), 'hash3', 'Test User 3', 'Chicago', 'muted', true, NOW()),
  (gen_random_uuid(), 'hash4', 'Test User 4', 'Houston', 'active', true, NOW()),
  (gen_random_uuid(), 'hash5', 'Test User 5', 'Phoenix', 'banned', false, NOW());
"@ -ForegroundColor Gray
    } else {
        Write-Host ""
        Write-Host "🎉 Users are being returned correctly!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Sample user:" -ForegroundColor White
        $sampleUser = if ($usersResponse.data) { $usersResponse.data[0] } else { $usersResponse[0] }
        Write-Host "   Name: $($sampleUser.name)" -ForegroundColor Gray
        Write-Host "   Status: $($sampleUser.status)" -ForegroundColor Gray
        Write-Host "   City: $($sampleUser.city)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Users endpoint failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host "   Response: $($_.Exception.Response)" -ForegroundColor Red
}

# Step 4: Check frontend API configuration
Write-Host ""
Write-Host "Step 4: Checking frontend configuration..." -ForegroundColor Yellow
$envPath = "admin-panel\.env.production"
if (Test-Path $envPath) {
    $envContent = Get-Content $envPath
    Write-Host "✅ .env.production exists" -ForegroundColor Green
    Write-Host "   Content:" -ForegroundColor Gray
    $envContent | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
} else {
    Write-Host "❌ .env.production NOT FOUND" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Create this file: admin-panel\.env.production" -ForegroundColor Yellow
    Write-Host "   NEXT_PUBLIC_API_URL=https://perpetual-motivation-production-be1a.up.railway.app" -ForegroundColor Gray
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Diagnosis Complete!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔧 Summary:" -ForegroundColor Yellow
Write-Host "1. Backend: Check result above" -ForegroundColor White
Write-Host "2. Login: Check result above" -ForegroundColor White
Write-Host "3. Users Endpoint: Check result above" -ForegroundColor White
Write-Host "4. Frontend Config: Check result above" -ForegroundColor White
Write-Host ""
Write-Host "📚 Full documentation: oncamp_v2\admin-panel\REMAINING_ISSUES_FIX.md" -ForegroundColor Cyan
Write-Host ""

