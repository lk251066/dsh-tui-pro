$ErrorActionPreference = 'Stop'

$repository = Split-Path -Parent $PSScriptRoot
$outputDirectory = Join-Path $repository '.test-results\readme'
$html = Join-Path $outputDirectory 'overview.html'
$pngDirectory = Join-Path $repository 'packages\dsh-tui\assets'
$png = Join-Path $pngDirectory 'overview.png'
$demoFrames = @(
  'demo-01-project',
  'demo-02-switcher',
  'demo-03-docs',
  'demo-04-project'
)
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
  $edgeProfile = Join-Path $outputDirectory 'edge-profile'

  $captures = @(@{ Html = $html; Png = $png })
  foreach ($frame in $demoFrames) {
    $captures += @{ Html = (Join-Path $outputDirectory "$frame.html"); Png = (Join-Path $outputDirectory "$frame.png") }
  }

  foreach ($capture in $captures) {
    Remove-Item -LiteralPath $capture.Png -Force -ErrorAction SilentlyContinue
    $htmlUri = [System.Uri]::new($capture.Html).AbsoluteUri
    $edgeArguments = @(
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--window-size=1448,720',
      "--user-data-dir=$edgeProfile",
      "--screenshot=$($capture.Png)",
      $htmlUri
    )
    & $edge $edgeArguments
    $previousLength = -1
    $stableChecks = 0
    for ($attempt = 0; $attempt -lt 200; $attempt += 1) {
      $length = if (Test-Path -LiteralPath $capture.Png) { (Get-Item -LiteralPath $capture.Png).Length } else { 0 }
      $stableChecks = if ($length -gt 0 -and $length -eq $previousLength) { $stableChecks + 1 } else { 0 }
      if ($stableChecks -ge 4) { break }
      $previousLength = $length
      Start-Sleep -Milliseconds 50
    }
    if (-not (Test-Path -LiteralPath $capture.Png) -or (Get-Item -LiteralPath $capture.Png).Length -le 0) {
      throw "Terminal screenshot rasterization failed for $($capture.Html)."
    }
  }

  pnpm exec tsx scripts/encode-readme-demo.ts
  if ($LASTEXITCODE -ne 0) { throw 'Terminal demonstration encoding failed.' }
  Write-Output $png
  Write-Output (Join-Path $pngDirectory 'session-workbench.gif')
} finally {
  Pop-Location
}
