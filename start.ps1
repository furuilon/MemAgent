$root = $PSScriptRoot

function Test-PortUp([int]$port) {
    try {
        Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        try {
            Invoke-WebRequest -Uri "http://localhost:$port/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
            return $true
        } catch { return $false }
    }
}

$beUp = Test-PortUp 8000
if ($beUp) {
    Write-Output "后端已在运行，跳过启动"
} else {
    Start-Process -FilePath "$root\backend\.venv\Scripts\python.exe" -ArgumentList "-m","uvicorn","app.main:app","--port","8000" -WorkingDirectory "$root\backend" -WindowStyle Hidden
    Start-Sleep -Seconds 3
}

$feUp = Test-PortUp 5173
if ($feUp) {
    Write-Output "前端已在运行，跳过启动"
} else {
    Start-Process -FilePath $env:ComSpec -ArgumentList "/c npm run dev > vite-dev.log 2>&1" -WorkingDirectory "$root\frontend" -WindowStyle Hidden
    Start-Sleep -Seconds 6
}

Start-Process "http://localhost:5173"
Write-Output "MemAgent 就绪: http://localhost:5173"
