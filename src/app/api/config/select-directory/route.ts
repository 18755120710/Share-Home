import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import os from 'os';

export async function POST() {
  return new Promise((resolve) => {
    const platform = os.platform();
    let cmd = '';

    if (platform === 'win32') {
      // Windows: 使用 PowerShell 启动原生的 FolderBrowserDialog
      // 引入 TopMost 属性的透明 Form 并作为 ShowDialog 的参数，强制将弹窗显示在最前端以防被浏览器遮挡
      cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '选择默认文件及文档存储目录'; $f.ShowNewFolderButton = $true; $w = New-Object System.Windows.Forms.Form; $w.TopMost = $true; if ($f.ShowDialog($w) -eq 'OK') { Write-Output $f.SelectedPath }"`;
    } else if (platform === 'darwin') {
      // macOS: 使用 AppleScript 唤起 Finder 原生文件夹选择对话框
      cmd = `osascript -e 'POSIX path of (choose folder with prompt \"选择默认文件及文档存储目录\")'`;
    } else {
      // Linux: 兜底使用 zenity 对话框
      cmd = `zenity --file-selection --directory --title=\"选择默认文件及文档存储目录\"`;
    }

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        // 针对 macOS 用户点击“取消”操作抛出错误的完美优雅容错
        if (platform === 'darwin' && (error.message.includes('User canceled') || stderr.includes('User canceled'))) {
          resolve(NextResponse.json({ success: true, canceled: true }));
          return;
        }
        
        // 针对无 GUI 依赖或工具缺失情况进行友好回退捕获
        resolve(
          NextResponse.json(
            { 
              success: false, 
              error: `唤起系统资源管理器失败: ${error.message || stderr || '请检查系统组件是否支持弹窗，或直接手动输入路径。'}` 
            }, 
            { status: 500 }
          )
        );
        return;
      }

      const selectedPath = stdout.trim();
      if (!selectedPath) {
        // 用户关闭或取消了选择
        resolve(NextResponse.json({ success: true, canceled: true }));
      } else {
        resolve(NextResponse.json({ success: true, canceled: false, path: selectedPath }));
      }
    });
  });
}
