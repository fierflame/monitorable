import {
	Value,
	computed,
	isValue,
} from './value';

export type DeValue<T> = T extends Value<infer V> ? V : T;
export type EnValue<T> = Value<DeValue<T>>;

export interface Valueify<T> {
	<K extends keyof T>(
		key: K,
		def?: Value<DeValue<T[K]> | undefined>,
		set?: (value: DeValue<T[K]>, setted: boolean) => void
	): Value<DeValue<T[K]> | undefined>
}

function createValue<T, K extends keyof T>(
	props: T,
	key: K,
	def?: Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean) => void,
): Value<DeValue<T[K]> | undefined> {
	function setValue(value: DeValue<T[K]>, setted: boolean): void {
		if (!set) { return; }
		set(value, setted);
	}
	return computed(() => {
		const p = props[key];
		if (p === undefined && def) { return def(); }
		return isValue(p) ? p() : p;
	}, v => {
		const p = props[key];
		if (isValue(p)) {
			p(v);
			setValue(v, true);
			return;
		}
		if (p === undefined && def) {
			def(v);
			setValue(v, false);
			return;
		}
		setValue(v, false);
	});
}
export function valueify<T extends object>(props: T): Valueify<T>;
export function valueify<T extends object, K extends keyof T>(
	props: T,
	key: K,
	def?: Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean) => void,
): Value<DeValue<T[K]> | undefined>;
export function valueify<T extends object, K extends keyof T>(
	props: T,
	key: K[],
	def?: (key: K) => Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean, key: K) => void,
): {[k in K]: Value<DeValue<T[k]> | undefined>};
export function valueify<T extends object, K extends keyof T>(
	props: T,
	key?: K | K[],
	def?: (key: K) => Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean, key?: K) => void
): Valueify<T>
| Value<DeValue<T[K]> | undefined>
| {[k in K]: Value<DeValue<T[k]> | undefined>} {
	if (!key) {
		return (k, d, s) => createValue(props, k, d, s);
	}
	if (!Array.isArray(key)) {
		return createValue(
			props,
			key,
			def as Value<DeValue<T[K]> | undefined>,
			set,
		);
	}
	const r = Object.create(null);
	for (const k of key) {
		const value = createValue(
			props,
			k,
			def && def(k),
			set && ((v, s) => set!(v, s, k))
		);
		Reflect.defineProperty(props, k, {
			get() { return value(); },
			set(v) { value.value = v; },
			configurable: true,
			enumerable: true,
		});
	}
	return r;
}
export function mixValue<T extends object, K extends keyof T>(
	source: T,
	props = Reflect.ownKeys(source) as K[] | {
		[k in K]?: Value<DeValue<T[k]> | undefined>;
	},
	set?: (value: DeValue<T[K]>, setted: boolean, key?: K) => void
): { [k in keyof T]: k extends K ? DeValue<T[k]> : T[k]; } {
	const p = Object.create(source);
	if (Array.isArray(props)) {
		for (const key of props) {
			const value = createValue(
				source,
				key,
				undefined,
				set && ((v, s) => set!(v, s, key))
			);
			Reflect.defineProperty(p, key, {
				get() { return value(); },
				set(v) { value.value = v; },
				configurable: true,
				enumerable: true,
			});
		}
		return p;
	}
	const keys = Reflect.ownKeys(props) as K[];
	for (const key of keys) {
		const value = createValue(
			source,
			key,
			props[key],
			set && ((v, s) => set!(v, s, key))
		);
		Reflect.defineProperty(p, key, {
			get() { return value(); },
			set(v) { value.value = v; },
			configurable: true,
			enumerable: true,
		});
	}
	return p;
}

export interface AsValue<T> {
	<K extends keyof T>(key: K): EnValue<T[K]>
}

function createAsValue<T, K extends keyof T>(
	props: T,
	key: K,
): EnValue<T[K]> {
	return computed(() => {
		const p = props[key];
		return isValue(p) ? p() : p;
	}, v => {
		const p = props[key];
		if (isValue(p)) {
			p(v);
		} else {
			props[key] = v;
		}
	});
}
export function asValue<T>(props: T): AsValue<T>;
export function asValue<T, K extends keyof T>(
	props: T,
	key: K,
): EnValue<T[K]>;
export function asValue<T, K extends keyof T>(
	props: T,
	key?: K,
): AsValue<T> | EnValue<T[K]> {
	if (arguments.length >= 2) {
		return createAsValue(props, key!);
	}
	return k => createAsValue(props, k);
}
