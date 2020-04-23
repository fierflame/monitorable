import { safeify } from './utils';
import { observe, watchProp, ReadMap, ObserveOptions } from './mark';
import { recover } from './encase';

export interface ExecResult<T> {
	result: T;
	stop(): void;
}
export interface ExecOptions extends ObserveOptions {
	resultOnly?: boolean;
}
function run<T>(
	cb: (changed: boolean) => void,
	fn: (stop: () => void) => T,
	options?: ExecOptions,
): ExecResult<T> | T {
	cb = safeify(cb);
	let cancelList: (() => void)[] | undefined;
	const postpone = options?.postpone;
	let end = false;
	/** 取消监听 */
	function cancel() {
		if (end) { return false; }
		end = true;
		if (!cancelList) { return true; }
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
		if (end) { return false; }
		if (!thisRead.size) {
			end = true;
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
	function stop() {
		if (!cancel()) { return; }
		cb(false);
	};
	const thisRead: ReadMap = new Map();
	const result = observe(thisRead, () => fn(stop), { postpone });
	run(thisRead);
	if (options?.resultOnly) { return result; }
	return { result, stop };
}

/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
export function exec<T>(
	cb: (changed: boolean) => void,
	fn: (stop: () => void) => T,
	options?: ExecOptions & {resultOnly?: false},
): ExecResult<T>;
export function exec<T>(
	cb: (changed: boolean) => void,
	options: ExecOptions & {resultOnly?: false} | undefined,
	fn?: (stop: () => void) => T,
): ExecResult<T>;

export function exec<T>(
	cb: (changed: boolean) => void,
	fn: (stop: () => void) => T,
	options: ExecOptions & {resultOnly: true},
): T;
export function exec<T>(
	cb: (changed: boolean) => void,
	options: ExecOptions & {resultOnly: true},
	fn: (stop: () => void) => T,
): T;

export function exec<T>(
	cb: (changed: boolean) => void,
	fn: (stop: () => void) => T,
	options?: ExecOptions,
): ExecResult<T> | T;
export function exec<T>(
	cb: (changed: boolean) => void,
	options: ExecOptions | undefined,
	fn: (stop: () => void) => T,
): ExecResult<T> | T;

export function exec<T>(
	cb: (changed: boolean) => void,
	fn: ((stop: () => void) => T) | ExecOptions | undefined,
	options?: ((stop: () => void) => T) | ExecOptions | undefined,
): ExecResult<T> | T  {
	if (typeof cb !== 'function') {
		throw new Error('cb needs to be a function');
	}
	if (typeof fn === 'function') {
		return run(cb, fn, options as ExecOptions | undefined);
	}
	if (typeof options !== 'function') {
		throw new Error('fn needs to be a function');
	}
	return run(cb, options, fn);
}
