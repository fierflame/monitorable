import { safeify } from './utils';

const ValueMap = new WeakMap<object | Function, object | Function>();
const ProxyHandler: ProxyHandler<any> = {
	get(target, prop, receiver) {
		markRead(target, typeof prop === 'number' ? String(prop) : prop);
		return Reflect.get(target, prop, receiver);
		// return getProxy(Reflect.get(target, prop, receiver));
	},
	set(target, prop, value, receiver) {
		if (Reflect.get(target, prop, receiver) !== value) {
			markChange(target, typeof prop === 'number' ? String(prop) : prop);
		}
		return Reflect.set(target, prop, value, receiver);
	},
	// getOwnPropertyDescriptor(target, prop) {
	// 	markRead(target, typeof prop === 'number' ? String(prop) : prop);
	// 	const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
	// 	if (descriptor && 'value' in descriptor) {
	// 		descriptor.value = getProxy(descriptor.value);
	// 	}
	// 	return descriptor;
	// },
	// defineProperty(target, prop, attributes) {
	// 	// TODO
	// 	return Reflect.defineProperty(target, prop, attributes);
	// },
	// deleteProperty(target, prop) {
	// 	// TODO
	// 	return Reflect.deleteProperty(target, prop);
	// },
	// enumerate(target) {
	// 	// TODO
	// 	return [...Reflect.enumerate(target)];
	// },
};

function isProxyable(v: any): v is object | Function {
	return Boolean(v && ['object', 'function'].includes(typeof v));
}

export function getProxy<T>(v: T): T {
	if (!isProxyable(v)) { return v; }
	if (ValueMap.has(v)) { return v; }
	return new Proxy(v, ProxyHandler);
}
export function getValue<T>(v: T): T {
	return ValueMap.get(v as any) as T | undefined || v;
}
export function equal(a: any, b: any): boolean {
	return getValue(a) === getValue(b);
}

export type ReadMap =  Map<object | Function, Set<string | boolean | symbol>>;

/** 已被读取的 */
let read: ReadMap | undefined;

/**
 * 标记已读状态
 * @param obj  要标记的对象
 * @param prop 要标记的属性
 */
export function markRead(obj: object | Function, prop: string | number | boolean | symbol) {
	if (!read) { return; }
	const set = getMepValue(read, obj, () => new Set());
	if (typeof prop === 'number') {
		prop = String(prop);
	}
	set.add(prop);
}
export interface Executable<T> {
	(): T;
	stop(): void;
}
export function createExecutable<T>(fn: () => T, cb: (changed: boolean) => void): Executable<T> {
	cb = safeify(cb);
	let cancelList: (() => void)[] | undefined;
	/** 取消监听 */
	function cancel() {
		if (!cancelList) { return false; }
		const list = cancelList;
		cancelList = undefined;
		list.forEach(f => f());
		return true;
	}
	function trigger() {
		if (!cancel()) { return; }
		cb(true);
	};
	function exec() {
		cancel();
		const thisRead: typeof read = new Map();
		const oldRead = read;
		read = thisRead;
		try {
			return fn();
		} catch (e) {
			thisRead.clear();
			throw e;
		} finally {
			read = oldRead;
			if (thisRead.size) {
				cancelList = [];
				for ( let [obj, props] of thisRead) {
					for (const p of props) {
						cancelList.push(watchProp(obj, p, trigger));
					}
				}
			} else {
				cb(false);
			}
const watchList = new WeakMap<object | Function, Map<string | boolean | symbol, Set<() => void>>>();
/**
 * 标记属性的修改，同时触发监听函数
 * @param target 要标记的对象
 * @param prop   要标记的属性 特别的，false 表示原型，true 表示成员
 */
export function markChange(target: object | Function, prop: string | number | boolean | symbol) {
	if (!target) { return; }
	if (!(typeof target === 'object' || typeof target === 'function')) { return; }
	if (typeof prop === 'number') {
		prop = String(prop);
	} else if (typeof prop !== 'symbol' && typeof prop !== 'string' && typeof prop !== 'boolean') {
		return;
	}

	const watch = watchList.get(target)?.get?.(prop);
	if (!watch) { return; }
	for (const w of [...watch]) {
		w();
	}
}

/**
 * 监听对象属性的变化
 * @param target 要监听的对象
 * @param prop   要监听的属性名 特别的，false 表示原型，true 表示成员
 * @param fn     属性改变后触发的函数
 */
export function watchProp(target: object | Function, prop: string | number | boolean | symbol, cb: () => void): () => void {
	if (!target) { return () => {}; }
	if (!(typeof target === 'object' || typeof target === 'function')) { return () => {}; }
	if (typeof cb !== 'function') { return  () => {}; }
	if (typeof prop === 'number') { prop = String(prop); }
	if (typeof prop !== 'symbol' && typeof prop !== 'string' && typeof prop !== 'boolean') { return () => {}; }
	const key = prop;
	target = getValue(target);
	let map = watchList.get(target);
	if (!map) {
		map = new Map();
		watchList.set(target, map);
	}
	const list = getMepValue(map, key, () => new Set());
	cb = safeify(cb);
	list.add(cb);
	let removed = false;
	return () => {
		if (removed) { return; }
		removed = true;

		// 从当前列表中移除
		list.delete(cb);

		// 从属性关联中删除
		if (list.size) { return; }
		if (!map) { return; }
		map.delete(key);

		// 映射列表中删除
		if (map.size) { return; }
		watchList.delete(target);
	};

}
