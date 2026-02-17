## 概要

このリポジトリは、Astro を使って構築した個人サイト／ブログです。  
microCMS をヘッドレス CMS として利用し、ブログ記事やアクティビティ情報を配信しています。  

## 主な技術スタック

- フレームワーク: Astro
- スタイル: Tailwind CSS（`@astrojs/tailwind`）、カスタム CSS
- CMS: microCMS（`microcms-js-sdk`）
- 検索: Pagefind（`astro-pagefind`）
- アイコン: `astro-icon` + `@iconify-json/ri`
- その他:
  - Lint/Format: Biome (`@biomejs/biome`)

## 必要な環境変数

ルートディレクトリに `.env.example` をコピーし、 `.env` を作成し、少なくとも以下を設定してください。

```bash
SITE_URL="https://example.com"

# microCMS
MICROCMS_SERVICE_DOMAIN="your-service-domain"
MICROCMS_API_KEY="your-api-key"
```

## セットアップ

### 1. 依存パッケージのインストール

このプロジェクトは pnpm を前提としています。

```bash
pnpm install
```

### 2. 開発サーバーの起動

```bash
pnpm dev
```

ブラウザで `http://localhost:4321` へアクセスすると開発中のサイトを確認できます。

### 3. ビルド

本番用ビルドは以下のコマンドで生成されます。

```bash
pnpm build
```

ビルド成果物は `dist/` 配下に出力されます。

### 4. ビルド済みサイトのプレビュー

ビルド済みファイルを使ってローカルプレビューを行う場合は次のコマンドを使います。

```bash
pnpm preview
```
