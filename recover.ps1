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
                # Remove file:///
                $decoded = $decoded -replace "^file:///", ""
                # Fix slashes
                $targetFile = $decoded.Replace("/", "\")
                
                # Get the last entry id
                $lastId = $json.entries[-1].id
                $sourceFile = Join-Path $dir.FullName $lastId
                
                if (Test-Path $sourceFile) {
                    $targetDir = Split-Path $targetFile -Parent
                    if (-not (Test-Path $targetDir)) {
                        New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
                    }
                    Copy-Item -Path $sourceFile -Destination $targetFile -Force
                    Write-Host "Restored: $targetFile"
                    $count++
                }
            } catch {}
        }
    }
}
Write-Host "Total files restored: $count"
