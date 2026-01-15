# Decap-test

Decap CMS + Astro を使った j-aic.com 移行 PoC 用の検証リポジトリです。

## セットアップ

```bash
npm install
```

## ローカル起動

```bash
npm run dev
```

## Decap CMS

- `/admin` で Decap CMS にアクセスできます。
- Editorial Workflow を有効化しています（PR → マージで公開）。

## 移行スクリプト

### 1. サイトマップ取得

```bash
npm run fetch-sitemap
```

`https://j-aic.com/sitemap.xml` から URL を抽出し、`scripts/output/urls.json` に保存します。

### 2. スクレイピング

```bash
npm run scrape-pages
```

Playwright で遅延レンダリング後の DOM から本文を抽出し、Markdown を生成します。

- 出力: `content/pages/*.md` / `content/posts/*.md`
- ログ: `scripts/output/logs/*.jsonl`
- 失敗時: `scripts/output/html` / `scripts/output/screenshots`

### 3. 一括実行

```bash
npm run run-all
```

## GitHub Pages

Astro の `base` を `/Decap-test` に設定済みです。`npm run build` 後に `dist/` を Pages にデプロイしてください。

## ディレクトリ構成

```
public/admin/       # Decap CMS 設定
content/pages/      # 固定ページ Markdown
content/posts/      # 記事/コラム Markdown
scripts/            # 移行スクリプト
```
