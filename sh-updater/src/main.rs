use std::env;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;
use std::fs::OpenOptions;
use std::io::Write;

fn main() {
    // 获取临时目录下的升级日志路径，用来保存 Rust 升级日志
    let temp_dir = env::temp_dir();
    let log_path = temp_dir.join("share-home-upgrade.log");
    
    let mut log_file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
        .ok();

    let mut log = |msg: &str| {
        let time = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!("[RUST-UPDATER] [{}] {}\n", time, msg);
        println!("{}", msg);
        if let Some(ref mut f) = log_file {
            let _ = f.write_all(line.as_bytes());
        }
    };

    log("=== Share Home Rust 原生提权升级伴生器已启动 ===");

    // 解析参数
    let args: Vec<String> = env::args().collect();
    let mut launcher_path = String::new();
    let mut launcher_args_str = String::new();

    for i in 1..args.len() {
        if args[i] == "--launcher-path" && i + 1 < args.len() {
            launcher_path = args[i + 1].clone();
        } else if args[i] == "--launcher-args" && i + 1 < args.len() {
            launcher_args_str = args[i + 1].clone();
        }
    }

    log(&format!("当前平台: {}", env::consts::OS));
    log("正在睡眠 2 秒等待父进程完全退出释放文件锁...");
    thread::sleep(Duration::from_secs(2));

    log("开始执行跨平台原生提权物理重装...");
    
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("powershell.exe");
        c.args(&["-Command", "Start-Process cmd -ArgumentList '/c npm install -g share-home@latest' -Verb RunAs -Wait"]);
        c
    } else if cfg!(target_os = "macos") {
        let mut c = Command::new("osascript");
        c.args(&["-e", "do shell script \"npm install -g share-home@latest\" with administrator privileges"]);
        c
    } else {
        // Linux 平台优先使用 pkexec
        let mut c = Command::new("pkexec");
        c.args(&["npm", "install", "-g", "share-home@latest"]);
        c
    };

    let status = cmd.status();

    match status {
        Ok(s) if s.success() => {
            log("🎉 跨平台物理特权升级成功，退出码 0！");
            log("正在使用原启动参数拉起新版本主协同服务...");
            
            // 解析原启动参数 (手动解析极简 JSON 数组，免去外部 crate 依赖)
            let clean_json = launcher_args_str.trim_matches(|c| c == '[' || c == ']');
            let launcher_args: Vec<String> = if !clean_json.is_empty() {
                clean_json
                    .split(',')
                    .map(|s| s.trim().trim_matches('"').to_string())
                    .collect()
            } else {
                vec![]
            };

            // 拉起服务
            let mut sub_cmd = if !launcher_path.is_empty() && std::path::Path::new(&launcher_path).exists() {
                let mut c = Command::new("node");
                c.arg(&launcher_path);
                c.args(&launcher_args);
                c
            } else {
                let mut c = Command::new("share-home");
                c.args(&launcher_args);
                c
            };

            #[cfg(unix)]
            {
                use std::os::unix::process::CommandExt;
                sub_cmd.stdin(Stdio::null())
                       .stdout(Stdio::null())
                       .stderr(Stdio::null())
                       .process_group(0);
            }
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                const DETACHED_PROCESS: u32 = 0x00000008;
                sub_cmd.creation_flags(DETACHED_PROCESS)
                       .stdin(Stdio::null())
                       .stdout(Stdio::null())
                       .stderr(Stdio::null());
            }

            match sub_cmd.spawn() {
                Ok(_) => {
                    log("🎉 协同服务已成功在后台脱钩拉起，本伴生器退出。");
                    std::process::exit(0);
                }
                Err(err) => {
                    log(&format!("❌ 重新拉起主协同服务失败: {}", err));
                    std::process::exit(1);
                }
            }
        }
        Ok(s) => {
            log(&format!("❌ 提权安装物理重装失败，进程退出状态: {}", s));
            std::process::exit(1);
        }
        Err(err) => {
            log(&format!("❌ 唤起系统提权进程发生严重异常: {}", err));
            std::process::exit(1);
        }
    }
}
