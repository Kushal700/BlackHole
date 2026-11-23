param()

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$dataDirectory = Join-Path $projectRoot "data"
$stdoutLog = Join-Path $dataDirectory "blackhole-server.log"
$stderrLog = Join-Path $dataDirectory "blackhole-server-error.log"
$npmCommand = Join-Path (Split-Path -Parent (Get-Command node.exe).Source) "npm.cmd"

function Get-AppRuntime {
  $candidates = @(
    (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
    (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
  )

  return $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}

function Open-BlackHole([int]$port) {
  $url = "http://localhost:$port/universe"
  $appRuntime = Get-AppRuntime
  $appProfile = Join-Path $env:LOCALAPPDATA "BlackHole\WebViewProfile"

  if ($appRuntime) {
    New-Item -ItemType Directory -Force -Path $appProfile | Out-Null
    Start-Process -FilePath $appRuntime -ArgumentList @(
      "--app=$url",
      "--user-data-dir=$appProfile",
      "--start-maximized",
      "--no-first-run",
      "--disable-background-mode"
    )
    return
  }

  # A normal browser is only used as a last-resort fallback on systems
  # where the Windows app runtime is unavailable.
  Start-Process $url
}

function Test-BlackHole([int]$port) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$port/api/stats" -TimeoutSec 2
    return $response.StatusCode -eq 200 -and $response.Content.Contains('"activeProjects"')
  } catch {
    return $false
  }
}

function Show-LaunchError([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, "BlackHole", "OK", "Error") | Out-Null
}

try {
  New-Item -ItemType Directory -Force -Path $dataDirectory | Out-Null

  $listenerPorts = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -ge 3000 -and $_.LocalPort -le 3010 } |
    Select-Object -ExpandProperty LocalPort -Unique)

  foreach ($candidatePort in $listenerPorts) {
    if (Test-BlackHole $candidatePort) {
      Open-BlackHole $candidatePort
      exit 0
    }
  }

  if (-not (Test-Path (Join-Path $projectRoot "node_modules"))) {
    $install = Start-Process -FilePath $npmCommand -ArgumentList @("install") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw "The app dependencies could not be installed." }
  }

  if (-not (Test-Path (Join-Path $projectRoot ".next\BUILD_ID"))) {
    $build = Start-Process -FilePath $npmCommand -ArgumentList @("run", "build") -WorkingDirectory $projectRoot -WindowStyle Hidden -Wait -PassThru
    if ($build.ExitCode -ne 0) { throw "The app could not be prepared for launch." }
  }

  $port = 3000..3010 | Where-Object { $_ -notin $listenerPorts } | Select-Object -First 1
  if ($null -eq $port) { throw "No available local port was found between 3000 and 3010." }

  Start-Process -FilePath $npmCommand `
    -ArgumentList @("run", "start", "--", "-p", "$port") `
    -WorkingDirectory $projectRoot `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog

  $ready = $false
  for ($attempt = 0; $attempt -lt 80; $attempt += 1) {
    if (Test-BlackHole $port) {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw "BlackHole took too long to start. See data\blackhole-server-error.log for details." }

  Open-BlackHole $port
} catch {
  Show-LaunchError $_.Exception.Message
  exit 1
}
