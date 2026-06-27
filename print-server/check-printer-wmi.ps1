$ErrorActionPreference = 'Continue'

Write-Host "=== WMI: Win32_Printer 'LABEL' ==="
try {
  Get-CimInstance -ClassName Win32_Printer -Filter "Name='LABEL'" |
    Format-List Name, DriverName, PortName, PrinterStatus, Default, Network, Local, WorkOffline, HorizontalResolution, VerticalResolution, PrintProcessor, PrintJobDataType, Parameters
} catch { Write-Host "WMI failed: $_" }

Write-Host "`n=== WMI: Win32_PrinterConfiguration (paper/length/width) ==="
try {
  Get-CimInstance -ClassName Win32_PrinterConfiguration |
    Where-Object { $_.Name -eq 'LABEL' -or $_.DeviceName -eq 'LABEL' } |
    Format-List Name, DeviceName, PaperSize, PaperLength, PaperWidth, Orientation, PrintQuality, YResolution, XResolution, DriverVersion
} catch { Write-Host "WMI config failed: $_" }

Write-Host "`n=== WMI: Win32_PnPEntity (USB VID 0FE6 PID 811E) ==="
try {
  Get-CimInstance -ClassName Win32_PnPEntity |
    Where-Object { $_.DeviceID -match 'USB.*VID_0FE6' -or $_.DeviceID -match 'VID_0FE6.*PID_811E' } |
    Format-List DeviceID, Name, Description, Manufacturer
} catch {}

Write-Host "`n=== USB devices (0FE6) ==="
try {
  Get-CimInstance -ClassName Win32_PnPEntity |
    Where-Object { $_.DeviceID -match 'VID_0FE6' } |
    Format-Table DeviceID, Name, Status -AutoSize
} catch {}
