export type BoardMessageType = 'text' | 'gist';

export interface BoardMessage {
  /** 消息唯一 ID */
  id: string;
  /** 发送者 Peer ID */
  senderId: string;
  /** 发送者昵称 */
  senderName: string;
  /** 发送者头像代号 */
  senderAvatar: string;
  /** 消息类型: 'text' (Markdown富文本) | 'gist' (高亮代码片段) */
  type: BoardMessageType;
  /** 消息核心内容 */
  content: string;
  /** 代码语言种类 (仅在 type 为 'gist' 时有效, 例如 'javascript', 'python', 'cpp', 'html') */
  gistLanguage?: string;
  /** 发布时间戳 */
  timestamp: number;
}
