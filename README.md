# Aura Frontend Web

<p align="center">
  <strong>高安全性、去中心化檔案傳輸、端到端加密 (E2EE) 與即時音視訊通話 (WebRTC) 之現代化通訊協作前端</strong>
</p>

---

## 🌟 核心特色 (Core Features)

- 🔒 **端到端加密通訊 (End-to-End Encryption)**：
  - 基於 Web Crypto API 實作 ECDH (P-256) 金鑰協商與 AES-GCM (256-bit) 訊息加密。
  - 支援一對一私密對話與群組動態 Salt 金鑰推導隔離。
- 📞 **WebRTC 即時音視訊通話 (Real-time WebRTC Audio/Video Calls)**：
  - 模組化 `ICallEngine` / `PeerToPeerCallEngine` 雙引擎抽象層，支援未來多平台（Flutter / Tauri）100% 邏輯複用。
  - 具備 STUN 穿透、PiP 畫中畫浮窗、通話中動態攝影機/麥克風切換與 Web Audio 合成諧音鈴聲。
  - 實作「發起方單一權威紀錄 (Authoritative Caller Record)」原則，徹底杜絕重複通話紀錄。
- 🌐 **去中心化檔案儲存 (IPFS Decentralized Storage)**：
  - 前端 Helia (`@helia/unixfs`) 區塊讀取與後端 IPFS Gateway 雙重代理容錯機制。
  - 支援圖片檔案預覽卡片與安全下載。
- 👥 **全方位隱私防護與關係鏈 (Privacy & Relationship Management)**：
  - 好友邀請與即時審核體系。
  - 雙向封鎖/黑名單隔離與陌生人訊息專屬分流。
  - 單方對話軟刪除資料隔離 (`DeletedForUserID`)。
- 🎨 **現代化玻璃擬態設計系統 (Modern Glassmorphism UI)**：
  - 深色玻璃擬態 (Dark Glassmorphism) 視覺風格與流暢 Keyframe 微動畫。
  - 全域唯一 CSS SSOT (`src/styles/global.css`) 整合 Design Tokens。
  - 全站 100% 採用 CSS Modules (`*.module.css`) 進行樣式隔離。
  - 通用 `BaseModal` 彈窗 Primitive 封裝，搭配 React Portal 與 Z-Index 分層體系 (Level 1 ~ Level 5)。
- ⚡ **純淨響應式狀態管理 (Zero-Debt React Reactive State)**：
  - 全站採用 Zustand 5 管理訊息、好友、通話狀態機與模態視窗。
  - WebSocket 事件直接驅動 Zustand Store，全面廢除 DOM Event Bus 與全頁 HTTP 重刷。

---

## 🛠️ 技術棧 (Tech Stack)

| 領域 | 核心技術與庫 | 說明 |
| :--- | :--- | :--- |
| **核心框架** | [React 19](https://react.dev/) + [TypeScript 7](https://www.typescriptlang.org/) | 現代化 UI 框架與嚴格型別安全 |
| **構建工具** | [Vite 8](https://vite.dev/) | 極速 HMR 開發伺服器與 Rollup/Rolldown 打包 |
| **狀態管理** | [Zustand 5](https://github.com/pmndrs/zustand) | 輕量高擴充全域狀態機與 Selector 響應式訂閱 |
| **即時通訊** | 原生 WebSocket + WebRTC API | 即時訊息推播、連線狀態維護與 P2P 影音串流 |
| **分散式檔案** | [Helia](https://github.com/ipfs/helia) (`@helia/unixfs`) | 現代化瀏覽器原生 IPFS 節點與檔案解析 |
| **圖標元件** | [Lucide React](https://lucide.dev/) | 簡潔現代化 SVG 圖標庫 |
| **代碼檢查** | [Oxlint](https://oxc.rs/) | 高效能 Rust 驅動之 Linter 檢查工具 |

---

## 📁 目錄架構 (Project Structure)

```text
Frontend-web/
├── public/                  # 靜態資源與 SVG 圖標
├── src/
│   ├── assets/              # 靜態圖片與視覺資源
│   ├── components/          # UI 元件目錄
│   │   ├── Call/            # WebRTC 通話彈窗 (CallModal)
│   │   ├── chat/            # 聊天室元件 (Header, Input, MessageBubble, IPFSCard)
│   │   ├── common/          # 通用元件 (BaseModal)
│   │   ├── settings/        # 設定分頁 (Profile, Notification, PIN, Blocked)
│   │   ├── sidebar/         # 側邊欄元件 (FriendList, Tabs, ContextMenu)
│   │   └── *.tsx            # 獨立業務彈窗與主組件 (Login, Sidebar, ChatWindow)
│   ├── context/             # React Contexts (Auth, Socket, Theme, Toast, Notification)
│   ├── services/            # 外部服務抽象層 (apiClient, e2eeService, webrtcService, websocketService)
│   ├── stores/              # Zustand 全域狀態 (useChatStore, useCallStore, useAuthStore, useUIStore)
│   ├── styles/              # 全域樣式 SSOT (global.css, tokens.module.css)
│   ├── types/               # 全域 TypeScript 型別定義 (index.ts)
│   ├── utils/               # 工具庫 (audio, crypto, ipfs, notification)
│   ├── App.tsx              # 應用主入口與彈窗掛載容器
│   └── main.tsx             # React DOM Root 渲染入口
├── .env.example             # 環境變數設定範本
├── package.json             # 依賴與執行腳本定義
├── tsconfig.json            # TypeScript 編譯配置
└── vite.config.ts           # Vite 構建設定
```

---

## 🚀 快速上手 (Getting Started)

### 1. 環境需求
- [Node.js](https://nodejs.org/) (建議 Node.js 18+ 或 20+)
- npm / pnpm / yarn

### 2. 安裝依賴
```bash
npm install
```

### 3. 環境變數配置 (選用)
複製 `.env.example` 為 `.env`：
```bash
cp .env.example .env
```
> **提示**：若未指定 `VITE_API_BASE_URL` 與 `VITE_WS_URL`，系統於執行時會自動偵測連線主機之 Hostname / IP，無縫支援區網與行動裝置測試。

### 4. 啟動開發伺服器
```bash
npm run dev
```
啟動後瀏覽器開啟 `http://localhost:5173`。

### 5. 專案建置與型別檢查
```bash
# TypeScript 嚴格型別校驗
npx tsc --noEmit

# 正式發布版本打包
npm run build

# 預覽打包產物
npm run preview
```

---

## 📜 授權條款 (License)

本專案採用 MIT 授權條款。
