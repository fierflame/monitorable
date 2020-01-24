/** 回调函数安全化处理 */
export function safeify<T extends any[]>(fn: (...p: T) => void): (...p: T) => void {
	return (...p) => {
		try {
			fn(...p);
		} catch(e) {
			console.error(e);
		}
	};
}

export function getMepValue<K, V>(map: Map<K, V>, key: K, def: () => V): V {
	if (map.has(key)) {
		return map.get(key)!;
	}
	const value = def();
	map.set(key, value);
	return value;
}
