import path from "node:path";
import { visit } from "unist-util-visit";
// astro.config から読み込まれるため "@/" エイリアスは使えない
import { BLOG_CONTENT_DIR, resolveBlogImageUrl } from "../blogImage";

type ImageNode = {
	type: "image";
	url: string;
};

type VFileLike = {
	path?: string;
	cwd?: string;
};

type Options = {
	baseUrl: string | undefined;
	dev: boolean;
};

/**
 * ブログ記事内の相対画像パスを R2 の URL に書き換える remark プラグイン（ビルド時のみ実行）。
 * src/content/blogs 以外の Markdown には何もしない。
 */
export const remarkBlogImages = ({ baseUrl, dev }: Options) => {
	return (tree: unknown, file: VFileLike) => {
		if (!file.path) return;

		const entryFilePath = path
			.relative(file.cwd ?? process.cwd(), file.path)
			.split(path.sep)
			.join("/");
		if (!entryFilePath.startsWith(`${BLOG_CONTENT_DIR}/`)) return;

		// biome-ignore lint/suspicious/noExplicitAny: mdast の型定義を依存に追加しないため
		visit(tree as any, "image", (node: ImageNode) => {
			node.url = resolveBlogImageUrl({ entryFilePath, src: node.url, baseUrl, dev });
		});
	};
};
