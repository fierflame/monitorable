
/*!
 * monitorable v0.1.0-beta.1
 * (c) 2020-2021 Fierflame
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
/** 回调函数安全化处理 */
declare function safeCall(fn: () => void): void;
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
declare function watchProp(target: object | Function, prop: string | number | boolean | symbol, cb: () => void, disdeferable?: boolean): () => void;

interface ExecResult<T> {
    result: T;
    stop(): void;
}
interface ExecOptions extends ObserveOptions {
    resultOnly?: boolean;
    disdeferable?: boolean;
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

interface Monitored<T, P extends any[] = []> {
    (...p: P): T;
    stop(): void;
}
interface MonitorOptions extends ObserveOptions {
    disdeferable?: boolean;
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
declare function monitor<T, P extends any[] = []>(cb: (changed: boolean) => void, fn: (...p: P) => T, options?: MonitorOptions): Monitored<T, P>;
declare function monitor<T, P extends any[] = []>(cb: (changed: boolean) => void, options: MonitorOptions | undefined, fn: (...p: P) => T): Monitored<T, P>;
declare function monitor<T, P extends any[] = []>(cb: (changed: boolean) => void, fn: ((...p: P) => T) | MonitorOptions | undefined, options?: ((...p: P) => T) | MonitorOptions): Monitored<T, P>;

/** 取消监听的方法 */
interface CancelWatch {
    (): void;
}
/** 监听函数 */
interface WatchCallback<T, V extends Value<T> = Value<T>> {
    (v: V, stopped: boolean): void;
}
/** 可监听值 */
interface Value<T> {
    (): T;
    (v: T, mark?: boolean): T;
    value: T;
    watch(cb: WatchCallback<T, this>, disdeferable?: boolean): CancelWatch;
    stop(): void;
    toString(...p: T extends {
        toString(...p: infer P): string;
    } ? P : any): string;
    valueOf(): T extends {
        valueOf(): infer R;
    } ? R : T;
}
declare function isValue(x: any): x is Value<any>;
/**
 * 创建引用值
 * @param value 初始值
 * @param options 选项
 */
declare function value<T>(def: T): Value<T>;
interface ComputedOptions {
    postpone?: boolean | 'priority';
    deferable?: boolean;
}
/**
 * 创建计算值
 * @param getter 取值方法
 * @param options 选项
 */
declare function computed<T>(getter: () => T, options?: ComputedOptions): Value<T>;
/**
 * 创建可赋值计算值
 * @param getter 取值方法
 * @param setter 复制方法
 * @param options 选项
 */
declare function computed<T>(getter: () => T, setter: (value: T) => void, options?: ComputedOptions): Value<T>;
declare function computed<T>(getter: () => T, setter?: ((value: T) => void) | ComputedOptions, options?: ComputedOptions): Value<T>;

declare type DeValue<T> = T extends Value<infer V> ? V : T;
declare type EnValue<T> = Value<DeValue<T>>;
interface Valueify<T> {
    <K extends keyof T>(key: K, def?: Value<DeValue<T[K]> | undefined>, set?: (value: DeValue<T[K]>, setted: boolean) => void): Value<DeValue<T[K]> | undefined>;
}
declare function valueify<T extends object>(props: T): Valueify<T>;
declare function valueify<T extends object, K extends keyof T>(props: T, key: K, def?: Value<DeValue<T[K]> | undefined>, set?: (value: DeValue<T[K]>, setted: boolean) => void): Value<DeValue<T[K]> | undefined>;
declare function valueify<T extends object, K extends keyof T>(props: T, key: K[], def?: (key: K) => Value<DeValue<T[K]> | undefined>, set?: (value: DeValue<T[K]>, setted: boolean, key: K) => void): {
    [k in K]: Value<DeValue<T[k]> | undefined>;
};
declare function mixValue<T extends object, K extends keyof T>(source: T, props?: K[] | { [k in K]?: Value<DeValue<T[k]> | undefined> | undefined; }, set?: (value: DeValue<T[K]>, setted: boolean, key?: K) => void): {
    [k in keyof T]: k extends K ? DeValue<T[k]> : T[k];
};
interface AsValue<T> {
    <K extends keyof T>(key: K): EnValue<T[K]>;
}
declare function asValue<T>(props: T): AsValue<T>;
declare function asValue<T, K extends keyof T>(props: T, key: K): EnValue<T[K]>;

declare function merge<T, V extends Value<T> = Value<T>>(cb: WatchCallback<T, V>): WatchCallback<T, V>;

declare function defineProperty<T extends object, K extends keyof T, V extends T[K]>(obj: T, key: K, val: V): boolean;
declare function createObject<T extends object>(keys: (keyof T)[], base?: T | null, create?: boolean): T;
declare function get<T extends object, K extends keyof T>(obj: T, key: K): T[K];
declare function set<T extends object, K extends keyof T, V extends T[K]>(obj: T, key: K, v: V): V;

/**
 * 获取被代理对象
 * @param obj  要被代理的对象
 * @param nest 递归代理的层数
 */
declare function encase<T>(value: T, nest?: number | boolean): T;
/** 获取被代理的原始值 */
declare function recover<T>(v: T): T;
declare function equal(a: any, b: any): boolean;



declare const Monitorable_printError: typeof printError;
declare const Monitorable_setPrintError: typeof setPrintError;
declare const Monitorable_encashable: typeof encashable;
declare const Monitorable_safeify: typeof safeify;
declare const Monitorable_safeCall: typeof safeCall;
declare const Monitorable_getIndexes: typeof getIndexes;
declare const Monitorable_getMapValue: typeof getMapValue;
declare const Monitorable_ReadMap: typeof ReadMap;
declare const Monitorable_markRead: typeof markRead;
type Monitorable_ObserveOptions = ObserveOptions;
declare const Monitorable_observe: typeof observe;
declare const Monitorable_postpone: typeof postpone;
declare const Monitorable_markChange: typeof markChange;
declare const Monitorable_watchProp: typeof watchProp;
type Monitorable_ExecResult = ExecResult;
type Monitorable_ExecOptions = ExecOptions;
declare const Monitorable_exec: typeof exec;
type Monitorable_Monitored = Monitored;
type Monitorable_MonitorOptions = MonitorOptions;
declare const Monitorable_monitor: typeof monitor;
type Monitorable_CancelWatch = CancelWatch;
type Monitorable_WatchCallback = WatchCallback;
type Monitorable_Value = Value;
declare const Monitorable_isValue: typeof isValue;
declare const Monitorable_value: typeof value;
type Monitorable_ComputedOptions = ComputedOptions;
declare const Monitorable_computed: typeof computed;
declare const Monitorable_DeValue: typeof DeValue;
declare const Monitorable_EnValue: typeof EnValue;
type Monitorable_Valueify = Valueify;
declare const Monitorable_valueify: typeof valueify;
declare const Monitorable_mixValue: typeof mixValue;
type Monitorable_AsValue = AsValue;
declare const Monitorable_asValue: typeof asValue;
declare const Monitorable_merge: typeof merge;
declare const Monitorable_defineProperty: typeof defineProperty;
declare const Monitorable_createObject: typeof createObject;
declare const Monitorable_get: typeof get;
declare const Monitorable_set: typeof set;
declare const Monitorable_encase: typeof encase;
declare const Monitorable_recover: typeof recover;
declare const Monitorable_equal: typeof equal;
declare namespace Monitorable {
  export {
    Monitorable_printError as printError,
    Monitorable_setPrintError as setPrintError,
    Monitorable_encashable as encashable,
    Monitorable_safeify as safeify,
    Monitorable_safeCall as safeCall,
    Monitorable_getIndexes as getIndexes,
    Monitorable_getMapValue as getMapValue,
    Monitorable_ReadMap as ReadMap,
    Monitorable_markRead as markRead,
    Monitorable_ObserveOptions as ObserveOptions,
    Monitorable_observe as observe,
    Monitorable_postpone as postpone,
    Monitorable_markChange as markChange,
    Monitorable_watchProp as watchProp,
    Monitorable_ExecResult as ExecResult,
    Monitorable_ExecOptions as ExecOptions,
    Monitorable_exec as exec,
    Monitorable_Monitored as Monitored,
    Monitorable_MonitorOptions as MonitorOptions,
    Monitorable_monitor as monitor,
    Monitorable_CancelWatch as CancelWatch,
    Monitorable_WatchCallback as WatchCallback,
    Monitorable_Value as Value,
    Monitorable_isValue as isValue,
    Monitorable_value as value,
    Monitorable_ComputedOptions as ComputedOptions,
    Monitorable_computed as computed,
    Monitorable_DeValue as DeValue,
    Monitorable_EnValue as EnValue,
    Monitorable_Valueify as Valueify,
    Monitorable_valueify as valueify,
    Monitorable_mixValue as mixValue,
    Monitorable_AsValue as AsValue,
    Monitorable_asValue as asValue,
    Monitorable_merge as merge,
    Monitorable_defineProperty as defineProperty,
    Monitorable_createObject as createObject,
    Monitorable_get as get,
    Monitorable_set as set,
    Monitorable_encase as encase,
    Monitorable_recover as recover,
    Monitorable_equal as equal,
  };
}

export default Monitorable;
export { AsValue, CancelWatch, ComputedOptions, DeValue, EnValue, ExecOptions, ExecResult, MonitorOptions, Monitored, ObserveOptions, ReadMap, Value, Valueify, WatchCallback, asValue, computed, createObject, defineProperty, encase, encashable, equal, exec, get, getIndexes, getMapValue, isValue, markChange, markRead, merge, mixValue, monitor, observe, postpone, printError, recover, safeCall, safeify, set, setPrintError, value, valueify, watchProp };
