
let printErrorLog: undefined | ((info: any) => void);
/** 设置或移除错误打印函数 */
export function printError(fn?: (info: any) => void): void;
/** 打印错误 */
export function printError(info: any, print: true): void;
/** 打印错误 */
export function printError(info: any): void;
export function printError(info?: string | Error | ((info: any) => void), print = false) {
	if (!print && (typeof info === 'function' || info === undefined)) {
		printErrorLog = info;
		return;
	}
	if (typeof printErrorLog === 'function') {
		printErrorLog(info);
		return;
	}
	console.error(info);
}

/** 回调函数安全化处理 */
export function safeify<T extends any[]>(fn: (...p: T) => void): (...p: T) => void {
	return (...p) => {
		try {
			fn(...p);
		} catch(e) {
			printError(e, true);
		}
	};
}

export function getMapValue<K, V>(
	map: Map<K, V>,
	key: K,
	def: () => V,
): V;
export function getMapValue<K extends object, V>(
	map: WeakMap<K, V>,
	key: K,
	def: () => V,
): V;
export function getMapValue<K, V>(
	map: WeakMap<K & object, V> | Map<K, V>,
	key: K,
	def: () => V,
): V {
	if (map.has(key as any)) {
		return map.get(key as any)!;
	}
	const value = def();
	map.set(key as any, value);
	return value;
}
