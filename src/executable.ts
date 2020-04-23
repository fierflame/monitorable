import { safeify } from './utils';
import { observe, watchProp, ReadMap, ObserveOptions } from './mark';
import { recover } from './encase';

export interface Executable<T> {
	(): T;
	stop(): void;
}
export interface ExecutableOptions extends ObserveOptions {}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
function create<T>(
	cb: (changed: boolean) => void,
	fn: () => T,
	options?: ExecutableOptions,
): Executable<T> {
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
	function run(thisRead: ReadMap) {
		if (!thisRead.size) {
			return cb(false);
		}
		const list: [
			object | Function,
			string | boolean | symbol,
		][] = [];
		for ( let [obj, props] of thisRead) {
			for (const [p, m] of props) {
				if (m) { return cb(true); }
				list.push([obj, p]);
			}
		}
		cancelList = list.map(
			([obj, p]) => watchProp(recover(obj), p, trigger),
		);
	}
	function exec() {
		cancel();
		const thisRead: ReadMap = new Map();
		const result = observe(thisRead, fn, options);
		run(thisRead);
		return result;
	}
	exec.stop = () => {
		if (!cancel()) { return; }
		cb(false);
	};
	return exec;
}

/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
export function createExecutable<T>(
	cb: (changed: boolean) => void,
	fn: () => T,
	options?: ExecutableOptions,
): Executable<T>
export function createExecutable<T>(
	cb: (changed: boolean) => void,
	options: ExecutableOptions | undefined,
	fn: () => T,
): Executable<T>;
export function createExecutable<T>(
	cb: (changed: boolean) => void,
	fn: (() => T) | ExecutableOptions | undefined,
	options?: (() => T) | ExecutableOptions,
): Executable<T>;
export function createExecutable<T>(
	cb: (changed: boolean) => void,
	fn: (() => T) | ExecutableOptions | undefined,
	options?: (() => T) | ExecutableOptions,
): Executable<T> {
	if (typeof fn === 'function') {
		return create(cb, fn, options as ExecutableOptions | undefined);
	}
	if (typeof options !== 'function') {
		throw new Error('fn needs to be a function');
	}
	return create(cb, options, fn);
}
