/**
 * アイキャッチ画像の自動生成
 *
 * frontmatter に eyecatch が無い記事のために、既存のアイキャッチと同じデザイン
 * （青い枠・白背景・中央にタイトル・左下に公開日・右下に著者名）の PNG をビルド時に生成する。
 *
 * sharp（Node.js のネイティブモジュール）を使うため、プリレンダリングされるエンドポイント
 * （src/pages/og/blogs/[...slug].png.ts）からのみ呼び出すこと。Cloudflare Workers の実行時には動かない。
 */
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1280;
const HEIGHT = 720;
/** 青い枠の太さ */
const BORDER = 30;
const BORDER_COLOR = "#3d9cff";
const BACKGROUND_COLOR = "#ffffff";
const TITLE_COLOR = "#000000";
const SUB_COLOR = "#545454";

/** タイトルの描画領域 */
const TITLE_MAX_WIDTH = 1120;
const TITLE_MAX_HEIGHT = 400;
const TITLE_FONT_SIZE = 64;

/** 公開日・著者名の位置 */
const FOOTER_FONT_SIZE = 40;
const FOOTER_SIDE_MARGIN = 72;
/** 公開日・著者名の文字の下端（画像上端からの距離） */
const FOOTER_BOTTOM = 643;

const AUTHOR = "いとじゅん";

/** サイトと同じフォント（ビルドはプロジェクトルートで実行される） */
const FONT_FILE = path.join(process.cwd(), "public/fonts/MPLUS1Code-VariableFont_wght.ttf");
const FONT_FAMILY = "M PLUS 1 Code";

const escapeMarkup = (value: string): string =>
	value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

type TextOptions = {
	text: string;
	color: string;
	fontSize: number;
	width?: number;
	height?: number;
};

/** Pango でテキストを描画する（返る画像は文字の範囲に切り詰められる） */
const renderText = async ({ text, color, fontSize, width, height }: TextOptions) => {
	const { data, info } = await sharp({
		text: {
			text: `<span foreground="${color}" weight="bold">${escapeMarkup(text)}</span>`,
			font: `${FONT_FAMILY} ${fontSize}`,
			fontfile: FONT_FILE,
			width,
			height,
			align: "centre",
			wrap: "word-char",
			rgba: true,
			// 72dpi にするとフォントサイズがそのままピクセル数になる。
			// height を指定した場合は領域に収まるよう sharp が dpi を自動調整する（dpi とは併用できない）
			...(height === undefined ? { dpi: 72 } : {}),
		},
	})
		.png()
		.toBuffer({ resolveWithObject: true });
	return { data, width: info.width, height: info.height };
};

/** タイトルを描画する。長すぎて領域に収まらない場合は文字を縮小する */
const renderTitle = async (title: string) => {
	const rendered = await renderText({
		text: title,
		color: TITLE_COLOR,
		fontSize: TITLE_FONT_SIZE,
		width: TITLE_MAX_WIDTH,
	});
	if (rendered.height <= TITLE_MAX_HEIGHT) return rendered;
	return renderText({
		text: title,
		color: TITLE_COLOR,
		fontSize: TITLE_FONT_SIZE,
		width: TITLE_MAX_WIDTH,
		height: TITLE_MAX_HEIGHT,
	});
};

/** 公開日を日本時間の YYYY/M/D 形式にする */
const formatDate = (date: Date): string => {
	const parts = new Intl.DateTimeFormat("ja-JP", {
		timeZone: "Asia/Tokyo",
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${get("year")}/${get("month")}/${get("day")}`;
};

type GenerateOptions = {
	title: string;
	publishedAt: Date;
};

/** アイキャッチ画像（PNG）を生成する */
export const generateEyecatch = async ({
	title,
	publishedAt,
}: GenerateOptions): Promise<Buffer> => {
	const [titleImage, dateImage, authorImage] = await Promise.all([
		renderTitle(title),
		renderText({ text: formatDate(publishedAt), color: SUB_COLOR, fontSize: FOOTER_FONT_SIZE }),
		renderText({ text: AUTHOR, color: SUB_COLOR, fontSize: FOOTER_FONT_SIZE }),
	]);

	return sharp({
		create: { width: WIDTH, height: HEIGHT, channels: 4, background: BORDER_COLOR },
	})
		.composite([
			{
				input: {
					create: {
						width: WIDTH - BORDER * 2,
						height: HEIGHT - BORDER * 2,
						channels: 4,
						background: BACKGROUND_COLOR,
					},
				},
				left: BORDER,
				top: BORDER,
			},
			{
				input: titleImage.data,
				left: Math.round((WIDTH - titleImage.width) / 2),
				top: Math.round((HEIGHT - titleImage.height) / 2),
			},
			{
				input: dateImage.data,
				left: FOOTER_SIDE_MARGIN,
				top: FOOTER_BOTTOM - dateImage.height,
			},
			{
				input: authorImage.data,
				left: WIDTH - FOOTER_SIDE_MARGIN - BORDER - authorImage.width,
				top: FOOTER_BOTTOM - authorImage.height,
			},
		])
		.png()
		.toBuffer();
};
