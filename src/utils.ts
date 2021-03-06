
let printErrorLog: undefined | ((info: any) => void);
/** 打印错误 */
export function printError(info: any) {
	if (typeof printErrorLog === 'function') {
		printErrorLog(info);
		return;
	}
	console.error(info);
}

export function setPrintError(p?: (info: any) => void) {
	printErrorLog = typeof p === 'function' ? p : undefined;
}

/**
 * 判断对象是否可被代理
 */
export function encashable(v: any): v is object | Function {
	return Boolean(v && ['object', 'function'].includes(typeof v));
}


/** 回调函数安全化处理 */
export function safeify<T extends any[]>(
	fn: (...p: T) => void
): (...p: T) => void {
	return (...p) => {
		try {
			fn(...p);
		} catch(e) {
			printError(e);
		}
	};
}

/** 回调函数安全化处理 */
export function safeCall(
	fn: () => void
): void {
	try {
		fn();
	} catch(e) {
		printError(e);
	}
}
export function getIndexes(
	target: any,
	prop: string | number | symbol | boolean,
): [object | Function, string | boolean | symbol] | undefined {
	if (!target) { return undefined; }
	if (typeof target !== 'function' && typeof target !== 'object') {
		return undefined;
	}
	if (typeof prop === 'number') { return [target, String(prop)]; }
	if (typeof prop === 'symbol') { return [target, prop]; }
	if (typeof prop === 'string') { return [target, prop]; }
	if (typeof prop === 'boolean') { return [target, prop]; }
	return undefined;
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
