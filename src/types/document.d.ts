export interface KBDocument {
  /** 文档唯一 ID */
  id: string;
  /** 文档标题 */
  title: string;
  /** 文档 Markdown 混合内容 */
  content: string;
  /** 创建者或最近修改的 Peer ID */
  senderId: string;
  /** 创建者或最近修改的 Peer 昵称 */
  senderName: string;
  /** 创建者或最近修改的 Peer 头像 */
  senderAvatar: string;
  /** 最近更新时间戳 */
  updatedAt: number;
  /** 创建时间戳 */
  createdAt: number;
}
export interface KBDocumentMeta {
  id: string;
  title: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  updatedAt: number;
  createdAt: number;
}
