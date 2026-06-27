$ErrorActionPreference = 'Continue'

Write-Host "=== printui.dll entry points (rundll32) for LABEL ==="
$printUi = Join-Path $env:SystemRoot 'System32\printui.dll'
if (Test-Path -LiteralPath $printUi) {
  $exe = "$env:SystemRoot\System32\rundll32.exe"
  Write-Host "Run manually if needed: $exe `"$printUi`" PrintUIEntry /n `"LABEL`" /p"
}

Write-Host "`n=== Driver files on disk ==="
$drvRoot = Join-Path $env:SystemRoot 'System32\spool\DRIVERS\x64\3'
if (Test-Path -LiteralPath $drvRoot) {
  Get-ChildItem -LiteralPath $drvRoot -Recurse -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match '(?i)label' } |
    Select-Object FullName, Length | Format-Table -AutoSize
}

Write-Host "`n=== Spool drivers: any LABEL/SEZNIK OEM ==="
Get-ChildItem -LiteralPath "$env:SystemRoot\System32\spool\DRIVERS" -Recurse -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '(?i)label|seznik|pos58|0FE6' } |
  Select-Object FullName, Length | Format-Table -AutoSize

Write-Host "`n=== Open printer properties dialog programmatically (devenv-free) ==="
$printUi = "$env:SystemRoot\System32\printui.dll"
Start-Process -FilePath "$env:SystemRoot\System32\rundll32.exe" -ArgumentList "`"$printUi`",PrintUIEntry","/n","LABEL","/p" -WindowStyle Normal
