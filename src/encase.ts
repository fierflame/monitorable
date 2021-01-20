import { markChange, markRead } from './mark';

/**
 * 判断对象是否可被代理
 */
function encashable(v: any): v is object | Function {
	return Boolean(v && ['object', 'function'].includes(typeof v));
}

let getValue: any;
/**
 * 获取被代理对象
 * @param obj  要被代理的对象
 * @param nest 递归代理的层数
 */
export function encase<T>(value: T, nest: number | boolean = 0): T {
	if (!encashable(value)) { return value; }
	const original = recover(value);
	const nestLayer: number = nest === true ? Infinity : nest || 0;
	const proxy = new Proxy(original, {
		set(target, prop, value, receiver) {
			if (nest === false) {
				return Reflect.set(target, prop, value, receiver);
			}
			const has = Reflect.has(target, prop);
			const old = Reflect.get(target, prop, receiver);
			const modified =
				Reflect.set(target, prop, value, encase(receiver));
			if (!modified) { return modified; }
			if (has !== Reflect.has(target, prop)) {
				markChange(receiver, true);
			}
			if (old !== Reflect.get(target, prop, receiver)) {
				markChange(receiver, prop);
			}
			return modified;
		},
		get(target, prop, receiver) {
			if (getValue === proxy) {
				if (prop === '__monitorable__recover__') {
					getValue = original;
					return;
				}
			}
			if (nest === false) {
				return Reflect.get(target, prop, receiver);
			}
			markRead(receiver, prop);
			const value = Reflect.get(target, prop, encase(receiver));
			if (nestLayer > 0) { return encase(value, nestLayer - 1); }
			return value;
		},
		setPrototypeOf(target, proto) {
			if (nest === false) {
				return Reflect.setPrototypeOf(target, proto);
			}
			const oldProto = Reflect.getPrototypeOf(target);
			const modified = Reflect.setPrototypeOf(target, proto);
			if (modified && oldProto !== proto) {
				markChange(target, false);
				markChange(proxy, false);
			}
			return modified;
		},
		getPrototypeOf(target) {
			if (nest === false) {
				return Reflect.getPrototypeOf(target);
			}
			markRead(target, false);
			markRead(proxy, false);
			const value: any = Reflect.getPrototypeOf(target);
			if (nestLayer > 0) {
				return encase(value, nestLayer - 1);
			}
			return value;
		},
		defineProperty(target, prop, attr) {
			if (nest === false) {
				return Reflect.defineProperty(target, prop, attr);
			}
			let changed = true;
			if ('value' in attr) {
				const desc =
					Reflect.getOwnPropertyDescriptor(target, prop);
				if (
					desc && 'value' in desc
					&& recover(attr.value) === recover(desc.value)) {
					changed = false;
				}
			}
			const modified = Reflect.defineProperty(target, prop, attr);
			if (changed && modified) {
				markChange(target, prop);
				markChange(proxy, prop);
			}
			return modified;
		},
		getOwnPropertyDescriptor(target, prop) {
			if (nest === false) {
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}
			markRead(target, prop);
			markRead(proxy, prop);
			return Reflect.getOwnPropertyDescriptor(target, prop);
		},
		deleteProperty(target, prop) {
			if (nest === false) {
				return Reflect.deleteProperty(target, prop);
			}
			const has = Reflect.has(target, prop);
			const deleted = Reflect.deleteProperty(target, prop);
			if (has && !Reflect.has(target, prop)) {
				markChange(target, prop);
				markChange(target, true);
				markChange(proxy, prop);
				markChange(proxy, true);
			}
			return deleted;
		},
		ownKeys(target) {
			if (nest === false) { return Reflect.ownKeys(target); }
			markRead(target, true);
			markRead(proxy, true);
			return Reflect.ownKeys(target);
		},
		has(target, prop) {
			if (nest === false) { return Reflect.has(target, prop); }
			markRead(target, true);
			markRead(proxy, true);
			return Reflect.has(target, prop);
		},
	});
	return proxy;
}
/** 获取被代理的原始值 */
export function recover<T>(v: T): T {
	if (!v) { return v; }
	if (!encashable(v)) { return v; }
	let value = v;
	try {
		getValue = v;
		value = (v as any).__monitorable__recover__;
	} catch {}
	value = getValue;
	getValue = false;
	if (!value) { return v; }
	if (typeof value === 'object') { return value; }
	if (typeof value === 'function') { return value; }
	return v;
}
export function equal(a: any, b: any): boolean {
	return recover(a) === recover(b);
}
