import { safeify } from './utils';
import { markRead, markChange } from './state';
import { recover, encase } from './encase';
import { createExecutable } from './executable';

/** 取消监听的方法 */
export interface CancelWatch {
	(): void;
}
/** 可监听值 */
export interface Value<T> {
	(): T;
	(v: T, mark?: boolean): T;
	value: T;
	watch(cb: WatchCallback<T, this>): CancelWatch;
	stop(): void;
}
/** 监听函数 */
export interface WatchCallback<T, V extends Value<T> = Value<T>> {
	(v: V, stopped: boolean): void;
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
	recover: () => T,
	setValue?: (value: T, markChange: () => void) => void,
	stop: () => void = () => {},
	change: () => void = () => {},
): {value: V, trigger: Trigger} {
	function set(v: T, marked = false) {
		if (!setValue) { return; }
		try {
			setValue(v, () => { marked = true; });
		} finally {
			if (marked) {
				trigger();
			}
		}
	}
	function get() {
		markRead(value, 'value');
		return recover();
	}
	const value: V = ((...v: [T] | [T, boolean] | []): T => {
		if (v.length) {
			set(v[0], v[1]);
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
	let stopped = false;
	value.stop = () => {
		if (stopped) { return; }
		stopped = true;
		stop();
		trigger.stop();

	};
	return {value, trigger};
}
/**
 * 创建引用值
 * @param value 初始值
 * @param options 选项
 */
export function value<T>(
	value: T,
	options?: Options | boolean,
): Value<T>;
export function value<T>(
	def: T,
	options?: Options | boolean,
): Value<T> {
	const proxy = options === true || options && options.proxy;
	let source: T;
	let proxyValue: T;
	const { value } = createValue<T>(
		() => proxyValue,
		(v, mark) => {
			if (proxy) { v = recover(v); }
			if (v === source) { return; }
			source = v;
			proxyValue = proxy ? encase(source) : source;
			mark();
		},
	);
	value(def);
	return value;
}

/**
 * 创建计算值
 * @param getter 取值方法
 * @param options 选项
 */
export function computed<T>(
	getter: () => T,
	options?: Options | boolean,
): Value<T>;
/**
 * 创建可赋值计算值
 * @param getter 取值方法
 * @param setter 复制方法
 * @param options 选项
 */
export function computed<T>(
	getter: () => T,
	setter: (value: T) => void,
	options?: Options | boolean,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | Options | boolean,
	options?: Options | boolean,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | Options | boolean,
	options?: Options | boolean,
): Value<T> {
	if (typeof setter !== 'function') {
		options = setter;
		setter = undefined;
	}
	const setValue = setter;
	const proxy = options === true || options && options.proxy;
	let source: T;
	let proxyValue: T;
	let stopped = false;
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
			if (proxy) { source = recover(source); }
			proxyValue = proxy ? encase(source) : source;
			return proxyValue;
		} catch(e) {
			if (!stopped) {
				computed = false;
			}
			throw e;
		}
	}
	let value: Value<T>;
	({value, trigger} = createValue<T, Value<T>>(
		() => computed || stopped ? proxyValue : run(),
		setValue && (v => setValue(proxy ? recover(v) : v)),
		() => {
			if (stopped) { return; }
			stopped = true;
			if (computed) { return; }
			run();
		},
	));
	return value;

}

export function merge<T, V extends Value<T> = Value<T>>(
	cb: WatchCallback<T, V>
): WatchCallback<T, V> {
	let oldValue: any;
	let ran = false;
	return (v, stopped) => {
		if (stopped) { return cb(v, stopped); }
		const newValue = recover(v());
		if (newValue === oldValue && ran) { return; }
		ran = true;
		oldValue = newValue;
		cb(v, stopped);
	};
}

type OffValue<V> = V extends Value<infer T> ? T : V;

export function mix<T extends object>(
	source: T
): { [K in keyof T]: OffValue<T[K]>; } {
	for (const k of Reflect.ownKeys(source)) {
		const descriptor = Reflect.getOwnPropertyDescriptor(source, k);
		if (!descriptor) { continue; }
		if (
			!('value' in descriptor)
			|| 'get' in descriptor
			|| 'set' in descriptor
		) { continue; }
		const value = descriptor.value;
		if (!isValue(value)) { continue; }
		descriptor.get = () => value.value;
		if (descriptor.writable) {
			descriptor.set = v => (value as Value<any>).value = v;
		}
		delete descriptor.value;
		delete descriptor.writable;
		Reflect.defineProperty(source, k, descriptor);
	}
	return source as any;
}
