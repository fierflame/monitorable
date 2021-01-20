import { markChange, markRead } from './mark';
export function defineProperty<
	T extends object,
	K extends keyof T,
	V extends T[K]
>(obj: T, key: K, val: V): boolean {
	return Reflect.defineProperty(obj, key, {
		get() {
			markRead(obj, key);
			return val;
		},
		set(v) {
			if (v === val) { return; }
			val = v;
			markChange(obj, key);
		},
		configurable: true,
		enumerable: true,
	});
}
export function createObject<T extends object>(
	keys: (keyof T)[],
	base: T | null = {} as T,
	create?: boolean
): T {
	const obj = create || base === null ? Object.create(base) : base;
	for (const key of keys) {
		let val = obj[key];
		Reflect.defineProperty(obj, key, {
			get() {
				markRead(obj, key);
				return val;
			},
			set(v) {
				if (v === val) { return; }
				val = v;
				markChange(obj, key);
			},
			configurable: true,
			enumerable: true,
		});
	}
	return obj;
}

export function get<
	T extends object,
	K extends keyof T,
>(obj: T, key: K): T[K] {
	markRead(obj, key);
	return obj[key];
}

export function set<
	T extends object,
	K extends keyof T,
	V extends T[K]
>(obj: T, key: K, v: V): V {
	if (v === obj[key]) { return v; }
	obj[key] = v;
	markChange(obj, key);
	return v;
}
