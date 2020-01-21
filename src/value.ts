import { markRead, markChange, createExecutable, getValue, getProxy } from './state';
import { safeify } from './utils';

/** 取消监听的方法 */
export interface CancelWatch {
	(): void;
}
/** 可监听值 */
export interface Value<T> {
	(): T;
	(v: T): T;
	value: T;
	watch(cb: WatchCallback<T, this>): CancelWatch;
	stop(): void;
}
/** 监听函数 */
export interface WatchCallback<T, V extends Value<T> = Value<T>> {
	(v: V, stoped: boolean): void;
}
const values = new WeakSet<Value<any>>();
export function isValue(x: any): x is Value<any> {
	return values.has(x);
}
/** 触发监听 */
interface Trigger {
	(): void;
	/** 是否存在监听函数 */
	has(): boolean;
	/** 停止监听 */
	stop(): void;
}
export interface Options {
	proxy?: boolean;
}


function createValue<T, V extends Value<T> = Value<T>>(
	setValue: (value: T, markChange: () => void) => void,
	getValue: () => T,
	stop: () => void = () => {},
	change: () => void = () => {},
) {
	function set(v: T) {
		let marked = false;
		try {
			return setValue(v, () => { marked = true; });
		} finally {
			if (marked) {
				trigger();
			}
		}
	}
	function get() {
		markRead(value, 'value');
		return getValue();
	}
	const value: V = ((...v: [T] | []): T => {
		if (v.length) {
			set(v[0]);
			return v[0];
		}
		return get();
	}) as V;
	Reflect.defineProperty(value, 'value', {
		get,
		set,
		enumerable: true,
		configurable: true,
	});

	function watch(cb: WatchCallback<T, V>): () => void {
		if (!callbacks) { return () => {}; }
		cb = safeify(cb);
		callbacks.push(cb);
		change();
		let cancelled = false;
		return () => {
			if (cancelled) { return; }
			cancelled = true;
			if (!callbacks) { return; }
			const index = callbacks.findIndex(a => a === cb);
			if (index < 0) { return; }
			callbacks.splice(index, 1);
			change();
		};
	}
	let callbacks: WatchCallback<T, V>[] | undefined = [];
	Reflect.defineProperty(value, 'watch', {
		get() { return watch; },
		set() {},
		configurable: true,
	});
	const trigger = (() => {
		if (!callbacks) { return; }
		markChange(value, 'value');
		for (const cb of [...callbacks]) {
			cb(value, false);
		}
	}) as Trigger;
	trigger.has = () => Boolean(callbacks?.length);
	trigger.stop = () => {
		if (!callbacks) { return; }
		const list = callbacks;
		callbacks = undefined;
		for (const cb of [...list]) {
			cb(value, true);
		}
	};
	values.add(value);
	let stoped = false;
	value.stop = () => {
		if (stoped) { return; }
		stoped = true;
		stop();
		trigger.stop();

	};
	return {value, trigger};
}
export function value<T>(value: T, options?: Options | boolean): Value<T>;
export function value<T>(def: T, options?: Options | boolean): Value<T> {
	const proxy = options === true || options && options.proxy;
	let source: T;
	let proxyed: T;
	const { value } = createValue<T>(
		(v, mark) => {
			if (proxy) { v = getValue(v); }
			if (v === source) { return; }
			source = v;
			proxyed = proxy ? getProxy(source) : source;
			mark();
		},
		() => proxyed,
	);
	value(def);
	return value;
}

/** 计算值 */
export function computed<T>(source: () => T, options?: Options | boolean): Value<T>;
export function computed<T>(getter: () => T, options?: Options | boolean): Value<T> {
	const proxy = options === true || options && options.proxy;
	let source: T;
	let proxyed: T;
	let stoped = false;
	let computed = false;
	let trigger: Trigger | undefined;
	const executable = createExecutable(getter, changed => {
		computed = !changed;
		if (changed  && trigger) {
			trigger();
		}
	});
	function run() {
		computed = true;
		try {
			source = executable();
			if (proxy) { source = getValue(source); }
			proxyed = proxy ? getProxy(source) : source;
			return proxyed;
		} catch(e) {
			if (!stoped) {
				computed = false;
			}
			throw e;
		}

	}
	let value: Value<T>;
	({value, trigger} = createValue<T, Value<T>>(
		(v: T, mark) => {
			// TODO
			// v = getValue(v);
			// if (v === source) { return; }
			// source = v;
			// mark();
		},
		() => computed || stoped ? proxyed : run(),
		() => {
			if (stoped) { return; }
			stoped = true;
			if (computed) { return; }
			run();
		},
	));
	return value;

}

export function merge<T, V extends Value<T> = Value<T>>(cb: WatchCallback<T, V>): WatchCallback<T, V> {
	let oldValue: any;
	let runed = false;
	return (v, stoped) => {
		if (stoped) { return cb(v, stoped); }
		const newValue = getValue(v());
		if (newValue === oldValue && runed) { return; }
		runed = true;
		oldValue = newValue;
		cb(v, stoped);
	};
}

type OffValue<V> = V extends Value<infer T> ? T : V;

export function mix<T extends object>(source: T): { [K in keyof T]: OffValue<T[K]>; } {
	for (const k of Reflect.ownKeys(source)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(source, k);
		if (!descriptor) { continue; }
		if ('get' in descriptor || 'set' in descriptor || !('value' in descriptor)) { continue; }
		const value = descriptor.value;
		if (!isValue(value)) { continue; }
		descriptor.get = () => value();
		if (descriptor.writable) {
			descriptor.set = (v) => value(v);
		}
		delete descriptor.value;
		delete descriptor.writable;
		Reflect.defineProperty(source, k, descriptor);
	}
	return source as any;
}
