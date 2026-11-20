export const SITE_TITLE = "itojum.dev";
export const SITE_DESCRIPTION =
	"itojum（いとじゅん）の個人サイト。プロフィールやブログなどを公開しています。";

export const EMAIL_ADDRESS = "me@itojum.dev";

export const X_URL = "https://x.com/itojum1230";
/** X のユーザー名（twitter:site / twitter:creator 用。X_URL から導出） */
export const X_HANDLE = `@${X_URL.replace(/\/+$/, "").split("/").pop()}`;
export const X_URL_HOBBY = "https://x.com/itojum2030";
export const GITHUB_URL = "https://github.com/itojum";
export const SPEAKERDECK_URL = "https://speakerdeck.com/itojum";
/** ブログ一覧に記事を載せる Qiita のユーザー ID */
export const QIITA_USER_ID = "itojum";

export const LINKS = [
	{
		service: "GitHub",
		url: GITHUB_URL,
		icon: "ri:github-fill",
		name: "itojum",
	},
	{
		service: "X",
		url: X_URL,
		icon: "ri:twitter-x-line",
		name: "@itojum1230",
	},
	{
		service: "VRChat",
		url: "https://vrchat.com/home/user/usr_e7576e86-ee7d-4083-9561-9cba619067d1",
		icon: null,
		name: "いとじゅん",
	},
	{
		service: "speakerdeck",
		url: SPEAKERDECK_URL,
		icon: null,
		name: "itojum",
	},
];
