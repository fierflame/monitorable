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

/** 已被读取的 */
let read: Map<object | Function, Set<string | symbol>> | undefined;
export function markRead(obj: object | Function, prop: string | symbol) {
	if (!read) { return; }
	let set = read.get(obj);
	if (!set) {
		set = new Set();
		read.set(obj, set);
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
		}
	}
	exec.stop = () => {
		if (!cancel()) { return; }
		cb(false);
	};
	return exec;
}


export const watchList = new WeakMap<object | Function, Map<string | symbol, (() => void)[]>>();

/**
 * 监听对象属性的变化
 * @param v 要监听属性的值
 * @param key 要监听的属性名
 * @param f 属性改变后触发的函数
 */
export function watchProp(v: object | Function, key: string | symbol, f: () => void): () => void {
	if (!v) { return () => {}; }
	if (!(typeof v === 'object' || typeof v === 'function')) { return () => {}; }
	if (typeof f !== 'function') { return  () => {}; }
	if (typeof key !== 'symbol' && typeof key !== 'string') { return () => {}; }
	v = getValue(v);
	let map = watchList.get(v);
	if (!map) {
		map = new Map();
		watchList.set(v, map);
	}
	let list = map.get(key);
	if (!list) {
		list = [];
		map.set(key, list);
	}
	list.push(f);
	let removed = false;
	return () => {
		if (removed) { return; }
		removed = true;

		// 从当前列表中移除
		if (!list) { return; }
		const index = list.findIndex(a => a === f);
		if (index < 0) { return; }
		list.splice(index, 1);

		// 从属性关联中删除
		if (list.length) { return; }
		if (!map) { return; }
		map.delete(key);

		// 映射列表中删除
		if (map.size) { return; }
		watchList.delete(v);
	};

}

/** 
 * 标记属性的修改，同时触发监听函数
 */
export function markChange(v: object | Function, key: string | symbol) {
	if (!v) { return; }
	if (!(typeof v === 'object' || typeof v === 'function')) { return; }
	if (typeof key === 'number') {
		key = String(key);
	} else if (typeof key !== 'symbol' && typeof key !== 'string') {
		return;
	}

	const watch = watchList.get(v)?.get?.(key);
	if (!watch) { return; }
	for (const w of [...watch]) {
		try {
			w();
		} catch(e){
			console.error(e);
		}
	}
}
