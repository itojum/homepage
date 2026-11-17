## 概要

このリポジトリは、Astro を使って構築した個人サイト／ブログです。  
ブログ記事とアクティビティは Markdown / YAML としてこのリポジトリで管理し、記事の画像は Cloudflare R2 から配信しています。  

## 主な技術スタック

- フレームワーク: Astro
- スタイル: Tailwind CSS（`@astrojs/tailwind`）、カスタム CSS
- コンテンツ: Astro Content Collections（`src/content/`）
- 画像配信: Cloudflare R2
- 検索: Pagefind（`astro-pagefind`）
- アイコン: `astro-icon` + `@iconify-json/ri`
- その他:
  - Lint/Format: Biome (`@biomejs/biome`)

## 必要な環境変数

ルートディレクトリに `.env.example` をコピーし、 `.env` を作成し、少なくとも以下を設定してください。

```bash
SITE_URL="https://example.com"

# Cloudflare R2 の公開 URL（ブログ画像の配信元。末尾スラッシュ不要）
IMAGE_BASE_URL="https://images.example.com"
```

`IMAGE_BASE_URL` は本番ビルドで必須です（未設定で画像付きの記事があるとビルドが失敗します）。
`pnpm dev` ではローカルの画像を表示するため未設定でも動作します。
Cloudflare Workers のビルド設定にも同じ値を環境変数として設定してください。

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

## ブログ記事の書き方

記事は `src/content/blogs/<slug>/index.md` に置きます。`<slug>` がそのまま URL（`/blogs/<slug>`）になります。
画像は記事と同じフォルダに置き、相対パスで参照します。

```text
src/content/blogs/
└── my-first-post/
    ├── index.md
    ├── eyecatch.png
    └── screenshot.png
```

````markdown
---
title: 記事タイトル
description: 一覧や OGP に表示される説明文
publishedAt: 2026-11-17
updatedAt: 2026-11-20      # 任意
eyecatch: ./eyecatch.png   # 任意
category: 技術             # 任意
tags: [Astro, Cloudflare]  # 任意
draft: false               # true にすると一覧に出さず /draft/blogs/<slug> のみ生成
---

本文

![スクリーンショット](./screenshot.png)

```ts title="hello.ts"
console.log("hello");
```
````

- 画像を使わない記事は `src/content/blogs/<slug>.md` でも構いません
- ビルド時に相対パスの画像は `${IMAGE_BASE_URL}/blogs/<slug>/<ファイル名>` に書き換えられます
- 画像ファイルは `develop` / `main` に push されると GitHub Actions（`sync-blog-images.yml`）が R2 にアップロードします
- 同期はファイルサイズで差分判定するため、画像を差し替えるときはファイル名を変えてください

About ページの Activities は `src/content/activities.yaml` で管理しています。

## Cloudflare R2 の初期設定

1. Cloudflare ダッシュボードで R2 バケットを作成し、カスタムドメイン（例: `images.example.com`）を接続して公開する
2. R2 の「API トークンを管理」から、対象バケットに「オブジェクト読み取りと書き込み」権限のある API トークンを作成する
3. GitHub リポジトリの Settings > Secrets and variables > Actions に以下を登録する
   - Secrets: `CLOUDFLARE_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
   - Variables: `R2_BUCKET`（バケット名）
4. Cloudflare Workers のビルド環境変数に `IMAGE_BASE_URL` を設定する

## microCMS からの移行

一度だけ、手元で次のコマンドを実行して既存の記事とアクティビティを取り込みます。

```bash
MICROCMS_SERVICE_DOMAIN="your-service-domain" MICROCMS_API_KEY="your-api-key" pnpm migrate:microcms
```

- 記事は Markdown に変換され、microCMS 上の画像は各記事フォルダにダウンロードされます
- 公開中の記事のみが対象です。下書きは手動で移行してください
- 既存のファイルはスキップします。上書きする場合は `--force` を付けます
- 変換結果を `pnpm dev` で確認し、崩れた箇所を手直ししてからコミットしてください
