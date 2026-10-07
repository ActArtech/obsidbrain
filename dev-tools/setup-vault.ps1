# setup-vault.ps1 - link a vault to the shared plugin + script store.
# Usage: powershell -File setup-vault.ps1 -Vault "D:\path\to\vault" [-Shared "..."]
# Idempotent: safe to re-run. Obsidian must be closed first.

param(
  [Parameter(Mandatory = $true)][string]$Vault,
  [string]$Shared = "D:\work\launchpad\pads\obsidbrain\shared"
)
$ErrorActionPreference = "Stop"
$Vault = (Resolve-Path $Vault).Path
New-Item -ItemType Directory -Force (Join-Path $Shared "plugins") | Out-Null
New-Item -ItemType Directory -Force (Join-Path $Shared "Excalidraw-Scripts") | Out-Null

$plugins = @("obsidian-excalidraw-plugin", "dataview", "excalibrain")

foreach ($p in $plugins) {
  $vaultPlugin = Join-Path $Vault ".obsidian\plugins\$p"
  $sharedPlugin = Join-Path $Shared "plugins\$p"

  # first vault encountered contributes its copy as the canonical one
  if ((Test-Path $vaultPlugin) -and (-not (Test-Path $sharedPlugin))) {
    Move-Item $vaultPlugin $sharedPlugin
    Write-Output "  canonical $p adopted from this vault"
  }
  if (-not (Test-Path $sharedPlugin)) {
    Write-Output "  SKIP $p (no canonical copy yet - install it in one vault first)"
    continue
  }
  if (Test-Path $vaultPlugin) {
    if ((Get-Item $vaultPlugin).LinkType -eq "Junction") { continue } # already linked
    Remove-Item $vaultPlugin -Recurse -Force
  }
  New-Item -ItemType Junction -Path $vaultPlugin -Target $sharedPlugin | Out-Null
  Write-Output "  linked $p"
}

# our ea-scripts folder is a vault folder, not a .obsidian folder - junction it too
$vaultScripts = Join-Path $Vault "Excalidraw\Scripts"
$sharedScripts = Join-Path $Shared "Excalidraw-Scripts"
if (Test-Path $vaultScripts) {
  # merge any vault-only scripts into the shared store before linking
  Copy-Item (Join-Path $vaultScripts "*") $sharedScripts -Force -ErrorAction SilentlyContinue
  Remove-Item $vaultScripts -Recurse -Force
}
New-Item -ItemType Junction -Path $vaultScripts -Target $sharedScripts | Out-Null
Write-Output "  linked Excalidraw/Scripts"

# enable the plugins for this vault
$cp = Join-Path $Vault ".obsidian\community-plugins.json"
$enabled = @("obsidian-excalidraw-plugin", "dataview", "excalibrain")
if (Test-Path $cp) {
  $j = Get-Content $cp -Raw | ConvertFrom-Json
  foreach ($e in $enabled) { if ($j -notcontains $e) { $j = @($j) + $e } }
  $j | ConvertTo-Json -Depth 5 | Set-Content $cp
} else {
  New-Item -ItemType Directory -Force (Split-Path $cp) | Out-Null
  $enabled | ConvertTo-Json | Set-Content $cp
}
Write-Output "done: $Vault"
