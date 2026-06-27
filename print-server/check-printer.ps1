$ErrorActionPreference = 'Continue'
Write-Host "=== LABEL printer (basic) ==="
try { Get-Printer -Name 'LABEL' | Format-List Name, DriverName, PortName, PrinterStatus, Type, Shared, Published } catch { Write-Host "Get-Printer failed: $_" }

Write-Host "`n=== Get-PrintConfiguration (paper size, form) ==="
try { Get-PrintConfiguration -PrinterName 'LABEL' | Format-List PrinterName, PaperSize, FormName, Orientation, DuplexingMode, Color, PrintQuality } catch { Write-Host "Get-PrintConfiguration failed: $_" }

Write-Host "`n=== Driver name + port details ==="
try { Get-Printer -Name 'LABEL' | Select-Object Name, DriverName, PortName | Format-List } catch {}

Write-Host "`n=== Forms defined on this PC (filter label/thermal) ==="
try { Get-PrintForm | Where-Object { $_.Name -match '(?i)label|thermal|50|75|100|40|58|62' } | Format-Table Name, FormDescription, PaperWidth, PaperLength -AutoSize } catch { Write-Host "Get-PrintForm failed: $_" }

Write-Host "`n=== All forms (first 30) ==="
try { Get-PrintForm | Select-Object -First 30 | Format-Table Name, PaperWidth, PaperLength -AutoSize } catch {}
