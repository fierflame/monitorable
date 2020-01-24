import { safeify, getMepValue } from './utils';

const ValueMap = new WeakMap<object | Function, object | Function>();

/**
 * 判断对象是否可被代理
 */
function isProxyable(v: any): v is object | Function {
	return Boolean(v && ['object', 'function'].includes(typeof v));
}

/**
 * 获取被代理对象
 * @param value 要被代理的对象
 * @param nest 递归代理的层数
 */
export function getProxy<T>(value: T, nest: number | boolean = 0): T {
	if (!isProxyable(value)) { return value; }
	if (ValueMap.has(value)) { return value; }
	const nestLayer: number = nest === true ? Infinity : nest || 0;
	const proxy = new Proxy(value, {
		set(target, prop, value, receiver) {
			if (nest === false) { return Reflect.set(target, prop, value, receiver); }
			const has = Reflect.has(target, prop);
			const modified = Reflect.set(target, prop, value, getProxy(receiver));
			if (!modified) { return modified; }
			if (has !== Reflect.has(target, prop)) {
				markChange(target, true);
			}
			return modified;
		},
		get(target, prop, receiver) {
			if (nest === false) { return Reflect.get(target, prop, receiver); }
			markRead(target, prop);
			const value = Reflect.get(target, prop, getProxy(receiver));
			if (nestLayer > 0) {
				return getProxy(value, nestLayer - 1);
			}
			return value;
		},
		setPrototypeOf(target, proto) {
			if (nest === false) { return Reflect.setPrototypeOf(target, proto); }
			const oldProto = Reflect.getPrototypeOf(target);
			const modified = Reflect.setPrototypeOf(target, proto);
			if (modified && oldProto !== proto) {
				markChange(target, false);
			}
			return modified;
		},
		getPrototypeOf(target) {
			if (nest === false) { return Reflect.getPrototypeOf(target); }
			markRead(target, false);
			const value: any = Reflect.getPrototypeOf(target);
			if (nestLayer > 0) {
				return getProxy(value, nestLayer - 1);
			}
			return value;
		},
		defineProperty(target, prop, attributes) {
			if (nest === false) { return Reflect.defineProperty(target, prop, attributes); }
			let changed = true;
			if ('value' in attributes) {
				const descriptor = Reflect.getOwnPropertyDescriptor(target, prop);
				if (descriptor && 'value' in descriptor && getValue(attributes.value) === getValue(descriptor.value)) {
					changed = false;
				}
			}
			const modified = Reflect.defineProperty(target, prop, attributes);
			if (changed && modified) {
				markChange(target, prop);
			}
			return modified;
		},
		getOwnPropertyDescriptor(target, prop) {
			if (nest === false) { return Reflect.getOwnPropertyDescriptor(target, prop); }
			markRead(target, prop);
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
		deleteProperty(target, prop) {
			if (nest === false) { return Reflect.deleteProperty(target, prop); }
			const has = Reflect.has(target, prop);
			const deleted = Reflect.deleteProperty(target, prop);
			if (has && !Reflect.has(target, prop)) {
				markChange(target, prop);
				markChange(target, true);
			}
			return deleted;
		},
		ownKeys(target) {
			if (nest === false) { return Reflect.ownKeys(target); }
			markRead(target, true);
			return Reflect.ownKeys(target);
		},
		has(target, prop) {
			if (nest === false) { return Reflect.has(target, prop); }
			markRead(target, true);
			return Reflect.has(target, prop);
		},
	});
	return proxy;
}
/** 获取被代理的原始值 */
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
