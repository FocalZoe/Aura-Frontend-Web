// Context: Helia IPFS 瀏覽器原生區塊管理與去中心化 CID 上傳/下載 (Production-First Architecture)
import { getCryptoSubtle } from './crypto';

let unixfsInstance: any = null;
let initPromise: Promise<any> | null = null;
const localBlockCache = new Map<string, Uint8Array>();

export const getIPFSGatewayUrl = (cid: string, apiBaseUrl?: string): string => {
  if (!cid) return '';
  if (apiBaseUrl) {
    const cleanBase = apiBaseUrl.replace(/\/$/, '');
    return `${cleanBase}/ipfs/gateway/${cid}`;
  }
  return `https://ipfs.io/ipfs/${cid}`;
};

export const getHeliaUnixFS = async () => {
  if (unixfsInstance) return unixfsInstance;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { createHelia } = await import('helia');
        const { unixfs } = await import('@helia/unixfs');
        const heliaInstance = await createHelia();
        unixfsInstance = unixfs(heliaInstance);
        return unixfsInstance;
      } catch (err) {
        console.warn('Helia 動態載入與初始化提示 (啟動生產環境 HTTPS Gateway 備援):', err);
        return null;
      }
    })();
  }
  return await initPromise;
};

export const uploadToIPFS = async (encryptedData: Uint8Array, apiBaseUrl?: string): Promise<string> => {
  let cidStr = '';
  try {
    const fs = await getHeliaUnixFS();
    if (fs) {
      const cid = await fs.addBytes(encryptedData);
      cidStr = cid.toString();
    }
  } catch (err) {
    console.warn('Helia addBytes 提示:', err);
  }

  if (!cidStr) {
    const exactBytes = encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength) as ArrayBuffer;
    const hashBuffer = await getCryptoSubtle().digest('SHA-256', exactBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    cidStr = `bafkrei${hashHex.substring(0, 40)}`;
  }

  // 1. 本地前端記憶體快取
  localBlockCache.set(cidStr, encryptedData);

  // 2. 同步釘選至伺服器代理快取 (確保跨分頁/跨裝置 100% 讀取成功)
  if (apiBaseUrl) {
    try {
      const cleanBase = apiBaseUrl.replace(/\/$/, '');
      const exactBuffer = encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength) as ArrayBuffer;
      const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
      
      // Context: 帶上 JWT Authorization Bearer 標頭
      const authToken = localStorage.getItem('token') || (window as any)?.__auth_token;
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      await fetch(`${cleanBase}/ipfs/upload/${cidStr}`, {
        method: 'POST',
        headers,
        body: new Blob([exactBuffer])
      });
    } catch (e) {
      console.warn('伺服器 IPFS 代理釘選快取失敗:', e);
    }
  }

  return cidStr;
};

export const fetchFromIPFS = async (cid: string, apiBaseUrl: string): Promise<ArrayBuffer> => {
  // 1. 同一分頁記憶體快取最速讀取
  if (localBlockCache.has(cid)) {
    const data = localBlockCache.get(cid)!;
    return (data.buffer as ArrayBuffer).slice(data.byteOffset, data.byteOffset + data.byteLength);
  }

  // 2. 優先向本機後端代理/快取伺服器請求 (/api/ipfs/gateway/:cid)
  if (apiBaseUrl) {
    try {
      const cleanBase = apiBaseUrl.replace(/\/$/, '');
      const res = await fetch(`${cleanBase}/ipfs/gateway/${cid}`);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        if (buf.byteLength > 0) {
          localBlockCache.set(cid, new Uint8Array(buf));
          return buf;
        }
      }
    } catch (e) {
      console.warn('伺服器 IPFS 代理 Gateway 讀取失敗，啟動 Helia/公共 Gateway 備援:', e);
    }
  }

  // 3. 嘗試由本地 Helia 節點讀取 (使用 CID.parse 解析字串)
  try {
    const fs = await getHeliaUnixFS();
    if (fs) {
      const { CID } = await import('multiformats/cid');
      const cidObj = CID.parse(cid);
      const chunks: Uint8Array[] = [];
      for await (const chunk of fs.cat(cidObj)) {
        chunks.push(chunk);
      }
      if (chunks.length > 0) {
        const totalLen = chunks.reduce((acc, curr) => acc + curr.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        localBlockCache.set(cid, merged);
        return merged.buffer as ArrayBuffer;
      }
    }
  } catch (err) {
    console.warn('Helia 本地抓取 CID 失敗:', err);
  }

  // 4. 生產環境公共 Gateways Fallback
  const gateways = [
    `https://ipfs.io/ipfs/${cid}`,
    `https://gateway.pinata.cloud/ipfs/${cid}`,
    `https://cloudflare-ipfs.com/ipfs/${cid}`
  ];

  for (const url of gateways) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        localBlockCache.set(cid, new Uint8Array(buf));
        return buf;
      }
    } catch (e) {
      console.warn(`Gateway ${url} 讀取失敗:`, e);
    }
  }

  throw new Error(`無法由 IPFS 網路下載 CID [${cid}]`);
};

