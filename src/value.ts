import { safeCall } from './utils';
import { markRead, markChange, watchProp } from './mark';
import { monitor } from './monitor';

/** 取消监听的方法 */
export interface CancelWatch {
	(): void;
}
/** 监听函数 */
export interface WatchCallback<T, V extends Value<T> = Value<T>> {
	(v: V, stopped: boolean): void;
}
/** 可监听值 */
export interface Value<T> {
	(): T;
	(v: T, mark?: boolean): T;
	value: T;
	watch(cb: WatchCallback<T, this>, disdeferable?: boolean): CancelWatch;
	stop(): void;
	toString(...p: T extends {toString(...p: infer P): string} ? P : any): string;
	valueOf(): T extends {valueOf(): infer R} ? R : T;
}
const valueSignKey = '__$$__monitorable_value__$$__';
export function isValue(x: any): x is Value<any> {
	return Boolean(typeof x === 'function' && x[valueSignKey]);
}
/** 触发监听 */
interface Trigger {
	(): void;
	/** 是否存在监听函数 */
	has(): boolean;
	/** 停止监听 */
	stop(): void;
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

	let stopList: Set<() => void> | undefined = new Set();
	function watch(
		cb: WatchCallback<T, V>,
		disdeferable?: boolean,
	): () => void {
		if (!stopList) { return () => {}; }
		const cancel = watchProp(
			value,
			'value',
			() => cb(value, false),
			disdeferable,
		);
		let cancelled = false;
		const stop = () => {
			if (cancelled) { return; }
			cancelled = true;
			if (stopList) { stopList.delete(stop); }
			cancel();
			safeCall(() => cb(value, true));
		};
		stopList.add(stop);
		change();
		return () => {
			if (cancelled) { return; }
			cancelled = true;
			if (stopList) { stopList.delete(stop); }
			cancel();
			change();
		};
	}
	Reflect.defineProperty(value, 'watch', {
		get() { return watch; },
		set() {},
		configurable: true,
	});
	const trigger = (() => markChange(value, 'value')) as Trigger;
	trigger.has = () => Boolean(stopList?.size);
	trigger.stop = () => {
		if (!stopList) { return; }
		const list = stopList;
		stopList = undefined;
		for (const stop of [...list]) {
			stop();
		}
	};
	Reflect.defineProperty(value, valueSignKey, { value: true, configurable: true });
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
export function value<T>(def: T): Value<T> {
	let source: T;
	let proxyValue: T;
	const { value } = createValue<T>(
		() => proxyValue,
		(v, mark) => {
			if (v === source) { return; }
			source = v;
			proxyValue = source;
			mark();
		},
	);
	value(def);
	return value;
}

export interface ComputedOptions {
	postpone?: boolean | 'priority';
	deferable?: boolean;
}
/**
 * 创建计算值
 * @param getter 取值方法
 * @param options 选项
 */
export function computed<T>(
	getter: () => T,
	options?: ComputedOptions,
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
	options?: ComputedOptions,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | ComputedOptions,
	options?: ComputedOptions,
): Value<T>;
export function computed<T>(
	getter: () => T,
	setter?: ((value: T) => void) | ComputedOptions,
	options?: ComputedOptions,
): Value<T> {
	if (typeof setter !== 'function') {
		options = setter;
		setter = undefined;
	}
	const setValue = setter;
	const postpone = options?.postpone;
	const deferable = options?.deferable;
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
	}, getter, { postpone, disdeferable: !deferable });
	function run() {
		computed = true;
		try {
			source = executable();
			proxyValue = source;
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
		setValue && (v => setValue(v)),
		() => {
			if (stopped) { return; }
			stopped = true;
			if (computed) { return; }
			run();
		},
	));
	return value;

}
