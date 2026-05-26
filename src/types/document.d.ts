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
  /** 文档类型：'file' 代表普通 Markdown 文件，'folder' 代表文件夹 */
  type?: 'file' | 'folder';
  /** 父级文件夹 ID，若为 null 或者是空，代表存在于根目录中 */
  parentId?: string | null;
}
export interface KBDocumentMeta {
  id: string;
  title: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  updatedAt: number;
  createdAt: number;
  type?: 'file' | 'folder';
  parentId?: string | null;
}
