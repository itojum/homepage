import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import pagefind from 'astro-pagefind';
import dotenv from 'dotenv';
import rehypePrettyCode from 'rehype-pretty-code';
import { rehypeCodeBlockMeta } from './src/libs/richText/rehypeCodeBlockMeta';
import { remarkBlogImages } from './src/libs/richText/remarkBlogImages';
import { remarkEmbeds } from './src/libs/richText/remarkEmbeds';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

dotenv.config();

const siteUrl = process.env.SITE_URL;

/** ブログ記事内の相対画像パスを Cloudflare R2 の URL に書き換える */
const blogImages = () => ({
	name: 'blog-images',
	hooks: {
		'astro:config:setup': ({ command, updateConfig }) => {
			updateConfig({
				markdown: {
					remarkPlugins: [
						[remarkBlogImages, { baseUrl: process.env.IMAGE_BASE_URL, dev: command === 'dev' }],
					],
				},
			});
		},
	},
});

export default defineConfig({
	build: {
		format: 'file',
	},
	site: siteUrl,
	markdown: {
		syntaxHighlight: false,
		remarkPlugins: [remarkEmbeds],
		rehypePlugins: [
			rehypeCodeBlockMeta,
			[
				rehypePrettyCode,
				{
					theme: { light: 'github-light', dark: 'github-dark' },
					keepBackground: false,
					defaultLang: 'txt',
				},
			],
		],
	},
	integrations: [
		blogImages(),
		// 下書きプレビュー（/draft/）はサイトマップに含めない
		sitemap({ filter: (page) => !new URL(page).pathname.startsWith('/draft/') }),
		icon(),
		tailwind(),
		pagefind(),
	],
	vite: {
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
		},
		plugins: [
			{
				name: 'generate-robots-txt',
				closeBundle() {
					const outDir = path.join(process.cwd(), 'dist');
					const sitemapLine = siteUrl
						? `Sitemap: ${siteUrl.replace(/\/$/, '')}/sitemap-index.xml`
						: '';
					const body = ['User-agent: *', 'Allow: /', '', sitemapLine].filter(Boolean).join('\n');
					fs.writeFileSync(path.join(outDir, 'robots.txt'), body + '\n', 'utf-8');
				},
			},
		],
	},
});
