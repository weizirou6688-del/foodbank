param(
  [switch]$VerifyOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$requiredDlls = @(
  'vcruntime140.dll',
  'vcruntime140_1.dll'
)

$sandboxDir = Join-Path $env:USERPROFILE '.codex\.sandbox-bin'
$codexExe = Join-Path $sandboxDir 'codex.exe'

function Get-CandidateDirectories {
  $dirs = New-Object System.Collections.Generic.List[string]

  $system32 = Join-Path $env:WINDIR 'System32'
  if (Test-Path $system32) {
    $dirs.Add($system32)
  }

  foreach ($pattern in @(
    'C:\Program Files (x86)\Microsoft Visual Studio\*\*\VC\Redist\MSVC\*\x64\Microsoft.VC*.CRT',
    'C:\Program Files\Microsoft Visual Studio\*\*\VC\Redist\MSVC\*\x64\Microsoft.VC*.CRT'
  )) {
    Get-ChildItem -Path $pattern -Directory -ErrorAction SilentlyContinue |
      Sort-Object FullName -Descending |
      ForEach-Object { $dirs.Add($_.FullName) }
  }

  foreach ($entry in ($env:PATH -split ';')) {
    if (-not $entry) {
      continue
    }

    $trimmed = $entry.Trim('"')
    if (-not $trimmed) {
      continue
    }

    try {
      if (Test-Path -LiteralPath $trimmed) {
        $dirs.Add($trimmed)
      }
    } catch {
      continue
    }
  }

  $dirs | Select-Object -Unique
}

function Find-DllSource {
  param(
    [Parameter(Mandatory = $true)]
    [string]$DllName,
    [Parameter(Mandatory = $true)]
    [string[]]$SearchDirs
  )

  foreach ($dir in $SearchDirs) {
    $candidate = Join-Path $dir $DllName
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  return $null
}

if (-not (Test-Path -LiteralPath $codexExe)) {
  throw "Codex sandbox executable not found: $codexExe"
}

$candidateDirs = @(Get-CandidateDirectories)
$resolvedSources = @{}

foreach ($dll in $requiredDlls) {
  $source = Find-DllSource -DllName $dll -SearchDirs $candidateDirs
  if (-not $source) {
    throw "Could not find required runtime $dll in System32, Visual Studio redists, or PATH directories."
  }
  $resolvedSources[$dll] = $source
}

if (-not $VerifyOnly) {
  New-Item -ItemType Directory -Path $sandboxDir -Force | Out-Null

  foreach ($dll in $requiredDlls) {
    $destination = Join-Path $sandboxDir $dll
    Copy-Item -LiteralPath $resolvedSources[$dll] -Destination $destination -Force
    Write-Host "Installed $dll -> $destination"
  }
}

$previousPath = $env:PATH
try {
  $env:PATH = Join-Path $env:WINDIR 'System32'
  $env:SystemRoot = $env:WINDIR
  $env:windir = $env:WINDIR
  & $codexExe --version | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "Sandbox codex verification failed with exit code $LASTEXITCODE."
  }
  Write-Host 'Codex sandbox runtime verification passed.'
} finally {
  $env:PATH = $previousPath
}

foreach ($dll in $requiredDlls) {
  Write-Host "$dll source: $($resolvedSources[$dll])"
}
