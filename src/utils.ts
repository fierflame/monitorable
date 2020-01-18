/** 回调函数安全化处理 */
export function safeify<T extends any[]>(fn: (...p: T) => void): (...p: T) => void {
	return (...p) => {
		try {
			fn(...p);
		} catch(e) {
			console.error(e);
		}
	};
}
