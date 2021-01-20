
import {
	Value,
	WatchCallback,
} from './value';

export function merge<T, V extends Value<T> = Value<T>>(
	cb: WatchCallback<T, V>
): WatchCallback<T, V> {
	let oldValue: any;
	let ran = false;
	return (v, stopped) => {
		if (stopped) { return cb(v, stopped); }
		const newValue = v();
		if (newValue === oldValue && ran) { return; }
		ran = true;
		oldValue = newValue;
		cb(v, stopped);
	};
}
