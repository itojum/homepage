/**
 * 表示用の日付フォーマット
 *
 * ビルド環境のタイムゾーン（Cloudflare などは UTC）に左右されないよう、常に日本時間で整形する。
 */
const TIME_ZONE = "Asia/Tokyo";

const parts = (date: Date, options: Intl.DateTimeFormatOptions) =>
	Object.fromEntries(
		new Intl.DateTimeFormat("ja-JP", { timeZone: TIME_ZONE, ...options })
			.formatToParts(date)
			.map((part) => [part.type, part.value]),
	);

/** 2026.10.20 */
export const formatDotDate = (date: Date): string => {
	const p = parts(date, { year: "numeric", month: "2-digit", day: "2-digit" });
	return `${p.year}.${p.month}.${p.day}`;
};

/** 2026.10 */
export const formatDotMonth = (date: Date): string => {
	const p = parts(date, { year: "numeric", month: "2-digit" });
	return `${p.year}.${p.month}`;
};
