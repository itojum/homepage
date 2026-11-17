---
title: "予定解析Webアプリ YoteiScanを公開しました"
description: "テキストや画像、音声など様々な媒体から予定を解析し、Googleカレンダーへ簡単に登録できるサービス「YoteiScan」を公開しました。Next.jsとGeminiを搭載したWebアプリ版の開発背景や技術構成を紹介します。"
publishedAt: 2026-03-28T12:34:57.613Z
updatedAt: 2026-03-28T13:33:40.116Z
eyecatch: "./eyecatch.jpg"
category: "技術"
tags: ["Vercel", "Next.js", "Gemini"]
---

「YoteiScan」を公開しました。

今回公開したYoteiScanは、「様々な媒体の予定情報を簡単にカレンダーへ登録できるサービス」です。

https://yoteiscan.itojum.dev

## 使用例

### 街中で気になるイベントポスターを見つけたとき

YoteiScanでポスターの写真を撮るだけで簡単にGoogleカレンダーに追加できる！！

### 気になるイベントのWebサイトにたどり着いたとき

YoteiScanにWebサイトのURLを入力して簡単にGoogleカレンダーに追加できる！！！

便利そう....

## 機能

YoteiScanは以下の媒体の予定を解析することができます。

- テキスト
- 画像
- 音声
- リンク
- ファイル

これらの媒体に含まれる予定情報を解析して、Googleカレンダーの予定URLに整形し、登録まで行うのがYoteiScanの機能になります。

## 作った背景

今回公開したYoteiScanは、**フレッシュITあわ～ど**というコンテストに出したAndroidアプリをWebアプリとして再実装したものです。

https://freshitaward.wixsite.com/freshitaward2025

めちゃくちゃ個人的なのですが、AndroidからiPhoneに機種変更したせいで、元々のYoteiScanが使えなくなってしまいました。そこで、再実装して公開しようというのが背景になります。

モバイルアプリとしてリリースしたかったのですが、登録料や審査のハードルが高く...今回はWebアプリとして公開することにしました。

## 技術周り

めっちゃシンプル

- Next.js
- Gemini 2.5 Flash
- Vercel

## おわりに

ip制限をかけているので1時間に5回しか使えませんが、良ければ使ってみてほしいです！アナリティクスを見てニヤニヤできるので。

ひとまずは、ほぼ個人用で使い続けてみて、少しずつブラッシュアップしていこうと思います。

ではまたー
