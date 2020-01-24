
/*!
 * monitorable v0.0.0
 * (c) 2020 Fierflame
 * @license MIT
 */

/** 取消监听的方法 */
interface CancelWatch {
    (): void;
}
/** 可监听值 */
interface Value<T> {
    (): T;
    (v: T, mrak?: boolean): T;
    value: T;
    watch(cb: WatchCallback<T, this>): CancelWatch;
    stop(): void;
}
/** 监听函数 */
interface WatchCallback<T, V extends Value<T> = Value<T>> {
    (v: V, stoped: boolean): void;
}
declare function isValue(x: any): x is Value<any>;
interface Options {
    proxy?: boolean;
}
declare function value<T>(value: T, options?: Options | boolean): Value<T>;
/** 计算值 */
declare function computed<T>(source: () => T, options?: Options | boolean): Value<T>;
declare function merge<T, V extends Value<T> = Value<T>>(cb: WatchCallback<T, V>): WatchCallback<T, V>;
declare type OffValue<V> = V extends Value<infer T> ? T : V;
declare function mix<T extends object>(source: T): {
    [K in keyof T]: OffValue<T[K]>;
};

export { CancelWatch, Options, Value, WatchCallback, computed, isValue, merge, mix, value };
