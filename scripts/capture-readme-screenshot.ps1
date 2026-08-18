$ErrorActionPreference = 'Stop'

$repository = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repository '.test-results\readme'
$html = Join-Path $outputDirectory 'overview.html'
$pngDirectory = Join-Path $repository 'packages\dsh-tui\assets'
$png = Join-Path $pngDirectory 'overview.png'
$edgeCandidates = @(
  (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$edge = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if ($null -eq $edge) {
  throw 'Microsoft Edge is required to rasterize the terminal frame.'
}

Push-Location $repository
try {
  pnpm exec tsx scripts/capture-readme-frame.ts
  if ($LASTEXITCODE -ne 0) { throw 'Terminal frame generation failed.' }
  New-Item -ItemType Directory -Force -Path $pngDirectory | Out-Null
  Remove-Item -LiteralPath $png -Force -ErrorAction SilentlyContinue
  $htmlUri = [System.Uri]::new($html).AbsoluteUri
  $edgeProfile = Join-Path $outputDirectory 'edge-profile'
  $edgeArguments = @(
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1448,720',
    "--user-data-dir=$edgeProfile",
    "--screenshot=$png",
    $htmlUri
  )
  & $edge $edgeArguments
  $previousLength = -1
  $stableChecks = 0
  for ($attempt = 0; $attempt -lt 200; $attempt += 1) {
    $length = if (Test-Path -LiteralPath $png) { (Get-Item -LiteralPath $png).Length } else { 0 }
    $stableChecks = if ($length -gt 0 -and $length -eq $previousLength) { $stableChecks + 1 } else { 0 }
    if ($stableChecks -ge 4) { break }
    $previousLength = $length
    Start-Sleep -Milliseconds 50
  }
  if (-not (Test-Path -LiteralPath $png) -or (Get-Item -LiteralPath $png).Length -le 0) {
    throw 'Terminal screenshot rasterization failed.'
  }
  Write-Output $png
} finally {
  Pop-Location
}
