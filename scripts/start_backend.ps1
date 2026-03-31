param(
    [Parameter(Mandatory = $true)]
    [string]$RootDir,

    [Parameter(Mandatory = $true)]
    [int]$Port
)

$logDir = Join-Path $RootDir '.logs'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
}

$logPath = Join-Path $logDir ("backend_{0}.log" -f $Port)
$backendDir = Join-Path $RootDir 'backend'

Set-Content -Path $logPath -Encoding utf8 -Value "[$(Get-Date -Format s)] Starting backend on port $Port"

$command = "cd /d ""$backendDir"" && python -m uvicorn app.main:app --host 127.0.0.1 --port $Port >> ""$logPath"" 2>&1"
cmd.exe /d /c $command
