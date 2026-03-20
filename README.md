# 案件管理アプリ

書類作成・稟議・承認フローを管理するPWA対応Webアプリです。

## 機能

- 案件のカンバンボード / リスト表示
- ステータス管理（起案 → 書類作成 → 承認待ち → 完了）
- タスク管理（進捗バー付き）
- 期限設定・アラート表示
- 書類テンプレート（稟議書・通知文・報告書）
- PWA対応（スマホホーム画面に追加可能）
- localStorageでデータ永続化

## セットアップ

```bash
npm install
npm run dev
```

## GitHub Pages へのデプロイ

### 1. vite.config.js のリポジトリ名を変更

```js
const BASE = '/あなたのリポジトリ名/'
```

### 2. GitHubリポジトリを作成してプッシュ

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/ユーザー名/リポジトリ名.git
git push -u origin main
```

### 3. GitHub Pages の設定

1. リポジトリの **Settings** → **Pages**
2. **Source** を `GitHub Actions` に変更
3. mainブランチにpushすると自動でデプロイされます

### 4. スマホのホーム画面に追加

- **iPhone (Safari)**: 共有ボタン → 「ホーム画面に追加」
- **Android (Chrome)**: メニュー → 「ホーム画面に追加」

## カスタマイズ

- `src/App.jsx` の `DOC_TEMPLATES` に書類テンプレートを追加
- `src/App.jsx` の `TASK_TEMPLATES` によく使うタスクを追加
- `vite.config.js` の `BASE` をリポジトリ名に合わせて変更
