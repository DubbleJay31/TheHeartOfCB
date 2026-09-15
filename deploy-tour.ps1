<#
.SYNOPSIS
  Publish a 3DVista "Published 3D Tour" zip export as its own Cloudflare Pages
  site, fix up the default "Untitled" title, and print the <iframe> snippet
  to paste into index.html.

.EXAMPLE
  .\deploy-tour.ps1 -Zip "C:\Users\jesse\Desktop\Boardwalk Sunset Tour.zip" -Name boardwalk-sunset -Title "Boardwalk at Sunset"

  Deploys to https://thocb-boardwalk-sunset-tour.pages.dev and gives you an
  iframe block for the site.
#>
param(
    [Parameter(Mandatory=$true)][string]$Zip,
    [Parameter(Mandatory=$true)][string]$Name,     # slug, e.g. "boardwalk-sunset" - used in folder name + Cloudflare project name
    [Parameter(Mandatory=$true)][string]$Title     # human title, e.g. "Boardwalk at Sunset"
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$destDir = Join-Path $root "tour\$Name"
$projectName = "thocb-$Name-tour"

if (-not (Test-Path $Zip)) { throw "Zip not found: $Zip" }
if (Test-Path $destDir) { throw "tour\$Name already exists - pick a different -Name or remove it first." }

# -- Extract --------------------------------------------------------------
Write-Host "Extracting $Zip ..."
$tmp = Join-Path $env:TEMP "tour-extract-$([guid]::NewGuid())"
Expand-Archive -Path $Zip -DestinationPath $tmp

# 3DVista zips usually wrap everything in one top-level folder (e.g. "Published 3D Tour").
# Flatten that so tour\<name>\index.htm sits at the top.
$topItems = Get-ChildItem $tmp
if ($topItems.Count -eq 1 -and $topItems[0].PSIsContainer) {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Move-Item (Join-Path $topItems[0].FullName '*') $destDir
} else {
    New-Item -ItemType Directory -Force -Path $destDir | Out-Null
    Move-Item (Join-Path $tmp '*') $destDir
}
Remove-Item $tmp -Recurse -Force

$indexHtm = Join-Path $destDir 'index.htm'
if (-not (Test-Path $indexHtm)) { throw "Expected $indexHtm after extraction - is this a 3DVista export?" }

# -- Fix the "Untitled" title (both the <title> tag and the tour.name locale string) --
Write-Host "Setting title to `"$Title`" ..."
$fullTitle = "$Title - The Heart Of CB"
(Get-Content $indexHtm -Raw) -replace '<title>.*?</title>', "<title>$fullTitle</title>" |
    Set-Content $indexHtm -NoNewline

Get-ChildItem (Join-Path $destDir 'locale') -Filter '*.txt' -ErrorAction SilentlyContinue | ForEach-Object {
    (Get-Content $_.FullName -Raw) -replace 'tour\.name\s*=.*', "tour.name = $fullTitle" |
        Set-Content $_.FullName -NoNewline
}

# -- Cloudflare Pages: create project (ok if it already exists) + deploy --
# Wrapped in try/catch with ErrorAction Continue: PowerShell 5.1 treats a native command's
# stderr as a terminating NativeCommandError under $ErrorActionPreference = 'Stop', and an
# "already exists" response here (a normal re-deploy of an existing tour) is not a failure.
Write-Host "Creating Cloudflare Pages project '$projectName' (skips if it already exists) ..."
try {
    & npx wrangler pages project create $projectName --production-branch main --force 2>&1 |
        ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "(project create step reported an issue - normal if '$projectName' already exists; continuing to deploy)"
}

Write-Host "Deploying $destDir to Cloudflare Pages ..."
& npx wrangler pages deploy $destDir --project-name $projectName --commit-dirty=true

$url = "https://$projectName.pages.dev/index.htm"

Write-Host ""
Write-Host "Done! Tour live at: $url" -ForegroundColor Green
Write-Host ""
Write-Host "Paste this where you want it embedded (Explore CB page and/or homepage):"
Write-Host @"
<div class="tour-embed-wrap">
  <iframe src="$url" title="$Title" loading="lazy" allow="xr-spatial-tracking; gyroscope; accelerometer" allowfullscreen></iframe>
  <span class="tour-hint">&#128070; Drag &middot; Double-click fullscreen</span>
</div>
<a href="$url" target="_blank" rel="noopener" class="btn btn-navy btn-sm">Open Fullscreen &#8599;</a>
"@
