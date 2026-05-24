# setup_npm.ps1
$projectDir = (Resolve-Path .)
Set-Location $projectDir

# Download npm tarball
$npmUrl = "https://registry.npmjs.org/npm/-/npm-10.8.0.tgz"
$npmTar = "npm.tgz"
Invoke-WebRequest -Uri $npmUrl -OutFile $npmTar -UseBasicParsing

# Extract tarball (Windows includes tar)
# Ensure tar is available in PATH
$null = tar -xzf $npmTar -C .

# Clean up tarball
Remove-Item $npmTar

# Move extracted folder to npm
Rename-Item -Force "package" "npm"

# Install pg using npm CLI
node .\npm\bin\npm-cli.js install pg
