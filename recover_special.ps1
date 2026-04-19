$targetRecovery = "C:\Users\yosef dahan\Documents\GitHub\STERNI_RECOVERY"
if (-not (Test-Path $targetRecovery)) { New-Item -ItemType Directory -Path $targetRecovery -Force | Out-Null }
$historyPath = Join-Path $env:APPDATA "Code\User\History"
$dirs = Get-ChildItem -Path $historyPath -Directory
$count = 0
foreach ($dir in $dirs) {
    $eJson = Join-Path $dir.FullName "entries.json"
    if (Test-Path $eJson) {
        $content = Get-Content $eJson -Raw
        if ($content -match "sterni/android") {
            try {
                $json = $content | ConvertFrom-Json
                $rawUri = $json.resource
                $decoded = [System.Uri]::UnescapeDataString($rawUri)
                $decoded = $decoded -replace "^file:///", ""
                
                if ($decoded -match "sterni/android/(.*)") {
                    $relPath = $matches[1].Replace("/", "\")
                    $targetFile = Join-Path $targetRecovery $relPath
                    
                    $lastId = $json.entries[-1].id
                    $sourceFile = Join-Path $dir.FullName $lastId
                    
                    if (Test-Path $sourceFile) {
                        $targetDir = Split-Path $targetFile -Parent
                        if (-not (Test-Path $targetDir)) {
                            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                        }
                        Copy-Item -Path $sourceFile -Destination $targetFile -Force
                        $count++
                    }
                }
            } catch {}
        }
    }
}
Write-Host "Total Android files recovered from Local History to $targetRecovery : $count"
