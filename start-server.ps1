# School Hub MVP - Startup Script
# This script loads environment variables from .env and launches the server.

$NodePath = "C:\Users\HP\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (-not (Test-Path $NodePath)) {
    Write-Error "Node.exe runtime not found at $NodePath"
    exit 1
}

# Parse and apply .env file if present
$EnvFile = Join-Path $PSScriptRoot ".env"
if (Test-Path $EnvFile) {
    Write-Host "Loading environment variables from $EnvFile..."
    Get-Content $EnvFile | ForEach-Object {
        $line = $_.Trim()
        # Ignore empty lines and comments
        if ($line -and -not $line.StartsWith("#")) {
            $parts = $line -split '=', 2
            if ($parts.Length -eq 2) {
                $key = $parts[0].Trim()
                $value = $parts[1].Trim()
                # Remove surrounding quotes if they exist
                if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                [System.Environment]::SetEnvironmentVariable($key, $value, [System.EnvironmentVariableTarget]::Process)
                Write-Host "  Set $key = $value"
            }
        }
    }
} else {
    Write-Warning ".env file not found! Falling back to defaults."
}

# Ensure host and port are set in environment for log output
$HostVal = [System.Environment]::GetEnvironmentVariable("HOST")
if (-not $HostVal) { $HostVal = "127.0.0.1" }
$PortVal = [System.Environment]::GetEnvironmentVariable("PORT")
if (-not $PortVal) { $PortVal = "3000" }

Write-Host "Launching School Hub server on http://$($HostVal):$($PortVal)..."
& $NodePath server.js
