try { Get-PrintJob -PrinterName 'LABEL' -ErrorAction Stop | Format-List Id, DocumentName, Status, SubmittedTime } catch { Write-Host "ERR:" $_.Exception.Message }
