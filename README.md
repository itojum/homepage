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
---

本文

![スクリーンショット](./screenshot.png)

```ts title="hello.ts"
console.log("hello");
```
````

- 下書きはブランチ / PR 上で管理し、`main` にマージした時点で公開されます（下書き用のフラグはありません）
- 画像を使わない記事は `src/content/blogs/<slug>.md` でも構いません
- `eyecatch` を省略すると、タイトルと公開日を入れたアイキャッチ画像がビルド時に自動生成されます（`/og/blogs/<slug>.png`。生成処理は `src/libs/eyecatch.ts`）
- ビルド時に相対パスの画像は `${IMAGE_BASE_URL}/blogs/<slug>/<ファイル名>` に書き換えられます
- 画像ファイルは `develop` / `main` に push されると GitHub Actions（`sync-blog-images.yml`）が WebP に変換して R2 にアップロードします
  - PNG / JPEG / GIF は `.webp` に変換され、記事内の参照（`./screenshot.png` など）もビルド時に `.webp` の URL に書き換わります。手元での変換は不要です
  - 本文画像は横幅 1440px にそろえます（小さい画像は拡大しません）。アイキャッチは 1920px を超える場合のみ縮小します
  - `foo.png` と `foo.jpg` のように、変換後に同じ名前になる画像は同じフォルダに置けません
  - `pnpm images:build` で、アップロードされる画像を `.blog-images/` に書き出して確認できます
- 同期はファイルサイズで差分判定するため、画像を差し替えるときはファイル名を変えてください

### 埋め込み・リンクカード

URL を前後に空行を入れて 1 行だけ書くと、ビルド時に埋め込みへ変換されます。

```markdown
https://x.com/itojum1230/status/2071073466460291214

https://speakerdeck.com/player/ccdb86861be04395a318dbb7940ee2d0

https://github.com/itojum/homepage
```

| URL | 表示 |
| --- | --- |
| X (Twitter) のポスト | 埋め込みポスト |
| YouTube | 動画プレイヤー |
| Speaker Deck（`https://speakerdeck.com/player/<ID>`） | スライド。ID は共有メニューの Embed から取得 |
| Docswell / Google スライド / slides.com | スライド |
| その他 | OGP を取得したリンクカード（取得できない場合は URL のみのカード） |

文中のリンクやリスト内の URL は通常のリンクのままです。

About ページの Activities は `src/content/activities.yaml` で管理しています。

### 記事の雛形を作る

GitHub の Actions タブで「ブログ執筆用 PR を作成」（`new-blog.yml`）を Run workflow すると、次の処理を自動で行います。

1. `src/content/blogs/<slug>/index.md` に雛形（`publishedAt` は日本時間の今日）を作成
2. ブランチ `blog/<slug>` を作成して push
3. `main` 向けの Draft PR を作成（`blog` ラベルがあれば付与）。記事は PR ブランチ上で下書きし、本文は Cloudflare のプレビューデプロイで確認します。新しく追加した画像は `main` にマージされるまで R2 に同期されずプレビューには表示されないため、画像は `pnpm dev` で確認してください

入力は `title`（必須）と `slug` / `category` / `tags`（任意。`tags` はカンマ区切り）です。`slug` を空にすると英小文字 + 数字のランダムな ID になります。

手元で雛形だけ作る場合は次のコマンドを使います。

```bash
pnpm blog:new --title "記事タイトル" [--slug my-post] [--category 技術] [--tags "Astro,Cloudflare"]
```

- 事前に Settings > Actions > General > Workflow permissions の「Allow GitHub Actions to create and approve pull requests」を有効にしてください
- `GITHUB_TOKEN` で作成した PR では他のワークフローが発火しません。執筆者が自分で push すると通常どおり動きます

## Cloudflare R2 の初期設定

1. Cloudflare ダッシュボードで R2 バケットを作成し、カスタムドメイン（例: `images.example.com`）を接続して公開する
2. R2 の「API トークンを管理」から、対象バケットに「オブジェクト読み取りと書き込み」権限のある API トークンを作成する
3. GitHub リポジトリの Settings > Secrets and variables > Actions に以下を登録する
   - Secrets: `CLOUDFLARE_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`
   - Variables: `R2_BUCKET`（バケット名）
4. Cloudflare Workers のビルド環境変数に `IMAGE_BASE_URL` を設定する
