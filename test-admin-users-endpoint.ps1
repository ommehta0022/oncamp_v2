# Test Admin Users Endpoint

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Testing Admin Users Endpoint" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

$BACKEND_URL = "https://perpetual-motivation-production-be1a.up.railway.app"

# Step 1: Login to get admin token
Write-Host "Step 1: Logging in as admin..." -ForegroundColor Yellow

$loginBody = @{
    email = "admin@gmail.com"
    password = "admin@1234"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BACKEND_URL/admin/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    
    if ($loginResponse.accessToken) {
        Write-Host "✅ Login successful!" -ForegroundColor Green
        Write-Host "  Token: $($loginResponse.accessToken.Substring(0, 20))..." -ForegroundColor Gray
        $token = $loginResponse.accessToken
    } else {
        Write-Host "❌ Login failed: No access token in response" -ForegroundColor Red
        Write-Host "Response: $loginResponse" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Login failed: $_" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Fetch users with the token
Write-Host "Step 2: Fetching users..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

try {
    $usersResponse = Invoke-RestMethod -Uri "$BACKEND_URL/admin/users?page=1&limit=10" -Headers $headers -Method Get
    
    Write-Host "✅ Users fetched successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response structure:" -ForegroundColor Cyan
    Write-Host "  Data count: $($usersResponse.data.Count)" -ForegroundColor White
    Write-Host "  Total: $($usersResponse.meta.total)" -ForegroundColor White
    Write-Host "  Page: $($usersResponse.meta.page)" -ForegroundColor White
    Write-Host "  Limit: $($usersResponse.meta.limit)" -ForegroundColor White
    Write-Host ""
    
    if ($usersResponse.data.Count -gt 0) {
        Write-Host "First user details:" -ForegroundColor Cyan
        $firstUser = $usersResponse.data[0]
        Write-Host "  ID: $($firstUser.id)" -ForegroundColor White
        Write-Host "  Name: $($firstUser.name)" -ForegroundColor White
        Write-Host "  Phone Hash: $($firstUser.phone_hash)" -ForegroundColor White
        Write-Host "  City: $($firstUser.city)" -ForegroundColor White
        Write-Host "  Institution: $($firstUser.institution)" -ForegroundColor White
        Write-Host "  Status: $($firstUser.status)" -ForegroundColor White
        Write-Host "  Verified: $($firstUser.verified)" -ForegroundColor White
        Write-Host "  Created: $($firstUser.created_at)" -ForegroundColor White
    } else {
        Write-Host "⚠️  No users in response data array" -ForegroundColor Yellow
    }
    
    Write-Host ""
    Write-Host "Full response:" -ForegroundColor Cyan
    Write-Host ($usersResponse | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Failed to fetch users: $_" -ForegroundColor Red
    Write-Host "Error details: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
    exit 1
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "Test Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
