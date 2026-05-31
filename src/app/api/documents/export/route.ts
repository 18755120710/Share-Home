import { NextRequest, NextResponse } from 'next/server';
// @ts-ignore
import HTMLtoDOCX from 'html-to-docx';

export async function POST(req: NextRequest) {
  try {
    const { title, html } = await req.json();

    if (!html) {
      return NextResponse.json(
        { success: false, error: '导出内容不能为空' },
        { status: 400 }
      );
    }

    // 拼装一个包含基本 CSS 排版样式的完整 HTML 页面，提高 Word 打开时的排版审美和易读性
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: 'PingFang SC', 'Microsoft YaHei', 'Arial', sans-serif;
            color: #1f2937;
            line-height: 1.6;
          }
          h1 {
            color: #1e3a8a;
            font-size: 22pt;
            margin-bottom: 12pt;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 6pt;
          }
          h2 {
            color: #1e40af;
            font-size: 16pt;
            margin-top: 18pt;
            margin-bottom: 8pt;
          }
          h3 {
            color: #2563eb;
            font-size: 13pt;
            margin-top: 14pt;
            margin-bottom: 6pt;
          }
          p {
            font-size: 10.5pt;
            margin-bottom: 8pt;
          }
          ul, ol {
            margin-bottom: 10pt;
            padding-left: 20pt;
          }
          li {
            font-size: 10.5pt;
            margin-bottom: 4pt;
          }
          blockquote {
            border-left: 3px solid #3b82f6;
            padding-left: 10px;
            color: #4b5563;
            background-color: #f3f4f6;
            margin: 10pt 0;
            font-style: italic;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin: 12pt 0;
          }
          th, td {
            border: 1px solid #d1d5db;
            padding: 8px;
            font-size: 10pt;
          }
          th {
            background-color: #f3f4f6;
            font-weight: bold;
          }
          pre {
            background-color: #f3f4f6;
            border: 1px solid #e5e7eb;
            padding: 10px;
            margin: 12pt 0;
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 9.5pt;
          }
          code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 9.5pt;
            background-color: #f3f4f6;
            padding: 2px 4px;
          }
        </style>
      </head>
      <body>
        <h1>${title || '未命名云文档'}</h1>
        ${html}
      </body>
      </html>
    `;

    // 调用 html-to-docx 转换为二进制 DOCX Buffer
    const fileBuffer = await HTMLtoDOCX(fullHtml, null, {
      table: { row: { cantSplit: true } },
      footer: true,
      header: true,
      pageNumber: true,
    });

    // 返回二进制 DOCX 数据响应，让前端能作为附件下载
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(title || 'document')}.docx"`,
      },
    });
  } catch (error: any) {
    console.error('[Export API] 导出 DOCX 接口报错:', error);
    return NextResponse.json(
      { success: false, error: error.message || '服务器内部错误' },
      { status: 500 }
    );
  }
}
