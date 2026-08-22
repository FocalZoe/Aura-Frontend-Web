// TEAM_005: 使用者資料與認證介面重構
export interface User {
  id: number;
  email: string;
  account_id: string; // 帳號 ID (例如: alex_dev)
  display_name?: string; // 帳號顯示名稱 (例如: Alex Chen)
  avatar?: string; // TEAM_014: 個人大頭貼選填屬性
  provider?: string;
  public_key?: string;
  has_backup_key?: boolean;
  key_salt?: string;
  encrypted_private_key?: string;
  created_at?: string;
}

// TEAM_005: Notification Model 與 Options 介面定義 (完全取代舊 ToastContext)
export type NotificationType = 'danger' | 'warning' | 'info' | 'success';

export interface NotificationModel {
  id: string;
  type: NotificationType;       // 訊息類型：危險 (danger)、警告 (warning)、資訊 (info)、良好 (success)
  title?: string;                // 選填標題
  message: string;              // 主要提示訊息
  withSound: boolean;           // 有無提醒音 (預設 false: 靜音)
  persistent: boolean;          // 是否永久顯示 (預設 false: 倒數關閉)
  duration: number;             // 自動倒數關閉時長 (預設 4000ms)
}

export interface NotificationOptions {
  message: string;
  type?: NotificationType;
  title?: string;
  withSound?: boolean;
  persistent?: boolean;
  duration?: number;
}

export interface NotificationContextType {
  notify: (options: NotificationOptions | string, type?: NotificationType) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

// TEAM_003: IPFS 檔案傳輸 Payload 結構
export interface IPFSFilePayload {
  cid: string;
  name: string;
  size: number;
  mime: string;
  encrypted: boolean;
  iv?: string;
}

export interface Message {
  id?: number;
  type?: string;
  sender_id: number;
  receiver_id?: number;
  to?: number;
  content: string;
  iv?: string;
  timestamp: string;
  decrypted?: boolean;
  error?: boolean;
  filePayload?: IPFSFilePayload;
}

export interface WSMessage {
  id?: number;
  type: string;
  sender_id?: number;
  to?: number;
  group_id?: number;
  action?: string;
  user_id?: number;
  account_id?: string;
  display_name?: string;
  content?: string;
  iv?: string;
  timestamp?: string;
}

export interface Friendship {
  id: number;
  user_id: number;
  friend_id: number;
  status: 'pending' | 'accepted';
  created_at?: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (accountOrEmail: string, password: string) => Promise<User>;
  register: (email: string, password: string, accountId: string, displayName?: string) => Promise<any>;
  oauthLogin: (provider: 'google' | 'apple', providerId: string, email: string, accountId?: string, displayName?: string) => Promise<any>;
  logout: () => void;
  updateUser: (updatedFields: Partial<User>) => void;
  API_BASE: string;
}

export interface SocketContextType {
  socket: WebSocket | null;
  onlineUsers: number[];
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  sendChatMessage: (toUserId: number, partnerPublicKeyBase64: string | undefined, content: string) => Promise<void>;
  isUserOnline: (userId: number) => boolean;
  loadChatHistory: (partnerId: number) => Promise<void>;
  fetchFriendsMap: () => Promise<void>;
  fetchUserPublicKey: (userId: number) => Promise<string | undefined>;
  activeChatUser: User | null;
  setActiveChatUser: React.Dispatch<React.SetStateAction<User | null>>;
  unreadCounts: Record<number, number>;
  markChatAsRead: (userId: number) => void;
  strangers: User[];
  addStrangerUser: (stranger: User, isSent?: boolean) => void;
  incomingStrangerUsers: User[];
  sentStrangerUsers: User[];
}

export interface ThemeContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

// TEAM_007: 群組與封鎖模型介面定義
export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  role: 'owner' | 'member';
  status?: 'accepted' | 'pending' | 'removed' | 'rejected'; // TEAM_009: 成員狀態
  joined_at: string;
  user?: User;
}

export interface Group {
  id: number;
  name: string;
  owner_id: number;
  created_at: string;
  members?: GroupMember[];
  is_removed?: boolean;
}

export interface GroupMessage {
  id: number;
  group_id: number;
  sender_id: number;
  content: string;
  iv: string;
  timestamp: string;
  sender?: User;
  decrypted?: boolean;
  error?: boolean;
}

export interface BlockedUser {
  id: number;
  user_id: number;
  blocked_user_id: number;
  created_at?: string;
  blocked_user?: User;
}
