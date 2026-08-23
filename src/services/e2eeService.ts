import { Message, GroupMessage } from '../types';
import {
  getLocalPrivateKey,
  importPublicKey,
  deriveSharedKey,
  decryptMessage,
  encryptMessage,
  deriveKEK,
} from '../utils/crypto';
import { apiClient } from './apiClient';
import { useChatStore } from '../stores/useChatStore';

const parseIPFSMessage = <T extends Message | GroupMessage>(msg: T): T => {
  if (msg.content && msg.content.startsWith('[IPFS_FILE]')) {
    try {
      const jsonStr = msg.content.substring('[IPFS_FILE]'.length);
      const payload = JSON.parse(jsonStr);
      return { ...msg, filePayload: payload };
    } catch (e) {
      console.error('IPFS 訊息 Payload 解析失敗:', e);
    }
  }
  return msg;
};

class E2EEService {
  private sharedKeysCache: Record<number, CryptoKey> = {};
  private groupKeysCache: Record<number, CryptoKey> = {};

  clearCache() {
    this.sharedKeysCache = {};
    this.groupKeysCache = {};
  }

  async encryptAESGCM(plaintext: string, key: CryptoKey): Promise<{ ciphertext: string; iv: string }> {
    const res = await encryptMessage(key, plaintext);
    return { ciphertext: res.ciphertext, iv: res.iv || '' };
  }

  async decryptAESGCM(ciphertext: string, iv: string, key: CryptoKey): Promise<string> {
    return await decryptMessage(key, ciphertext, iv);
  }

