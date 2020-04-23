
import { DeValue, Value, value, computed, isValue } from './value';
export interface ValueifyProp<T> {
	<K extends keyof T>(
		key: K,
		def?: Value<DeValue<T[K]> | undefined>,
		set?: (value: DeValue<T[K]>, setted: boolean) => void
	): Value<DeValue<T[K]> | undefined>
}

function createValue<T, K extends keyof T>(
	props: T,
	key: K,
	def: Value<DeValue<T[K]> | undefined> = value(undefined),
	set?: (value: DeValue<T[K]>, setted: boolean) => void,
): Value<DeValue<T[K]> | undefined> {
	function setValue(value: DeValue<T[K]>, setted: boolean): void {
		if (!set) { return; }
		set(value, setted);
	}
	return computed(() => {
		if (!(key in props)) { return def(); }
		const p = props[key];
		return isValue(p) ? p() : p;
	}, v => {
		if (!(key in props)) {
			def(v);
			setValue(v, false);
			return;
		}
		const p = props[key];
		if (isValue(p)) {
			p(v);
			setValue(v, true);
			return;
		}
		setValue(v, false);
	});
}
export function valueify<T>(props: T): ValueifyProp<T>;
export function valueify<T, K extends keyof T>(
	props: T,
	key: K,
	def?: Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean) => void,
): Value<DeValue<T[K]> | undefined>;
export function valueify<T, K extends keyof T>(
	props: T,
	key?: K,
	def?: Value<DeValue<T[K]> | undefined>,
	set?: (value: DeValue<T[K]>, setted: boolean) => void
): ValueifyProp<T> | Value<DeValue<T[K]> | undefined> {
	if (arguments.length >= 2) {
		return createValue(props, key!, def, set);
	}
	return (k, d, s) => createValue(props, k, d, s);
}
