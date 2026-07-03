# Check Users Data in Supabase
$SUPABASE_URL = "https://nxoqasndyebhiwkkfvnj.supabase.co"
$SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54b3Fhc25keWViaGl3a2tmdm5qIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjgxODcwOCwiZXhwIjoyMDk4Mzk0NzA4fQ.N4cMXJYSpOXfLjKiaN66uKr557I6cuBowqgil-3m-dA"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Checking Users Table in Supabase" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Check total users count
Write-Host "1. Counting total users..." -ForegroundColor Yellow
$headers = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
    "Prefer" = "count=exact"
}

try {
    $response = Invoke-WebRequest -Uri "$SUPABASE_URL/rest/v1/users?select=id&limit=1" -Headers $headers -UseBasicParsing
    $count = $response.Headers["Content-Range"]
    Write-Host "✅ Total users in database: $count" -ForegroundColor Green
} catch {
    Write-Host "❌ Error counting users: $_" -ForegroundColor Red
}

Write-Host ""

# Fetch first 5 users
Write-Host "2. Fetching first 5 users..." -ForegroundColor Yellow
$headers2 = @{
    "apikey" = $SUPABASE_KEY
    "Authorization" = "Bearer $SUPABASE_KEY"
}

try {
    $response = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/users?select=id,name,phone_hash,city,institution,status,verified,created_at&limit=5&order=created_at.desc" -Headers $headers2
    
    if ($response.Count -gt 0) {
        Write-Host "✅ Found $($response.Count) users:" -ForegroundColor Green
        Write-Host ""
        
        foreach ($user in $response) {
            Write-Host "  • User ID: $($user.id)" -ForegroundColor White
            Write-Host "    Name: $($user.name)" -ForegroundColor Gray
            Write-Host "    Phone Hash: $($user.phone_hash)" -ForegroundColor Gray
            Write-Host "    City: $($user.city)" -ForegroundColor Gray
            Write-Host "    Institution: $($user.institution)" -ForegroundColor Gray
            Write-Host "    Status: $($user.status)" -ForegroundColor Gray
            Write-Host "    Verified: $($user.verified)" -ForegroundColor Gray
            Write-Host "    Created: $($user.created_at)" -ForegroundColor Gray
            Write-Host ""
        }
    } else {
        Write-Host "⚠️  No users found in database" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error fetching users: $_" -ForegroundColor Red
    Write-Host "Response: $($_.Exception.Response)" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Check complete!" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
