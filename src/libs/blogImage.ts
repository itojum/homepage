/**
 * ブログ画像の URL 解決
 *
 * 記事の画像は記事と同じフォルダ（src/content/blogs/<slug>/）に置き、Git で管理する。
 * GitHub Actions がそのフォルダ構成のまま Cloudflare R2 の `blogs/` 以下へ同期するので、
 * ビルド時は相対パスを `${IMAGE_BASE_URL}/blogs/<slug>/<file>` に書き換える。
 *
 * 開発サーバーでは R2 へ同期される前でも確認できるよう、Vite が配信するローカルファイルの
 * パス（/src/content/blogs/...）を返す。
 */

/** 記事を置くディレクトリ（プロジェクトルートからの相対パス） */
export const BLOG_CONTENT_DIR = "src/content/blogs";

/** R2 バケット内のキーのプレフィックス */
export const BLOG_IMAGE_KEY_PREFIX = "blogs";

/** 記事ファイルからの相対パスかどうか（外部 URL・絶対パス・data URI などは対象外） */
export const isRelativeImagePath = (src: string): boolean => {
	return !/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(src);
};

/** `a/b/../c/./d` のような POSIX パスを正規化する。コンテンツディレクトリ外を指す場合は null */
const normalizePosixPath = (path: string): string | null => {
	const segments: string[] = [];
	for (const segment of path.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.length === 0) return null;
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return segments.join("/");
};

type ResolveOptions = {
	/** 記事ファイルのパス（プロジェクトルートからの相対、例: src/content/blogs/foo/index.md） */
	entryFilePath: string;
	/** Markdown / frontmatter に書かれた画像パス（例: ./cover.png） */
	src: string;
	/** R2 の公開 URL（例: https://images.example.com） */
	baseUrl: string | undefined;
	/** 開発サーバーかどうか */
	dev: boolean;
};

/** 記事内の相対画像パスを配信用 URL に変換する。相対パスでなければそのまま返す */
export const resolveBlogImageUrl = ({
	entryFilePath,
	src,
	baseUrl,
	dev,
}: ResolveOptions): string => {
	if (!isRelativeImagePath(src)) return src;

	const normalizedEntryPath = entryFilePath.replaceAll("\\", "/").replace(/^\.\//, "");
	const prefix = `${BLOG_CONTENT_DIR}/`;
	if (!normalizedEntryPath.startsWith(prefix)) {
		throw new Error(`ブログ記事のパスが ${BLOG_CONTENT_DIR} 配下ではありません: ${entryFilePath}`);
	}

	const entryDir = normalizedEntryPath.slice(prefix.length).split("/").slice(0, -1).join("/");
	const [pathPart] = src.split(/[?#]/);
	const relativePath = normalizePosixPath(`${entryDir}/${decodeURI(pathPart)}`);
	if (!relativePath) {
		throw new Error(`画像パスが ${BLOG_CONTENT_DIR} の外を指しています: ${src} (${entryFilePath})`);
	}

	const encodedPath = relativePath.split("/").map(encodeURIComponent).join("/");

	if (dev) {
		return `/${BLOG_CONTENT_DIR}/${encodedPath}`;
	}

	if (!baseUrl) {
		throw new Error(
			"環境変数 IMAGE_BASE_URL が設定されていません。R2 の公開 URL（例: https://images.example.com）を設定してください。",
		);
	}

	return `${baseUrl.replace(/\/+$/, "")}/${BLOG_IMAGE_KEY_PREFIX}/${encodedPath}`;
};
