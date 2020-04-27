import { safeify } from './utils';
import { markRead, markChange } from './mark';
import { recover, encase } from './encase';
import { monitor } from './monitor';

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
	toString(...p: T extends {toString(...p: infer P): string} ? P : any): string;
	valueOf(): T extends {valueOf(): infer R} ? R : T;
}
export type DeValue<T> = T extends Value<infer V> ? V : T;
export type EnValue<T> = Value<DeValue<T>>;
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


function valueOf<T>(this: Value<T>) {
	const value = this();
	if (value === undefined) { return value; }
	if (value === null) { return value; }
	return (value as any).valueOf();
}
function toString<T>(this: Value<T>, ...p: any) {
	const value = this();
	if (value === undefined) { return String(value); }
	if (value === null) { return String(value); }
	if (typeof (value as any).toString === 'function') {
		return (value as any).toString(...p);
	}
	return String(value);
}
function toPrimitive<T>(this: Value<T>, hint?: 'string' | 'number' | 'default') {
	const value = this();
	if (value === undefined) { return String(value); }
	if (value === null) { return String(value); }
	if (typeof (value as any)[Symbol.toPrimitive] === 'function') {
		return (value as any)[Symbol.toPrimitive](hint);
	}
	if (hint === 'string') {
		return String(value);
	}
	if (hint === 'number') {
		return Number(value);
	}
	return value;
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
	Reflect.defineProperty(value, 'valueOf', {
		value: valueOf,
		enumerable: true,
		configurable: true,
	});
	Reflect.defineProperty(value, 'toString', {
		value: toString,
		enumerable: true,
		configurable: true,
	});

	Reflect.defineProperty(value, Symbol.toPrimitive, {
		value: toPrimitive,
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

export interface ComputedOptions {
	postpone?: boolean | 'priority';
	proxy?: boolean;
}
/**
 * 创建计算值
 * @param getter 取值方法
 * @param options 选项
 */
export function computed<T>(
	getter: () => T,
	options?: ComputedOptions | boolean,
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
	options?: ComputedOptions | boolean,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | ComputedOptions | boolean,
	options?: ComputedOptions | boolean,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | ComputedOptions | boolean,
	options?: ComputedOptions | boolean,
): Value<T> {
	if (typeof setter !== 'function') {
		options = setter;
		setter = undefined;
	}
	const setValue = setter;
	const proxy = options === true || options && options.proxy;
	const postpone = typeof options === 'object' && options?.postpone;
	let source: T;
	let proxyValue: T;
	let stopped = false;
	let computed = false;
	let trigger: Trigger | undefined;
	const executable = monitor(changed => {
		computed = !changed;
		if (changed  && trigger) {
			trigger();
		}
	}, getter, { postpone });
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
