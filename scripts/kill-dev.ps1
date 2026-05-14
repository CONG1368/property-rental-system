# 强制清理所有开发相关残留进程
$ErrorActionPreference = "SilentlyContinue"
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | ForEach-Object {
    $cmd = $_.CommandLine
    if ($cmd -like '*tsx*' -or $cmd -like '*concurrently*' -or $cmd -like '*vite*' -or $cmd -like '*kill-port*') {
        Write-Host "Killing PID $($_.ProcessId): $($cmd.Substring(0, [Math]::Min(120, $cmd.Length)))..."
        Stop-Process -Id $_.ProcessId -Force
    }
}
# 再补一刀：直接杀端口占用
$ports = @(3001, 5173)
foreach ($p in $ports) {
    $conn = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($conn) {
        $owner = $conn.OwningProcess
        Write-Host "Killing PID $owner on port $p"
        Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
    }
}
Write-Host "Cleanup done."
