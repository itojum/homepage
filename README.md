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

### 記事の自動レビュー

`src/content/blogs/**` を変更する PR では、`blog-review.yml` が次のように動きます。

| タイミング | 動作 |
| --- | --- |
| PR を作成したとき（opened） | 挨拶コメントを投稿 |
| PR に push したとき（synchronize） | push で変更された記事を Claude がレビュー |
| Ready for review にしたとき / 再オープンしたとき | PR 内のすべての記事を Claude がレビュー |

Claude は `.claude/skills/blog-review/SKILL.md` の基準に従って、変更行へのインラインコメントとサマリーコメントを残します。
手元の Claude Code でも「blog-review スキルでこの記事をレビューして」のように使えます。

事前に次の設定が必要です。

1. [Claude GitHub App](https://github.com/apps/claude) をこのリポジトリにインストールする
2. 手元で `claude setup-token` を実行してトークンを発行し、Settings > Secrets and variables > Actions の Secrets に `CLAUDE_CODE_OAUTH_TOKEN` として登録する
   - API キーを使う場合は `ANTHROPIC_API_KEY` を登録し、ワークフローの `claude_code_oauth_token` を `anthropic_api_key` に置き換える

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
