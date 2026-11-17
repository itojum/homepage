/**
 * URL だけの段落を埋め込みに変換する remark プラグイン（ビルド時のみ実行）
 *
 * Markdown に URL を 1 行だけ書くと、以下のように展開する。
 *   - X (Twitter) のポスト          → 埋め込みポスト
 *   - YouTube / Speaker Deck / Docswell / Google スライド / slides.com → iframe
 *   - それ以外の URL               → OGP を取得したリンクカード（取得失敗時は簡易カード）
 */

type Node = {
	type: string;
	url?: string;
	value?: string;
	children?: Node[];
};

type Embed = { src: string; aspectRatio: string; title: string };

const escapeHtml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

/** 段落が URL 1 つだけ（`https://...` の自動リンク）なら、その URL を返す */
const getBareUrl = (node: Node): string | null => {
	if (node.type !== "paragraph" || node.children?.length !== 1) return null;
	const [link] = node.children;
	if (link.type !== "link" || !link.url || !/^https?:\/\//.test(link.url)) return null;
	const text = link.children?.length === 1 ? link.children[0].value : undefined;
	if (text !== link.url) return null;
	return link.url;
};

/* ---------- X (Twitter) ---------- */

const TWEET_PATTERN = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/(\w+)\/status\/(\d+)/;

const renderTweet = (user: string, id: string): string => {
	const url = `https://twitter.com/${user}/status/${id}`;
	return [
		`<blockquote class="twitter-tweet" data-dnt="true"><a href="${url}">${escapeHtml(url)}</a></blockquote>`,
		'<script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>',
	].join("\n");
};

/* ---------- iframe 埋め込み ---------- */

const IFRAME_PROVIDERS: Array<(url: URL) => Embed | null> = [
	// YouTube: watch?v= / youtu.be / embed
	(url) => {
		const host = url.hostname.replace(/^(www|m)\./, "");
		let id: string | null = null;
		if (host === "youtube.com" && url.pathname === "/watch") id = url.searchParams.get("v");
		if (host === "youtube.com" && url.pathname.startsWith("/embed/"))
			id = url.pathname.split("/")[2];
		if (host === "youtu.be") id = url.pathname.slice(1);
		if (!id || !/^[\w-]+$/.test(id)) return null;
		return {
			src: `https://www.youtube.com/embed/${id}`,
			aspectRatio: "16 / 9",
			title: "YouTube",
		};
	},
	// Speaker Deck: 埋め込み用の player URL（共有メニューの Embed から取得できる）
	(url) => {
		const match = url.hostname === "speakerdeck.com" && url.pathname.match(/^\/player\/(\w+)/);
		if (!match) return null;
		return {
			src: `https://speakerdeck.com/player/${match[1]}`,
			aspectRatio: "16 / 9",
			title: "Speaker Deck",
		};
	},
	// Docswell: /slide/<ID>/embed または /s/<user>/<ID>-<slug>
	(url) => {
		if (!url.hostname.endsWith("docswell.com")) return null;
		const match =
			url.pathname.match(/^\/slide\/(\w+)/) ?? url.pathname.match(/^\/s\/[^/]+\/(\w+)-/);
		if (!match) return null;
		return {
			src: `https://www.docswell.com/slide/${match[1]}/embed`,
			aspectRatio: "16 / 9",
			title: "Docswell",
		};
	},
	// Google スライド
	(url) => {
		const match =
			url.hostname === "docs.google.com" && url.pathname.match(/^\/presentation\/d\/([\w-]+)/);
		if (!match) return null;
		return {
			src: `https://docs.google.com/presentation/d/${match[1]}/embed`,
			aspectRatio: "960 / 569",
			title: "Google スライド",
		};
	},
	// slides.com
	(url) => {
		const match = url.hostname === "slides.com" && url.pathname.match(/^\/([\w-]+)\/([\w-]+)/);
		if (!match) return null;
		return {
			src: `https://slides.com/${match[1]}/${match[2]}/embed`,
			aspectRatio: "576 / 420",
			title: "slides.com",
		};
	},
];

const renderIframe = ({ src, aspectRatio, title }: Embed): string =>
	`<div class="embed" style="aspect-ratio: ${aspectRatio}"><iframe src="${escapeHtml(src)}" title="${escapeHtml(title)}" loading="lazy" allowfullscreen allow="encrypted-media; picture-in-picture; fullscreen"></iframe></div>`;

/* ---------- リンクカード ---------- */

type Ogp = { title?: string; description?: string; image?: string; siteName?: string };

const ogpCache = new Map<string, Promise<Ogp>>();

const decodeEntities = (value: string): string =>
	value
		.replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
		.replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&apos;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&");

const getMeta = (html: string, key: string): string | undefined => {
	for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
		const name = tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1];
		if (name?.toLowerCase() !== key) continue;
		const content = tag.match(/\bcontent\s*=\s*"([^"]*)"|\bcontent\s*=\s*'([^']*)'/i);
		const value = content?.[1] ?? content?.[2];
		if (value) return decodeEntities(value).trim();
	}
	return undefined;
};

