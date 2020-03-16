import { safeify } from './utils';
import { observe, watchProp, ReadMap } from './state';
import { recover } from './encase';

export interface Executable<T> {
	(): T;
	stop(): void;
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
export function createExecutable<T>(
	fn: () => T,
	cb: (changed: boolean) => void,
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
	function exec() {
		cancel();
		const thisRead: ReadMap = new Map();
		try {
			return observe(fn, thisRead);
		} catch(e) {
			thisRead.clear();
			throw e;
		} finally {
			if (thisRead.size) {
				cancelList = [];
				for ( let [obj, props] of thisRead) {
					for (const p of props) {
						cancelList.push(watchProp(recover(obj), p, trigger));
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
