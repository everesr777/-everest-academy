$path = "user/src/pages/AffiliatePage.jsx"
$c = Get-Content $path -Raw -Encoding UTF8
if ($c -notmatch "showPrevWeek") {
  $old = "const [weeklyLoading, setWeeklyLoading] = useState(false);"
  $new = "const [weeklyLoading, setWeeklyLoading] = useState(false);`r`n  const [prevWeekly, setPrevWeekly] = useState(null);`r`n  const [showPrevWeek, setShowPrevWeek] = useState(false);`r`n  const [prevWeekLoading, setPrevWeekLoading] = useState(false);"
  $c = $c.Replace($old, $new)
  Set-Content -Path $path -Value $c -Encoding UTF8 -NoNewline
  "added"
} else { "exists" }
