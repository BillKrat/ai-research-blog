param([string]$Repo,[string]$Out)
$root = "M:\Dev\repos\$Repo"
$files = git -C $root ls-files | Where-Object { $_ -match '\.(cs|csproj|props|xaml)$' -and $_ -notmatch '(^|/)(bin|obj|Migrations)/' }
$sb = New-Object System.Text.StringBuilder
$cur = ''
foreach ($f in $files) {
  $proj = ($f -split '/')[0..1] -join '/'
  if ($proj -ne $cur) { $cur = $proj; [void]$sb.AppendLine(""); [void]$sb.AppendLine("##### $proj") }
  $p = Join-Path $root $f
  $t = Get-Content $p -Raw -ErrorAction SilentlyContinue
  if (-not $t) { continue }
  $lines = ($t -split "`n").Count
  if ($f -like '*.csproj') {
    $refs = [regex]::Matches($t,'<(ProjectReference|PackageReference|FrameworkReference) Include="([^"]+)"') | ForEach-Object { ($_.Groups[1].Value -replace 'Reference','') + ':' + (Split-Path $_.Groups[2].Value -Leaf) }
    $sdk = [regex]::Match($t,'Sdk="([^"]+)"').Groups[1].Value
    [void]$sb.AppendLine("[csproj] $(Split-Path $f -Leaf) sdk=$sdk  $($refs -join ', ')")
    continue
  }
  $ns = [regex]::Match($t,'namespace\s+([\w\.]+)').Groups[1].Value
  $types = [regex]::Matches($t,'(?m)^\s*(?:public|internal)?\s*(?:sealed |static |abstract |partial |readonly )*(class|interface|record|enum|struct)\s+(\w+(?:<[^>]+>)?)(\s*\([^)]*\))?(?:\s*:\s*([^\r\n{]+))?') | ForEach-Object { "$($_.Groups[1].Value) $($_.Groups[2].Value)" + $(if($_.Groups[4].Value){" : "+$_.Groups[4].Value.Trim()}) }
  $us = [regex]::Matches($t,'(?m)^using\s+(?:static\s+)?(Adventures[\w\.]*|AiBlog[\w\.]*|Microsoft\.AspNetCore[\w\.]*|Npgsql[\w\.]*|System\.Data[\w\.]*|Microsoft\.Data[\w\.]*|System\.Windows[\w\.]*|Microsoft\.EntityFramework[\w\.]*);') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
  $sum = [regex]::Match($t,'///\s*<summary>\s*(?:///)?\s*([^\r\n]+)').Groups[1].Value.Trim()
  [void]$sb.AppendLine("$(Split-Path $f -Leaf) [$lines] ns=$ns | $($types -join '; ')")
  if ($sum) { [void]$sb.AppendLine("    doc: $sum") }
  if ($us) { [void]$sb.AppendLine("    uses: $($us -join ', ')") }
}
Set-Content -Path $Out -Value $sb.ToString() -Encoding utf8
"$Out : $((Get-Item $Out).Length) bytes"
