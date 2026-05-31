import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const LOGS_FILE = path.join(process.cwd(), 'storage', 'activity_logs.json');

// 强制防御：确保存储目录和底层物理 JSON 文件存在
function ensureLogsFile() {
  const dir = path.dirname(LOGS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOGS_FILE)) {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([]));
  }
}

/**
 * GET 请求：拉取所有的操作审计日志
 */
export async function GET() {
  try {
    ensureLogsFile();
    const data = fs.readFileSync(LOGS_FILE, 'utf8');
    const logs = JSON.parse(data || '[]');
    // 强制按发生时间倒序排列，保证最新的记录在最上方呈现
    logs.sort((a: any, b: any) => b.timestamp - a.timestamp);
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('[Logs API] 获取日志失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}

/**
 * POST 请求：写入一条新操作日志，或执行记录抹除
 */
export async function POST(req: NextRequest) {
  try {
    ensureLogsFile();
    const body = await req.json();

    // 1. 处理“清空物理记录”指令
    if (body.action === 'clear') {
      const data = fs.readFileSync(LOGS_FILE, 'utf8');
      const logs = JSON.parse(data || '[]');
      
      const typeToClear = body.type; // 'share' | 'document' 等
      if (typeToClear) {
        // 分类清除：只过滤掉指定类型的操作审计日志
        const filtered = logs.filter((l: any) => l.type !== typeToClear);
        fs.writeFileSync(LOGS_FILE, JSON.stringify(filtered, null, 2));
        console.log(`[Logs API] 已清空分类为 ${typeToClear} 的全部历史记录`);
      } else {
        // 全盘彻底抹除
        fs.writeFileSync(LOGS_FILE, JSON.stringify([]));
        console.log('[Logs API] 已物理清空所有的历史操作记录');
      }
      return NextResponse.json({ success: true });
    }

    // 2. 处理常规的日志上报指令
    if (!body.type || !body.action || !body.title) {
      return NextResponse.json(
        { success: false, error: '缺少关键的日志字段参数' },
        { status: 400 }
      );
    }

    const data = fs.readFileSync(LOGS_FILE, 'utf8');
    const logs = JSON.parse(data || '[]');
    
    // 生成一条完整的标准审计日志结构
    const newLog = {
      id: body.id || Math.random().toString(36).substring(2, 11),
      type: body.type, // 'share' | 'document'
      action: body.action, // 'upload', 'create_doc', 'create_folder'
      title: body.title,
      operator: body.operator || '未知对等端',
      avatar: body.avatar || '💻',
      details: body.details || {},
      timestamp: body.timestamp || Date.now()
    };

    // 限制最大历史积攒数为 1000 条，物理断绝胀大风险
    const updatedLogs = [newLog, ...logs].slice(0, 1000);
    fs.writeFileSync(LOGS_FILE, JSON.stringify(updatedLogs, null, 2));

    return NextResponse.json({ success: true, log: newLog });
  } catch (error: any) {
    console.error('[Logs API] 提交写入日志失败:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}
