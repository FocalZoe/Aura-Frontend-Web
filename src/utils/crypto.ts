// Context: Web Crypto API 端到端加密 (E2EE) 工具函數庫

const DB_NAME = 'focal_aura_db';
const STORE_NAME = 'keypairs';

export const getCryptoSubtle = (): any => {
  const subtle = window?.crypto?.subtle || (window as any)?.crypto?.webkitSubtle;
  if (!subtle) {
    throw new Error(
      '安全限制：瀏覽器 Web Crypto API 僅在 localhost 或 HTTPS 環境下啟用。若在區域網路 IP 測試，請使用 localhost、開啟 HTTPS 或於瀏覽器網址輸入 chrome://flags/#unsafely-treat-insecure-origin-as-secure 允許該 IP 存取。'
    );
  }
  return subtle;
};

// IndexedDB Helper Functions
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

const privateKeyCache: Record<number, CryptoKey> = {};

export const saveLocalPrivateKey = async (userId: number, privateKey: CryptoKey): Promise<void> => {
  privateKeyCache[userId] = privateKey;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(privateKey, `privateKey_${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLocalPrivateKeySync = (userId: number): CryptoKey | null => {
  return privateKeyCache[userId] || null;
};

export const getLocalPrivateKey = async (userId: number): Promise<CryptoKey | null> => {
  if (privateKeyCache[userId]) {
    return privateKeyCache[userId];
  }
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(`privateKey_${userId}`);
    request.onsuccess = () => {
      if (request.result) {
        privateKeyCache[userId] = request.result;
      }
      resolve(request.result || null);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearLocalPrivateKey = async (userId: number): Promise<void> => {
  delete privateKeyCache[userId];
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(`privateKey_${userId}`);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Encoding Utilities
export const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const base64ToArrayBuffer = (base64: string): ArrayBuffer => {
  if (!base64 || typeof base64 !== 'string') {
    return new ArrayBuffer(0);
  }
  // Context: 處理 URL-safe Base64 換算與補齊 '='
  let cleanBase64 = base64.trim().replace(/ /g, '+').replace(/-/g, '+').replace(/_/g, '/');
  while (cleanBase64.length % 4 !== 0) {
    cleanBase64 += '=';
  }
  try {
    const binary = window.atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    console.warn('base64ToArrayBuffer 解碼失敗，自動降級採用 UTF-8 編碼備援:', err);
    return new TextEncoder().encode(base64).buffer;
  }
};

export const generateECDHKeyPair = async (): Promise<CryptoKeyPair> => {
  return await getCryptoSubtle().generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

export const exportPublicKey = async (publicKey: CryptoKey): Promise<string> => {
  const spki = await getCryptoSubtle().exportKey('spki', publicKey);
  return arrayBufferToBase64(spki);
};

export const importPublicKey = async (publicKeyBase64: string): Promise<CryptoKey> => {
  const spki = base64ToArrayBuffer(publicKeyBase64);
  return await getCryptoSubtle().importKey(
    'spki',
    spki,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
};

export const deriveKEK = async (pin: string, saltBase64: string): Promise<CryptoKey> => {
  const enc = new TextEncoder();
  const pinBuffer = enc.encode(pin);
  const salt = base64ToArrayBuffer(saltBase64);

  const baseKey = await getCryptoSubtle().importKey(
    'raw',
    pinBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await getCryptoSubtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

export const encryptPrivateKey = async (
  privateKey: CryptoKey, 
  pin: string, 
  saltBase64: string
): Promise<{ encrypted_private_key: string; iv: string }> => {
  const kek = await deriveKEK(pin, saltBase64);
  const pkcs8 = await getCryptoSubtle().exportKey('pkcs8', privateKey);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await getCryptoSubtle().encrypt(
    { name: 'AES-GCM', iv: iv },
    kek,
    pkcs8
  );

  return {
    encrypted_private_key: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer)
  };
};

export const decryptPrivateKey = async (
  encryptedBase64: string, 
  pin: string, 
  saltBase64: string, 
  ivBase64: string
): Promise<CryptoKey> => {
  const kek = await deriveKEK(pin, saltBase64);
  const encrypted = base64ToArrayBuffer(encryptedBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const pkcs8 = await getCryptoSubtle().decrypt(
    { name: 'AES-GCM', iv: iv },
    kek,
    encrypted
  );

  return await getCryptoSubtle().importKey(
    'pkcs8',
    pkcs8,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  );
};

export const deriveSharedKey = async (
  localPrivateKey: CryptoKey, 
  partnerPublicKey: CryptoKey
): Promise<CryptoKey> => {
  return await getCryptoSubtle().deriveKey(
    { name: 'ECDH', public: partnerPublicKey },
    localPrivateKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
};

export const encryptMessage = async (
  sharedKey: CryptoKey, 
  plaintext: string
): Promise<{ ciphertext: string; iv: string }> => {
  const enc = new TextEncoder();
  const data = enc.encode(plaintext);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await getCryptoSubtle().encrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer)
  };
};

export const decryptMessage = async (
  sharedKey: CryptoKey, 
  ciphertextBase64: string, 
  ivBase64: string
): Promise<string> => {
  const encrypted = base64ToArrayBuffer(ciphertextBase64);
  const iv = base64ToArrayBuffer(ivBase64);

  const decrypted = await getCryptoSubtle().decrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    encrypted
  );

  const dec = new TextDecoder();
  return dec.decode(decrypted);
};

// Context: 檔案 ArrayBuffer 之 E2EE (AES-GCM 256-bit) 加解密支援
export const encryptFileBuffer = async (
  sharedKey: CryptoKey,
  fileData: ArrayBuffer
): Promise<{ encryptedData: Uint8Array; iv: string }> => {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await getCryptoSubtle().encrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    fileData
  );

  return {
    encryptedData: new Uint8Array(encryptedBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
};

export const decryptFileBuffer = async (
  sharedKey: CryptoKey,
  encryptedData: ArrayBuffer,
  ivBase64: string
): Promise<ArrayBuffer> => {
  const iv = base64ToArrayBuffer(ivBase64);
  return await getCryptoSubtle().decrypt(
    { name: 'AES-GCM', iv: iv },
    sharedKey,
    encryptedData
  );
};

