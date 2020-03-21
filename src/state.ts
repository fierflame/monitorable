import { safeify, getMapValue, encashable } from './utils';

export type ReadMap =  Map<
	object | Function,
	Set<string | boolean | symbol>
>;

/** 已被读取的 */
let read: ReadMap | undefined;

/**
 * 标记已读状态
 * @param obj  要标记的对象
 * @param prop 要标记的属性
 */
export function markRead(
	obj: object | Function,
	prop: string | number | boolean | symbol,
) {
	if (!read) { return; }
	if (typeof prop === 'number') {
		prop = String(prop);
	}
	getMapValue(read, obj, () => new Set()).add(prop);
}
/**
 * 监听函数的执行，并将执行过程中读取的对象值设置到 map 中
 * @param fn 要执行的含糊
 * @param map 用于存储被读取对象的 map
 * @param clear 是否在发送错误时清空 map
 */
export function observe<T>(fn: () => T, map: ReadMap): T {
	const oldRead = read;
	read = map;
	try {
		return fn();
	} finally {
		read = oldRead;
	}
}


const watchList = new WeakMap<
	object | Function,
	Map<string | boolean | symbol, Set<() => void>>
>();

function execWatch(
	target: object | Function,
	prop: string | boolean | symbol,
) {
	const watch = watchList.get(target)?.get(prop);
	if (!watch) { return; }
	[...watch].forEach(w => w());
}

let waitList: ReadMap | undefined;

function run(list: ReadMap) {
	for (const [target, set] of list.entries()) {
		for (const prop of set) {
			execWatch(target, prop);
		}
	}
}
export function postpone<T>(f: () => T, priority?: boolean): T {
	const list = !priority && waitList || new Map();
	const old = waitList;
	waitList = list;
	try {
		return f();
	} finally {
		waitList = old;
		if (list !== waitList) { run(list); }
	}
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
	if (!target) { return; }
	if (!encashable(target)) { return; }
	if (typeof prop === 'number') {
		prop = String(prop);
	} else if (
		typeof prop !== 'symbol'
		&& typeof prop !== 'string'
		&& typeof prop !== 'boolean'
	) {
		return;
	}
	if (wait(target, prop)) { return; }
	execWatch(target, prop);
}

/**
 * 监听对象属性的变化
 * @param target 要监听的对象
 * @param prop   要监听的属性名 特别的，false 表示原型，true 表示成员
 * @param fn     属性改变后触发的函数
 */
export function watchProp(
	target: object | Function,
	prop: string | number | boolean | symbol,
	cb: () => void,
): () => void {
	if (!target) { return () => {}; }
	if (!(typeof target === 'object' || typeof target === 'function')) {
		return () => {};
	}
	if (typeof cb !== 'function') {
		return  () => {};
	}
	if (typeof prop === 'number') {
		prop = String(prop);
	}
	if (
		typeof prop !== 'symbol'
		&& typeof prop !== 'string'
		&& typeof prop !== 'boolean'
	) {
		return () => {};
	}
	const key = prop;
	let map = watchList.get(target);
	if (!map) {
		map = new Map();
		watchList.set(target, map);
	}
	const list = getMapValue(map, key, () => new Set());
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
