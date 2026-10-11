# Read public catalog metadata only; no full-text crawl or publication.
$ErrorActionPreference = 'Stop'

function Get-CatalogContent([long]$Id) {
    $url = 'https://www.chabadlibrary.org/books/api/main?path=%2F' + $Id
    return (Invoke-RestMethod -Uri $url).content
}

$root = Get-CatalogContent 3100000000
$parts = @()
foreach ($part in ($root.data | Select-Object -First 6)) {
    $partContent = Get-CatalogContent $part.id
    $topics = @()
    foreach ($topic in $partContent.data) {
        $topicContent = Get-CatalogContent $topic.id
        if ($topicContent.type -ne 'children') {
            throw ('Expected catalog children at ' + $topic.id)
        }
        $chapters = @($topicContent.data | ForEach-Object {
            [ordered]@{ id = $_.id; heading = $_.heading }
        })
        $topics += [ordered]@{
            id = $topic.id
            heading = $topic.heading
            chapters = $chapters
        }
    }
    $parts += [ordered]@{ id = $part.id; heading = $part.heading; topics = $topics }
    Write-Output ($part.heading + ': ' + $topics.Count + ' topics')
}
$report = [ordered]@{
    auditedUtc = [DateTime]::UtcNow.ToString('o')
    source = 'https://www.chabadlibrary.org/books/3100000000'
    sourceApi = 'https://www.chabadlibrary.org/books/api/main?path=%2F3100000000'
    caveat = 'Public website endpoint observed in its JavaScript; undocumented, no API service guarantee or redistribution license established. Catalog only, not full-text verification.'
    rootEntries = @($root.data | ForEach-Object { [ordered]@{ id = $_.id; heading = $_.heading } })
    parts = $parts
}
$outputPath = Join-Path $PSScriptRoot 'shulchan-arukh-harav-catalog.json'
$report | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $outputPath -Encoding utf8
Write-Output ('Saved catalog metadata: ' + $outputPath)
