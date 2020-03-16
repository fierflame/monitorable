import { safeify } from './utils';
import { observe, watchProp, ReadMap } from './state';
import { recover } from './encase';

export interface ExecResult<T> {
	result: T;
	stop(): void;
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
export function exec<T>(
	fn: () => T,
	cb: (changed: boolean) => void,
	resultOnly?: false,
): ExecResult<T>;
export function exec<T>(
	fn: () => T,
	cb: (changed: boolean) => void,
	resultOnly: true,
): T;
export function exec<T>(
	fn: () => T,
	cb: (changed: boolean) => void,
	resultOnly?: boolean,
): ExecResult<T> | T;
export function exec<T>(
	fn: () => T,
	cb: (changed: boolean) => void,
	resultOnly?: boolean,
): ExecResult<T> | T {
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
	const thisRead: ReadMap = new Map();
	const result = observe(fn, thisRead);
	if (!thisRead.size) {
		cb(false);
		if (resultOnly) { return result; }
		return { result, stop() {} };
	}
	cancelList = [];
	for ( let [obj, props] of thisRead) {
		for (const p of props) {
			cancelList.push(watchProp(recover(obj), p, trigger));
		}
	}
	if (resultOnly) { return result; }
	return {
		result,
		stop() {
			if (!cancel()) { return; }
			cb(false);
		}
	}
}
