
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	type MatcherParam<M> = M extends (param : string) => param is (infer U extends string) ? U : string;

	export interface AppTypes {
		RouteId(): "/" | "/login" | "/operation-logs" | "/progress-reports" | "/progress-reports/new" | "/progress-reports/[id]" | "/progress-reports/[id]/edit";
		RouteParams(): {
			"/progress-reports/[id]": { id: string };
			"/progress-reports/[id]/edit": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string | undefined };
			"/login": Record<string, never>;
			"/operation-logs": Record<string, never>;
			"/progress-reports": { id?: string | undefined };
			"/progress-reports/new": Record<string, never>;
			"/progress-reports/[id]": { id: string };
			"/progress-reports/[id]/edit": { id: string }
		};
		Pathname(): "/" | "/login" | "/operation-logs" | "/progress-reports" | "/progress-reports/new" | `/progress-reports/${string}` & {} | `/progress-reports/${string}/edit` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}