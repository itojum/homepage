import rehypeParse from "rehype-parse";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";
import { rehypeCodeBlockMeta } from "@/lib/richText/rehypeCodeBlockMeta";

const prettyCodeOptions = {
	theme: {
		light: "github-light",
		dark: "github-dark",
	},
	keepBackground: false,
	defaultLang: "txt",
} as Parameters<typeof rehypePrettyCode>[0];

export const transformRichText = async (content: string): Promise<string> => {
	if (!content.includes("<pre")) {
		return content;
	}

	try {
		const file = await unified()
			.use(rehypeParse, { fragment: true })
			.use(rehypeCodeBlockMeta)
			.use(rehypePrettyCode, prettyCodeOptions)
			.use(rehypeStringify)
			.process(content);

		return String(file);
	} catch (_error) {
		return content;
	}
};
