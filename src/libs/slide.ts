/**
 * Speaker Deck のスライド一覧取得（ビルド時に Atom / RSS フィードから取得する）
 */
import { SPEAKERDECK_URL } from "@/consts";
import type { Slide } from "@/types/slide";

const FEED_URLS = [`${SPEAKERDECK_URL}.atom`, `${SPEAKERDECK_URL}.rss`];
const FETCH_TIMEOUT_MS = 10_000;

/** XML の文字実体参照・数値文字参照をデコード */
const decodeEntities = (text: string): string =>
	text
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");

/** CDATA を剥がす、または実体参照をデコードしたテキストを返す */
const toText = (raw: string): string => {
	const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
	return (cdata ? cdata[1] : decodeEntities(raw)).trim();
};

/** 指定タグの中身を取得（最初の一致のみ） */
const getTagContent = (xml: string, tag: string): string | null => {
	const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
	return match ? toText(match[1]) : null;
};

/** 指定タグの属性値を取得（最初の一致のみ） */
const getTagAttr = (xml: string, tag: string, attr: string): string | null => {
	const match = xml.match(new RegExp(`<${tag}\\s[^>]*?\\b${attr}="([^"]*)"[^>]*>`, "i"));
	return match ? decodeEntities(match[1]) : null;
};

/** HTML タグを除去してプレーンテキストにする */
const stripHtml = (html: string): string =>
	decodeEntities(html.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();

const parseDate = (value: string | null): Date | null => {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

/** エントリ（Atom の entry / RSS の item）からリンクを取得 */
const getLink = (entry: string): string | null => {
	const alternate = entry.match(/<link\s[^>]*rel="alternate"[^>]*>/i)?.[0];
	return getTagAttr(alternate ?? entry, "link", "href") ?? getTagContent(entry, "link");
};

/** エントリからサムネイル画像 URL を取得 */
const getThumbnail = (entry: string, body: string): string | null =>
	getTagAttr(entry, "media:thumbnail", "url") ??
	getTagAttr(entry, "media:content", "url") ??
	body.match(/<img\s[^>]*src="([^"]+)"/i)?.[1] ??
	null;

const parseEntry = (entry: string): Slide | null => {
	const title = getTagContent(entry, "title");
	const url = getLink(entry);
	if (!title || !url) return null;

	const body =
		getTagContent(entry, "content") ??
		getTagContent(entry, "summary") ??
		getTagContent(entry, "description") ??
		"";

	return {
		title,
		url,
		description: stripHtml(body),
		thumbnailUrl: getThumbnail(entry, body),
		publishedAt: parseDate(
			getTagContent(entry, "published") ??
				getTagContent(entry, "pubDate") ??
				getTagContent(entry, "updated"),
		),
	};
};

/** Atom / RSS フィードの XML からスライド一覧を新しい順に取り出す */
export const parseSlidesFeed = (xml: string): Slide[] => {
	const entries = xml.match(/<(entry|item)[\s>][\s\S]*?<\/\1>/gi) ?? [];
	return entries
		.map(parseEntry)
		.filter((slide): slide is Slide => slide !== null)
		.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
};

/** スライド一覧の 1 ページあたりの件数 */
export const SLIDES_PER_PAGE = 12;

let slidesPromise: Promise<Slide[]> | undefined;

/**
 * スライド一覧を新しい順に取得する。
 * 取得に失敗してもビルドを止めないよう、失敗時は空配列を返す。
 */
export const getSlides = (): Promise<Slide[]> => {
	// 一覧の各ページで呼ばれるため、ビルド中の取得は 1 回にまとめる
	slidesPromise ??= fetchSlides();
	return slidesPromise;
};

const fetchSlides = async (): Promise<Slide[]> => {
	for (const feedUrl of FEED_URLS) {
		try {
			const res = await fetch(feedUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const slides = parseSlidesFeed(await res.text());
			if (slides.length > 0) return slides;
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			// biome-ignore lint/suspicious/noConsole: ビルドログで取得失敗に気付けるようにするため
			console.warn(`[slides] ${feedUrl} の取得に失敗しました: ${reason}`);
		}
	}
	return [];
};
