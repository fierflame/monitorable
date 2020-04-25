
/*!
 * monitorable v0.1.0-alpha.7
 * (c) 2020 Fierflame
 * @license MIT
 */

/** 打印错误 */
declare function printError(info: any): void;
declare function setPrintError(p?: (info: any) => void): void;
/**
 * 判断对象是否可被代理
 */
declare function encashable(v: any): v is object | Function;
/** 回调函数安全化处理 */
declare function safeify<T extends any[]>(fn: (...p: T) => void): (...p: T) => void;
declare function getIndexes(target: any, prop: string | number | symbol | boolean): [object | Function, string | boolean | symbol] | undefined;
declare function getMapValue<K, V>(map: Map<K, V>, key: K, def: () => V): V;
declare function getMapValue<K extends object, V>(map: WeakMap<K, V>, key: K, def: () => V): V;

declare type ReadMap = Map<object | Function, Map<string | boolean | symbol, boolean>>;
/**
 * 标记已读状态
 * @param obj  要标记的对象
 * @param prop 要标记的属性
 */
declare function markRead(target: object | Function, prop: string | number | boolean | symbol): void;
interface ObserveOptions {
    postpone?: boolean | 'priority';
}
/**
 * 监听函数的执行，并将执行过程中读取的对象值设置到 map 中
 * @param fn 要执行的含糊
 * @param map 用于存储被读取对象的 map
 */
declare function observeRun<T>(map: ReadMap, fn: () => T, options?: ObserveOptions): T;
declare function observe<T>(map: ReadMap, fn: () => T, priority?: ObserveOptions): T;
declare function observe<T>(map: ReadMap, priority: ObserveOptions, f: () => T): T;
declare function observe<T>(map: ReadMap, fn: (() => T) | ObserveOptions | undefined, options?: (() => T) | ObserveOptions | undefined): T;
declare function postpone<T>(priority: boolean, f: () => T): T;
declare function postpone<T>(fn: () => T, priority?: boolean): T;
declare function postpone<T>(fn: (() => T) | boolean | undefined, priority?: (() => T) | boolean | undefined): T;
/**
 * 标记属性的修改，同时触发监听函数
 * @param target 要标记的对象
 * @param prop   要标记的属性 特别的，false 表示原型，true 表示成员
 */
declare function markChange(target: object | Function, prop: string | number | boolean | symbol): void;
/**
 * 观察对象属性的变化
 * @param target 要观察的对象
 * @param prop   要观察的属性名 特别的，false 表示原型，true 表示成员
 * @param fn     属性改变后触发的函数
 */
declare function watchProp(target: object | Function, prop: string | number | boolean | symbol, cb: () => void): () => void;

/**
 * 获取被代理对象
 * @param obj  要被代理的对象
 * @param nest 递归代理的层数
 */
declare function encase<T>(value: T, nest?: number | boolean): T;
/** 获取被代理的原始值 */
declare function recover<T>(v: T): T;
declare function equal(a: any, b: any): boolean;

interface ExecResult<T> {
    result: T;
    stop(): void;
}
interface ExecOptions extends ObserveOptions {
    resultOnly?: boolean;
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
declare function exec<T>(cb: (changed: boolean) => void, fn: (stop: () => void) => T, options?: ExecOptions & {
    resultOnly?: false;
}): ExecResult<T>;
declare function exec<T>(cb: (changed: boolean) => void, options: ExecOptions & {
    resultOnly?: false;
} | undefined, fn?: (stop: () => void) => T): ExecResult<T>;
declare function exec<T>(cb: (changed: boolean) => void, fn: (stop: () => void) => T, options: ExecOptions & {
    resultOnly: true;
}): T;
declare function exec<T>(cb: (changed: boolean) => void, options: ExecOptions & {
    resultOnly: true;
}, fn: (stop: () => void) => T): T;
declare function exec<T>(cb: (changed: boolean) => void, fn: (stop: () => void) => T, options?: ExecOptions): ExecResult<T> | T;
declare function exec<T>(cb: (changed: boolean) => void, options: ExecOptions | undefined, fn: (stop: () => void) => T): ExecResult<T> | T;

interface Executable<T> {
    (): T;
    stop(): void;
}
interface ExecutableOptions extends ObserveOptions {
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
declare function createExecutable<T>(cb: (changed: boolean) => void, fn: () => T, options?: ExecutableOptions): Executable<T>;
declare function createExecutable<T>(cb: (changed: boolean) => void, options: ExecutableOptions | undefined, fn: () => T): Executable<T>;
declare function createExecutable<T>(cb: (changed: boolean) => void, fn: (() => T) | ExecutableOptions | undefined, options?: (() => T) | ExecutableOptions): Executable<T>;

/** 取消监听的方法 */
interface CancelWatch {
    (): void;
}
/** 可监听值 */
interface Value<T> {
    (): T;
    (v: T, mark?: boolean): T;
    value: T;
    watch(cb: WatchCallback<T, this>): CancelWatch;
    stop(): void;
    toString(...p: T extends {
        toString(...p: infer P): string;
    } ? P : any): string;
    valueOf(): T extends {
        valueOf(): infer R;
    } ? R : T;
}
declare type DeValue<T> = T extends Value<infer V> ? V : T;
/** 监听函数 */
interface WatchCallback<T, V extends Value<T> = Value<T>> {
    (v: V, stopped: boolean): void;
}
declare function isValue(x: any): x is Value<any>;
interface Options {
    proxy?: boolean;
}
/**
 * 创建引用值
 * @param value 初始值
 * @param options 选项
 */
declare function value<T>(value: T, options?: Options | boolean): Value<T>;
interface ComputedOptions {
    postpone?: boolean | 'priority';
    proxy?: boolean;
}
/**
 * 创建计算值
 * @param getter 取值方法
 * @param options 选项
 */
declare function computed<T>(getter: () => T, options?: ComputedOptions | boolean): Value<T>;
/**
 * 创建可赋值计算值
 * @param getter 取值方法
 * @param setter 复制方法
 * @param options 选项
 */
declare function computed<T>(getter: () => T, setter: (value: T) => void, options?: ComputedOptions | boolean): Value<T>;
declare function computed<T>(getter: () => T, setter?: ((value: T) => void) | ComputedOptions | boolean, options?: ComputedOptions | boolean): Value<T>;
declare function merge<T, V extends Value<T> = Value<T>>(cb: WatchCallback<T, V>): WatchCallback<T, V>;
declare type OffValue<V> = V extends Value<infer T> ? T : V;
declare function mix<T extends object>(source: T): {
    [K in keyof T]: OffValue<T[K]>;
};

interface ValueifyProp<T> {
    <K extends keyof T>(key: K, def?: Value<DeValue<T[K]> | undefined>, set?: (value: DeValue<T[K]>, setted: boolean) => void): Value<DeValue<T[K]> | undefined>;
}
declare function valueify<T>(props: T): ValueifyProp<T>;
declare function valueify<T, K extends keyof T>(props: T, key: K, def?: Value<DeValue<T[K]> | undefined>, set?: (value: DeValue<T[K]>, setted: boolean) => void): Value<DeValue<T[K]> | undefined>;

export { CancelWatch, ComputedOptions, DeValue, ExecOptions, ExecResult, Executable, ExecutableOptions, ObserveOptions, Options, ReadMap, Value, ValueifyProp, WatchCallback, computed, createExecutable, encase, encashable, equal, exec, getIndexes, getMapValue, isValue, markChange, markRead, merge, mix, observe, observeRun, postpone, printError, recover, safeify, setPrintError, value, valueify, watchProp };