/** レスポンスの文字コード（Content-Type か <meta charset>）でデコードする */
const decodeBody = (buffer: ArrayBuffer, contentType: string | null): string => {
	const head = new TextDecoder("ascii").decode(buffer.slice(0, 4096));
	const charset =
		contentType?.match(/charset=([\w-]+)/i)?.[1] ??
		head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
	try {
		return new TextDecoder(charset ?? "utf-8").decode(buffer);
	} catch {
		return new TextDecoder("utf-8").decode(buffer);
	}
};

const fetchOgp = async (url: string): Promise<Ogp> => {
	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; LinkCardBot/1.0)", Accept: "text/html" },
			redirect: "follow",
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok || !res.headers.get("content-type")?.includes("html")) return {};
		const html = decodeBody(await res.arrayBuffer(), res.headers.get("content-type"));
		const head = html.slice(0, html.search(/<\/head>/i) + 1 || 300_000);
		const title =
			getMeta(head, "og:title") ??
			getMeta(head, "twitter:title") ??
			decodeEntities(head.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
		const image = getMeta(head, "og:image") ?? getMeta(head, "twitter:image");
		return {
			title: title || undefined,
			description: getMeta(head, "og:description") ?? getMeta(head, "description"),
			image: image ? new URL(image, res.url || url).href : undefined,
			siteName: getMeta(head, "og:site_name"),
		};
	} catch {
		return {};
	}
};

const getOgp = (url: string): Promise<Ogp> => {
	let cached = ogpCache.get(url);
	if (!cached) {
		cached = fetchOgp(url);
		ogpCache.set(url, cached);
	}
	return cached;
};

const renderLinkCard = (url: string, ogp: Ogp): string => {
	const { hostname } = new URL(url);
	const title = ogp.title ?? url;
	return [
		`<a class="link-card" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">`,
		'<span class="link-card__body">',
		`<span class="link-card__title">${escapeHtml(title)}</span>`,
		ogp.description
			? `<span class="link-card__description">${escapeHtml(ogp.description)}</span>`
			: "",
		`<span class="link-card__site">${escapeHtml(ogp.siteName ?? hostname)}</span>`,
		"</span>",
		ogp.image
			? `<img class="link-card__image" src="${escapeHtml(ogp.image)}" alt="" loading="lazy" />`
			: "",
		"</a>",
	].join("");
};

/* ---------- プラグイン本体 ---------- */

const renderEmbed = async (rawUrl: string): Promise<string> => {
	const tweet = rawUrl.match(TWEET_PATTERN);
	if (tweet) return renderTweet(tweet[1], tweet[2]);

	const url = new URL(rawUrl);
	for (const provider of IFRAME_PROVIDERS) {
		const embed = provider(url);
		if (embed) return renderIframe(embed);
	}

	return renderLinkCard(rawUrl, await getOgp(rawUrl));
};

export const remarkEmbeds = () => {
	return async (tree: Node) => {
		const tasks = (tree.children ?? []).map(async (node, index, children) => {
			const url = getBareUrl(node);
			if (!url) return;
			children[index] = { type: "html", value: await renderEmbed(url) };
		});
		await Promise.all(tasks);
	};
};