  async getSharedKey(partnerId: number, currentUserId: number, token: string): Promise<CryptoKey | null> {
    if (this.sharedKeysCache[partnerId]) return this.sharedKeysCache[partnerId];
    try {
      const privateKey = await getLocalPrivateKey(currentUserId);
      if (!privateKey) return null;
      let partnerPublicKeyBase64: string | undefined = useChatStore.getState().friendsMap[partnerId];
      if (!partnerPublicKeyBase64) {
        partnerPublicKeyBase64 = await this.fetchUserPublicKey(partnerId, token);
      }
      if (!partnerPublicKeyBase64) return null;
      const partnerPublicKey = await importPublicKey(partnerPublicKeyBase64);
      const sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);
      this.sharedKeysCache[partnerId] = sharedKey;
      return sharedKey;
    } catch {
      return null;
    }
  }

  // Context: [E2EE群組加密] 結合動態群組 Salt 與 Epoch 版本推導群組對稱密鑰
  async getGroupKey(groupId: number, epoch: number = 1): Promise<CryptoKey> {
    const cacheKey = `${groupId}_ep${epoch}`;
    if ((this.groupKeysCache as any)[cacheKey]) {
      return (this.groupKeysCache as any)[cacheKey];
    }
    const rawSalt = `focal_aura_group_v2_${groupId}_ep${epoch}_salt`;
    const saltBase64 = window.btoa(rawSalt);
    const key = await deriveKEK(`focal_group_sec_${groupId}_ep${epoch}_${rawSalt}`, saltBase64);
    (this.groupKeysCache as any)[cacheKey] = key;
    return key;
  }

  async encryptGroupMessage(groupId: number, plaintext: string, epoch: number = 1): Promise<{ ciphertext: string; iv: string }> {
    const groupKey = await this.getGroupKey(groupId, epoch);
    const res = await encryptMessage(groupKey, plaintext);
    return { ciphertext: res.ciphertext, iv: res.iv || '' };
  }

  async decryptSingleGroupMessage(msg: GroupMessage, groupId: number, epoch: number = 1): Promise<GroupMessage> {
    if (!msg.iv || msg.is_system) return msg;
    try {
      const groupKey = await this.getGroupKey(groupId, epoch);
      const plaintext = await decryptMessage(groupKey, msg.content, msg.iv);
      return parseIPFSMessage({ ...msg, content: plaintext, decrypted: true });
    } catch (err) {
      console.error('群組訊息解密失敗:', err);
      return { ...msg, content: '[無法解密此群組訊息]', error: true };
    }
  }

  async decryptGroupMessages(messages: GroupMessage[], groupId: number, epoch: number = 1): Promise<GroupMessage[]> {
    const groupKey = await this.getGroupKey(groupId, epoch);
    return Promise.all(
      messages.map(async (m) => {
        if (!m.iv || m.is_system) return m;
        try {
          const plaintext = await decryptMessage(groupKey, m.content, m.iv);
          return parseIPFSMessage({ ...m, content: plaintext, decrypted: true });
        } catch (e) {
          return { ...m, content: '[無法解密此群組訊息]', error: true };
        }
      })
    );
  }

  async fetchUserPublicKey(userId: number, token: string): Promise<string | undefined> {
    const chatStore = useChatStore.getState();
    if (chatStore.friendsMap[userId]) {
      return chatStore.friendsMap[userId];
    }
    try {
      const data = await apiClient.get<{ public_key?: string }>(`/users/${userId}/public-key`, token);
      if (data && data.public_key) {
        chatStore.setFriendsMap({ ...chatStore.friendsMap, [userId]: data.public_key });
        return data.public_key;
      }
    } catch (e) {
      console.error('抓取使用者公鑰失敗:', e);
    }
    return undefined;
  }

  async decryptSingleMessage(msg: Message, currentUserId: number, token: string): Promise<Message> {
    if (!msg.iv || !currentUserId) return msg;

    try {
      const privateKey = await getLocalPrivateKey(currentUserId);
      if (!privateKey) {
        return { ...msg, content: '[請先設定 PIN 碼以存取對話]', error: true };
      }

      const receiverId = msg.receiver_id || msg.to;
      if (!receiverId) {
        return { ...msg, content: '[無法讀取訊息]', error: true };
      }

      const partnerId = msg.sender_id === currentUserId ? receiverId : msg.sender_id;
      let partnerPublicKeyBase64: string | undefined = useChatStore.getState().friendsMap[partnerId];
      if (!partnerPublicKeyBase64) {
        partnerPublicKeyBase64 = await this.fetchUserPublicKey(partnerId, token);
      }

      if (!partnerPublicKeyBase64) {
        return { ...msg, content: '[對話初始化中...]', error: true };
      }

      let sharedKey = this.sharedKeysCache[partnerId];
      if (!sharedKey) {
        const partnerPublicKey = await importPublicKey(partnerPublicKeyBase64);
        sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);
        this.sharedKeysCache[partnerId] = sharedKey;
      }

      const plaintext = await decryptMessage(sharedKey, msg.content, msg.iv);
      const decryptedMsg = { ...msg, content: plaintext, receiver_id: receiverId, decrypted: true };
      return parseIPFSMessage(decryptedMsg);
    } catch (err) {
      console.error('即時訊息讀取失敗:', err);
      return { ...msg, content: '[無法讀取此訊息]', error: true };
    }
  }

  async decryptHistoryMessages(messages: Message[], currentUserId: number, partnerId: number, token: string): Promise<Message[]> {
    let partnerPublicKeyBase64: string | undefined = useChatStore.getState().friendsMap[partnerId];
    if (!partnerPublicKeyBase64) {
      partnerPublicKeyBase64 = await this.fetchUserPublicKey(partnerId, token);
    }

    const privateKey = await getLocalPrivateKey(currentUserId);
    if (!privateKey || !partnerPublicKeyBase64) {
      return messages.map((m) => parseIPFSMessage({
        ...m,
        content: !m.iv ? m.content : '[請先輸入 PIN 碼解鎖對話]',
      }));
    }

    let sharedKey = this.sharedKeysCache[partnerId];
    if (!sharedKey) {
      try {
        const partnerPublicKey = await importPublicKey(partnerPublicKeyBase64);
        sharedKey = await deriveSharedKey(privateKey, partnerPublicKey);
        this.sharedKeysCache[partnerId] = sharedKey;
      } catch (e) {
        console.error('歷史金鑰衍生失敗:', e);
      }
    }

    return Promise.all(
      messages.map(async (m) => {
        if (!m.iv) return parseIPFSMessage(m);
        if (!sharedKey) return { ...m, content: '[對話初始化中...]', error: true };
        try {
          const plaintext = await decryptMessage(sharedKey, m.content, m.iv);
          const decryptedMsg = { ...m, content: plaintext, decrypted: true };
          return parseIPFSMessage(decryptedMsg);
        } catch (e) {
          return { ...m, content: '[舊對話記錄已保護或無法檢視]', error: true };
        }
      })
    );
  }
}

export const e2eeService = new E2EEService();
