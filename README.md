# 商用英文 4000（biz-english-4000）

以通訊電信產業為主的商務英文單字卡網頁 App，介面為繁體中文（台灣用語），手機直式優先。純靜態檔案、原生 JavaScript，不需要任何建置工具或套件。

## 功能

- **新手引導**：設定每日新字目標（預設 20）、選擇學習分類（預設從「通訊電信」開始）
- **單字卡**：點擊翻面，四個評分按鈕「忘記／困難／良好／簡單」，按鈕上直接顯示下次複習間隔；可復原上一張
- **SM-2 間隔重複**：答錯的字會在同一輪隔幾張再出現一次；「困難」「簡單」會微調間隔；間隔達 21 天以上算「熟練」
- **每日目標**：新字依設定的數量出，複習量依到期的字自動排入
- **首頁儀表板**：今日進度、已學、熟練、連續天數、各分類進度
- **發音**：使用瀏覽器內建 Web Speech API（en-US），不支援時按鈕會停用並提示
- **字庫搜尋**：可搜尋英文、中文與例句，並依分類篩選
- **隨堂測驗**：10 題四選一（英翻中、中翻英混合），不影響複習排程
- **進度管理**：匯出／匯入 JSON 備份、重設全部進度；進度存在瀏覽器 localStorage
- **深淺色主題**：預設跟隨系統，可手動切換
- **離線使用**：Service Worker 快取，可「加入主畫面」當 App 使用

## 目錄結構

```
dist/                  部署用的完整網站（可直接上傳）
  index.html
  app.js
  style.css
  data.json            單字資料（由 build.py 產生）
  manifest.webmanifest
  sw.js
  icon.svg, icon-*.png
data/                  單字原始資料，每檔一個 JSON 陣列：data/<分類>_<編號>.json
build.py               合併 data/*.json → dist/data.json
tools/make_icons.py    重新產生 PNG 圖示（需要 Pillow）
SPEC.md                規格
```

## 產生單字資料

```bash
python3 build.py                 # 驗證並合併；有格式錯誤時不寫檔、結束碼 1
python3 build.py --skip-invalid  # 略過格式錯誤的資料，其餘照常輸出
python3 build.py --dry-run       # 只檢查與統計，不寫檔
```

`build.py` 會：

1. 依檔名順序讀取 `data/*.json`（`telecom_2` 排在 `telecom_10` 前面）
2. 驗證每筆資料：必要欄位、`level` 為 1–3、分類是否存在、`id` 前綴與分類相符（如 `tel-0001`）、`zh`／`example_zh` 不含簡體字
3. 英文不分大小寫、忽略多餘空白後去除重複，保留先出現的那一筆，並列出被略過的資料
4. 例句超過 15 字或有未定義欄位時提出警告（未定義欄位不會輸出）
5. 印出各分類字數、目標數與難度分布

`data/` 沒有任何檔案時不會動到現有的 `dist/data.json`。

### 資料格式

```json
{"id":"tel-0001","en":"roaming","pos":"n.","zh":"漫遊","ipa":"/ˈroʊmɪŋ/",
 "example_en":"Data roaming charges apply when you travel abroad.",
 "example_zh":"出國時會收取數據漫遊費用。","category":"telecom","level":1,"note":"選填"}
```

| 分類 key | 名稱 | 目標字數 | id 前綴 |
|---|---|---|---|
| telecom | 通訊電信 | 900 | tel |
| network | 網路與技術 | 500 | net |
| customer | 客戶溝通 | 450 | cus |
| contract | 合約法務 | 400 | con |
| meeting | 會議簡報 | 400 | mtg |
| email | Email 與書信用語 | 450 | eml |
| project | 專案與營運 | 400 | prj |
| finance | 財務採購 | 300 | fin |
| core | 通用商務核心 | 200 | cor |

## 本機執行與部署

所有路徑都是相對路徑，可放在任何子路徑下（例如 `/biz-english-4000/`）。

```bash
cd dist && python3 -m http.server 8000
# 開啟 http://localhost:8000/
```

直接以 `file://` 開啟時無法讀取 `data.json`，請用本機伺服器。

部署後若更新了 App 檔案，Service Worker 採「先走網路、失敗才用快取」，使用者連線時會自動拿到新版；如需強制清除舊快取，可修改 `sw.js` 的 `CACHE` 名稱。

## 測試用介面

在瀏覽器主控台可模擬不同日期，用來測試複習排程與連續天數：

```js
__app.setToday('2026-11-05')  // 模擬日期
__app.setToday(null)          // 恢復真實日期
__app.today()                 // 目前使用的日期
__app.state                   // 目前的進度資料
```

桌機鍵盤快捷鍵：學習時 `空白鍵`／`Enter` 翻面、`1`–`4` 評分、`U` 復原、`S` 發音；測驗時 `1`–`4` 作答、`Enter` 下一題。

## 資料來源與授權

由 AI 依一般商用英文與通訊產業常用詞彙自行整理，非翻抄任何版權字表；內容可能有誤，建議查證。

- 單字、翻譯與例句皆為自行撰寫，未參考或複製任何受版權保護的字表（如 TOEIC、Longman、Oxford、GEPT 等）。
- 音標僅供參考，以美式發音為準。
- 發音由使用者裝置的瀏覽器語音引擎（Web Speech API）提供。
- 複習排程採用公開的 SM-2 間隔重複演算法。
- 學習進度只儲存在使用者本機瀏覽器，不會上傳到任何伺服器。
