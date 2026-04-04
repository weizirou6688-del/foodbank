param(
    [Parameter(Mandatory = $true)]
    [string]$RootDir,

    [Parameter(Mandatory = $true)]
    [int]$BackendPort,

    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = 'Stop'

$logDir = Join-Path $RootDir '.logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logPath = Join-Path $logDir ("frontend_{0}.log" -f $Port)
$frontendDir = Join-Path $RootDir 'frontend'
$proxyTarget = "http://127.0.0.1:$BackendPort"

try {
    Set-Content -Path $logPath -Encoding utf8 -Value "[$(Get-Date -Format s)] Starting frontend on port $Port (proxy: $proxyTarget)"
} catch {
    # Keep startup resilient if a previous shell still holds the log file.
}

$command = "cd /d ""$frontendDir"" && set VITE_API_PROXY_TARGET=$proxyTarget && set VITE_FRONTEND_PORT=$Port && set VITE_STRICT_PORT=true && npm.cmd run dev -- --host 127.0.0.1 --port $Port --strictPort >> ""$logPath"" 2>&1"
Start-Process -FilePath 'cmd.exe' -ArgumentList '/d', '/c', $command -WindowStyle Hidden | Out-Null

$frontendUrl = "http://127.0.0.1:$Port"
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    Start-Sleep -Seconds 1
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $frontendUrl -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            exit 0
        }
    } catch {
        continue
    }
}

Write-Error "Frontend on port $Port did not become reachable in time."
exit 1
