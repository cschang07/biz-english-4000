# biz-english-4000 spec
Static mobile-first web app (Traditional Chinese, Taiwan wording) to memorize ~4000 business-English words, telecom-heavy, for a Taiwanese employee at a Japanese company, beginner-intermediate English.
## Data entry schema (JSON array per file data/<cat>_<n>.json)
{"id":"tel-0001","en":"roaming","pos":"n.","zh":"漫遊","ipa":"/ˈroʊmɪŋ/","example_en":"...","example_zh":"...","category":"telecom","level":1,"note":"optional"}
level 1=basic 2=intermediate 3=advanced. zh/example_zh MUST be Traditional Chinese (台灣用語, e.g. 網路 not 网络, 軟體 not 软件, 資訊, 品質). Examples short (<=15 words), natural business context. No duplicates, no filler. Entries may be words or short phrases (e.g. "Please find attached").
Categories (key: zh name, target count, id prefix):
telecom: 通訊電信 900 tel
network: 網路與技術 500 net
customer: 客戶溝通 450 cus
contract: 合約法務 400 con
meeting: 會議簡報 400 mtg
email: Email 與書信用語 450 eml
project: 專案與營運 400 prj
finance: 財務採購 300 fin
core: 通用商務核心 200 cor
Source: authored by AI from general knowledge; do NOT copy any copyrighted wordlist (TOEIC/Longman/Oxford/GEPT etc).
## App
Output: dist/ (index.html, app.js, style.css, data.json, manifest + service worker optional). Vanilla JS, no build deps required, relative paths (served at /biz-english-4000/).
Features: onboarding (daily new goal default 20, choose categories, start with 通訊電信), flashcards (flip, 4 buttons 忘記/困難/良好/簡單), SM-2 spaced repetition, daily goal new+review, dashboard (已學/熟練/連續天數/per-category progress), category selection, TTS via Web Speech API (en-US, graceful fallback), search, reset / export / import progress JSON, optional quick quiz (4-choice). Progress in localStorage. Pages: 「資料來源與授權」 with statement: 由 AI 依一般商用英文與通訊產業常用詞彙自行整理，非翻抄任何版權字表；內容可能有誤，建議查證。 Dark/light (prefers-color-scheme + toggle), big tap targets, portrait first, safe-area insets. Expose window.__app.setToday(dateStr) for testing simulated days.
