$root = $PSScriptRoot
$ErrorActionPreference = 'Stop'

Write-Host '[1/5] 生成应用图标...' -ForegroundColor Cyan
& "$root\backend\.venv\Scripts\python.exe" "$root\backend\scripts\gen_icon.py"
if ($LASTEXITCODE -ne 0) { throw '图标生成失败' }

Write-Host '[2/5] 构建前端...' -ForegroundColor Cyan
Push-Location "$root\frontend"
npm run build
if ($LASTEXITCODE -ne 0) { Pop-Location; throw '前端构建失败' }
Pop-Location

Write-Host '[3/5] 同步 dist...' -ForegroundColor Cyan
$distDst = "$root\backend\frontend_dist"
if (Test-Path $distDst) { Remove-Item $distDst -Recurse -Force }
Copy-Item "$root\frontend\dist" $distDst -Recurse

Write-Host '[4/5] 确保打包依赖...' -ForegroundColor Cyan
& "$root\backend\.venv\Scripts\python.exe" -m pip install --quiet pyinstaller pywebview pillow

Write-Host '[5/5] PyInstaller 打包 (onedir 秒开模式)...' -ForegroundColor Cyan
Push-Location "$root\backend"
& ".\.venv\Scripts\pyinstaller.exe" --noconfirm --clean MemAgent.spec
if ($LASTEXITCODE -ne 0) { Pop-Location; throw 'PyInstaller 失败' }

$appDir = "$root\backend\dist\MemAgent"
Pop-Location

Write-Host '[+] 压缩交付包...' -ForegroundColor Cyan
$release = "$root\release"
New-Item -ItemType Directory -Force -Path $release | Out-Null
$zipPath = "$release\MemAgent-win64.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path $appDir -DestinationPath $zipPath -CompressionLevel Optimal

$sizeMB = [math]::Round(((Get-ChildItem $appDir -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB, 1)
$zipMB = [math]::Round((Get-Item $zipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "完成!" -ForegroundColor Green
Write-Host "  应用目录: $appDir  ($sizeMB MB, 双击 MemAgent.exe 秒开)"
Write-Host "  分发压缩包: $zipPath  ($zipMB MB)"
