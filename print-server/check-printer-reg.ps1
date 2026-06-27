$ErrorActionPreference = 'Continue'

Write-Host "=== Driver registry: HKLM\...\Print\Printers\LABEL ==="
$paths = @(
  "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\LABEL",
  "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\LABEL\PrinterDriverData",
  "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\LABEL\DsSpooler",
  "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Print\Printers\LABEL"
)
foreach ($p in $paths) {
  Write-Host "`n--- $p ---"
  if (Test-Path -LiteralPath $p) {
    Get-Item -LiteralPath $p | Format-List Name
    Get-ChildItem -LiteralPath $p -Recurse -ErrorAction SilentlyContinue |
      Where-Object { -not $_.PSIsContainer } |
      ForEach-Object { "{0} = {1}" -f $_.Name, ($_.GetValue($_.Name) | Out-String).Trim() }
  } else { Write-Host "(not found)" }
}

Write-Host "`n=== Driver file info ==="
$drv = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Environments\Windows x64\Drivers\Version-4\LABEL"
if (Test-Path -LiteralPath $drv) {
  Get-ChildItem -LiteralPath $drv -Recurse -ErrorAction SilentlyContinue |
    Where-Object { -not $_.PSIsContainer } |
    ForEach-Object { "{0}\{1} = {2}" -f $_.PSPath.Replace('Microsoft.PowerShell.Core\Registry::',''), $_.Name, ($_.GetValue($_.Name) | Out-String).Trim() }
}

Write-Host "`n=== Manufacturer GDI data (key 'PrinterDriverData' contents) ==="
$pdd = "HKLM:\SYSTEM\CurrentControlSet\Control\Print\Printers\LABEL\PrinterDriverData"
if (Test-Path -LiteralPath $pdd) {
  $bytes = (Get-Item -LiteralPath $pdd).GetValue('PrinterDriverData')
  if ($bytes) { $bytes | Select-Object -First 64 | ForEach-Object { "{0:X2}" -f $_ } }
}
