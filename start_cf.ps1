$proc = Start-Process -FilePath "npx" -ArgumentList "-y","cloudflared","tunnel","--url","http://localhost:8765" -PassThru -NoNewWindow -RedirectStandardOutput "$env:TEMP\cf_out.txt" -RedirectStandardError "$env:TEMP\cf_err.txt"
Start-Sleep -Seconds 12
if (Test-Path "$env:TEMP\cf_out.txt") {
    Get-Content "$env:TEMP\cf_out.txt" | Select-Object -First 5
}
$resp = Invoke-RestMethod -Uri 'http://localhost:4040/api/tunnels' -TimeoutSec 5 -ErrorAction SilentlyContinue
if ($resp) {
    $resp.tunnels | Where-Object { $_.public_url -match '^http' } | ForEach-Object { $_.public_url }
}