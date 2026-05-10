param(
    [Parameter(Mandatory = $true)]
    [string]$RootDir,

    [Parameter(Mandatory = $true)]
    [int]$Port,

    [string]$PythonExe = ''
)

$ErrorActionPreference = 'Stop'

function Test-TruthySetting {
    param(
        [string]$Value,
        [bool]$Default = $true
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $Default
    }

    switch ($Value.Trim().ToLowerInvariant()) {
        '1' { return $true }
        'true' { return $true }
        'yes' { return $true }
        'on' { return $true }
        '0' { return $false }
        'false' { return $false }
        'no' { return $false }
        'off' { return $false }
        default { return $Default }
    }
}

$logDir = Join-Path $RootDir '.logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logPath = Join-Path $logDir ("backend_{0}.log" -f $Port)
$backendDir = Join-Path $RootDir 'backend'
$docsUrl = "http://127.0.0.1:$Port/docs"
$shouldOpenSwagger = Test-TruthySetting -Value $env:OPEN_SWAGGER_ON_START -Default $true

if (-not $PythonExe) {
    $venvPython = Join-Path $RootDir '.venv\Scripts\python.exe'
    if (Test-Path $venvPython) {
        $PythonExe = $venvPython
    } else {
        $PythonExe = 'python'
    }
}

try {
    Set-Content -Path $logPath -Encoding utf8 -Value "[$(Get-Date -Format s)] Starting backend on port $Port with $PythonExe"
} catch {
    # Keep startup resilient if a previous shell still holds the log file.
}

$command = "cd /d ""$backendDir"" && ""$PythonExe"" -m uvicorn app.main:app --host 127.0.0.1 --port $Port >> ""$logPath"" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', $command -WindowStyle Hidden | Out-Null

$healthUrl = "http://127.0.0.1:$Port/health"
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 5
        if ($response.StatusCode -eq 200 -and $response.Content -match '"status"\s*:\s*"ok"') {
            if ($shouldOpenSwagger) {
                try {
                    Start-Process $docsUrl | Out-Null
                } catch {
                    Write-Warning "Swagger UI could not be opened automatically: $($_.Exception.Message)"
                }
            }
            exit 0
        }
    } catch {
        continue
    }
}

Write-Error "Backend on port $Port did not become healthy in time."
exit 1
