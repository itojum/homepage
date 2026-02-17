import { visit } from "unist-util-visit";

type NodeLike = {
	type: string;
	tagName?: string;
	properties?: Record<string, unknown>;
	data?: Record<string, unknown>;
	children?: NodeLike[];
};

const isElement = (node: unknown): node is NodeLike => {
	return Boolean(node && typeof node === "object" && (node as NodeLike).type === "element");
};

const getFilename = (properties: Record<string, unknown> | undefined): string | undefined => {
	const filename = properties?.dataFilename ?? properties?.["data-filename"];
	return typeof filename === "string" && filename.length > 0 ? filename : undefined;
};

const findChildElement = (node: NodeLike, tagName: string): NodeLike | undefined => {
	const children = Array.isArray(node.children) ? node.children : [];
	return children.find((child: NodeLike) => isElement(child) && child.tagName === tagName);
};

const getCodeMeta = (code: NodeLike): string => {
	if (typeof code.data?.meta === "string") {
		return code.data.meta;
	}

	if (typeof code.properties?.metastring === "string") {
		return code.properties.metastring;
	}

	return "";
};

const appendTitleMeta = (meta: string, filename: string): string => {
	if (meta.includes("title=")) {
		return meta;
	}

	const titleMeta = `title="${filename.replaceAll('"', "'")}"`;
	return `${meta} ${titleMeta}`.trim();
};

export const rehypeCodeBlockMeta = () => {
	return (tree: NodeLike) => {
		visit(
			tree,
			"element",
			(node: NodeLike, _index: number | undefined, parent: NodeLike | undefined) => {
				if (node.tagName !== "pre") {
					return;
				}

				const code = findChildElement(node, "code");
				if (!code) {
					return;
				}

				const baseMeta = getCodeMeta(code);
				const filename = parent?.tagName === "div" ? getFilename(parent.properties) : undefined;
				const title = filename ?? "code";

				code.data = {
					...code.data,
					meta: appendTitleMeta(baseMeta, title),
				};
			},
		);
	};
};
