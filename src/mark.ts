import { safeify, getMapValue, getIndexes } from './utils';

export type ReadMap = Map<
	object | Function,
	Map<string | boolean | symbol, boolean>
>;

/** 已被读取的 */
let read: ReadMap | undefined;

/**
 * 标记已读状态
 * @param obj  要标记的对象
 * @param prop 要标记的属性
 */
export function markRead(
	target: object | Function,
	prop: string | number | boolean | symbol,
) {
	if (!read) { return; }
	const indexes = getIndexes(target, prop);
	if (!indexes) { return; }
	[target, prop] = indexes;
	const propMap = getMapValue(read, target, () => new Map());
	if (propMap.has(prop)) { return; }
	propMap.set(prop, false);
}
export interface ObserveOptions {
	postpone?: boolean | 'priority';
}
/**
 * 监听函数的执行，并将执行过程中读取的对象值设置到 map 中
 * @param fn 要执行的含糊
 * @param map 用于存储被读取对象的 map
 */
function observeRun<T>(
	map: ReadMap,
	fn: () => T,
	options?: ObserveOptions,
): T {
	const oldRead = read;
	read = map;
	try {
		if (!options?.postpone) { return fn(); }
		return postpone(fn, options.postpone === 'priority');
	} finally {
		read = oldRead;
	}
}
export function observe<T>(
	map: ReadMap,
	fn: () => T,
	priority?: ObserveOptions,
): T;
export function observe<T>(
	map: ReadMap,
	priority: ObserveOptions,
	f: () => T,
): T;
export function observe<T>(
	map: ReadMap,
	fn: (() => T) | ObserveOptions | undefined,
	options?: (() => T) | ObserveOptions | undefined
): T;
export function observe<T>(
	map: ReadMap,
	fn: (() => T) | ObserveOptions | undefined,
	options?: (() => T) | ObserveOptions | undefined
): T {

	if (typeof fn === 'function') {
		return observeRun(map, fn, options as ObserveOptions | undefined);
	}
	if (typeof options !== 'function') {
		throw new Error('fn needs to be a function');
	}
	return observeRun(map, options, fn);
}


const watchList = new WeakMap<
	object | Function,
	Map<string | boolean | symbol, Set<[() => void, boolean]>>
>();

function execWatch(
	target: object | Function,
	prop: string | boolean | symbol,
	filter?: (isNonDeforred: boolean) => boolean,
) {
	const watch = watchList.get(target)?.get(prop);
	if (!watch) { return; }
	let list = [...watch];
	if (filter) {
		list = list.filter(([, t]) => filter(t));
	}
	list.forEach(([w]) => w());
}

type MarkMap = Map<
	object | Function,
	Set<string | boolean | symbol>
>;
let waitList: MarkMap | undefined;

function runDeferred(list: MarkMap) {
	for (const [target, set] of list.entries()) {
		const propMap = read?.get(target);
		for (const prop of set) {
			execWatch(target, prop, t => !t);
			if (propMap?.has(prop)) {
				propMap.set(prop, true);
			}
		}
	}
}


function postponeRun<T>(f: () => T, priority?: boolean): T {
	const list = !priority && waitList || new Map();
	const old = waitList;
	waitList = list;
	try {
		return f();
	} finally {
		waitList = old;
		if (list !== waitList) { runDeferred(list); }
	}
}
export function postpone<T>(priority: boolean, f: () => T): T;
export function postpone<T>(fn: () => T, priority?: boolean): T;
export function postpone<T>(
	fn: (() => T) | boolean | undefined,
	priority?: (() => T) | boolean | undefined
): T;
export function postpone<T>(
	fn: (() => T) | boolean | undefined,
	priority?: (() => T) | boolean | undefined
): T {
	if (typeof fn === 'function') {
		return postponeRun(fn, priority as boolean | undefined);
	}
	if (typeof priority !== 'function') {
		throw new Error('fn needs to be a function');
	}
	return postponeRun(priority, fn);
}


function wait(
	target: object | Function,
	prop: string | boolean | symbol,
) {
	if (!waitList) { return false; }
	getMapValue(waitList, target, () => new Set()).add(prop);
	return true;
}

/**
 * 标记属性的修改，同时触发监听函数
 * @param target 要标记的对象
 * @param prop   要标记的属性 特别的，false 表示原型，true 表示成员
 */
export function markChange(
	target: object | Function,
	prop: string | number | boolean | symbol,
) {

	const indexes = getIndexes(target, prop);
	if (!indexes) { return; }
	[target, prop] = indexes;
	if (wait(target, prop)) {
		execWatch(target, prop, Boolean);
		return;
	}
	execWatch(target, prop);
}

/**
 * 观察对象属性的变化
 * @param target 要观察的对象
 * @param prop   要观察的属性名 特别的，false 表示原型，true 表示成员
 * @param fn     属性改变后触发的函数
 */
export function watchProp(
	target: object | Function,
	prop: string | number | boolean | symbol,
	cb: () => void,
	disdeferable: boolean = false,
): () => void {
	if (typeof cb !== 'function') { return  () => {}; }
	const indexes = getIndexes(target, prop);
	if (!indexes) { return () => {}; }
	[target, prop] = indexes;

	const key = prop;
	let map = watchList.get(target);
	if (!map) {
		map = new Map();
		watchList.set(target, map);
	}
	const list = getMapValue(map, key, () => new Set());
	const item: [() => void, boolean] = [safeify(cb), disdeferable];
	list.add(item);
	let removed = false;
	return () => {
		if (removed) { return; }
		removed = true;

		// 从当前列表中移除
		list.delete(item);

		// 从属性关联中删除
		if (list.size) { return; }
		if (!map) { return; }
		map.delete(key);

		// 映射列表中删除
		if (map.size) { return; }
		watchList.delete(target);
	};

}
