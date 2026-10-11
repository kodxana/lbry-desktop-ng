const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

// Read the volume containing the directory, including mounted folders and UNC shares.
// The path goes through stdin so it is never interpreted as PowerShell source.
const WINDOWS_QUERY = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DiskSpace {
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool GetDiskFreeSpaceExW(string directory,
        out ulong available, out ulong total, out ulong free);
}
'@
$directory = [Console]::In.ReadToEnd().TrimEnd('\\') + '\\'
[UInt64]$available = 0
[UInt64]$total = 0
[UInt64]$free = 0
if (-not [DiskSpace]::GetDiskFreeSpaceExW($directory, [ref]$available, [ref]$total, [ref]$free)) {
    throw (New-Object System.ComponentModel.Win32Exception)
}
@{ total = $total; free = $available } | ConvertTo-Json -Compress
`;

function validateSpace(total, free) {
  if (!Number.isSafeInteger(total) || !Number.isSafeInteger(free) || total <= 0 || free < 0 || free > total) {
    throw new Error('Invalid disk space information.');
  }
  return { total, free };
}

function parseWindowsSpace(output) {
  const { total, free } = JSON.parse(output.replace(/^\uFEFF/, ''));
  validateSpace(total, free);
  return validateSpace(Math.floor(total / 1024), Math.floor(free / 1024));
}

function parsePosixSpace(output) {
  const rows = output.trim().split(/\r?\n/);
  const match = rows.length === 2 && rows[1].match(/\s+(\d+)\s+\d+\s+(-?\d+)\s+\d+%\s+.+$/);
  if (!match) throw new Error('Invalid disk space information.');
  // Reserved filesystem blocks can make df report negative available space.
  return validateSpace(Number(match[1]), Math.max(0, Number(match[2])));
}

async function getDiskSpace(directory) {
  const resolved = await fs.promises.realpath(directory);
  if (!(await fs.promises.stat(resolved)).isDirectory()) throw new Error('Storage path is not a directory.');
  const windows = process.platform === 'win32';
  const executable = windows
    ? path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    : 'df';
  const args = windows
    ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(WINDOWS_QUERY, 'utf16le').toString('base64')]
    : ['-kP', resolved];
  return new Promise((resolve, reject) => {
    const child = execFile(executable, args, {
      windowsHide: true, timeout: 10000, maxBuffer: 65536, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' },
    }, (error, stdout) => {
      if (error) return reject(new Error('Could not read free space for the storage directory.'));
      try { resolve(windows ? parseWindowsSpace(stdout) : parsePosixSpace(stdout)) } catch (error) { reject(error) }
    });
    child.stdin.on('error', () => {}); // execFile reports launch failures through its callback.
    child.stdin.end(windows ? resolved : undefined);
  });
}

module.exports = { getDiskSpace, parseWindowsSpace, parsePosixSpace };
