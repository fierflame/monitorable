
/*!
 * monitorable v0.1.0-beta.1
 * (c) 2020-2021 Fierflame
 * @license MIT
 */

'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

let printErrorLog;
/** 打印错误 */

function printError(info) {
  if (typeof printErrorLog === 'function') {
    printErrorLog(info);
    return;
  }

  console.error(info);
}
function setPrintError(p) {
  printErrorLog = typeof p === 'function' ? p : undefined;
}
/**
 * 判断对象是否可被代理
 */

function encashable(v) {
  return Boolean(v && ['object', 'function'].includes(typeof v));
}
/** 回调函数安全化处理 */

function safeify(fn) {
  return (...p) => {
    try {
      fn(...p);
    } catch (e) {
      printError(e);
    }
  };
}
/** 回调函数安全化处理 */

function safeCall(fn) {
  try {
    fn();
  } catch (e) {
    printError(e);
  }
}
function getIndexes(target, prop) {
  if (!target) {
    return undefined;
  }

  if (typeof target !== 'function' && typeof target !== 'object') {
    return undefined;
  }

  if (typeof prop === 'number') {
    return [target, String(prop)];
  }

  if (typeof prop === 'symbol') {
    return [target, prop];
  }

  if (typeof prop === 'string') {
    return [target, prop];
  }

  if (typeof prop === 'boolean') {
    return [target, prop];
  }

  return undefined;
}
function getMapValue(map, key, def) {
  if (map.has(key)) {
    return map.get(key);
  }

  const value = def();
  map.set(key, value);
  return value;
}

/** 已被读取的 */
let read;
/**
 * 标记已读状态
 * @param obj  要标记的对象
 * @param prop 要标记的属性
 */

function markRead(target, prop) {
  if (!read) {
    return;
  }

  const indexes = getIndexes(target, prop);

  if (!indexes) {
    return;
  }

  [target, prop] = indexes;
  const propMap = getMapValue(read, target, () => new Map());

  if (propMap.has(prop)) {
    return;
  }

  propMap.set(prop, false);
}

/**
 * 监听函数的执行，并将执行过程中读取的对象值设置到 map 中
 * @param fn 要执行的含糊
 * @param map 用于存储被读取对象的 map
 */
function observeRun(map, fn, options) {
  const oldRead = read;
  read = map;

  try {
    if (!(options === null || options === void 0 ? void 0 : options.postpone)) {
      return fn();
    }

    return postpone(fn, options.postpone === 'priority');
  } finally {
    read = oldRead;
  }
}

function observe(map, fn, options) {
  if (typeof fn === 'function') {
    return observeRun(map, fn, options);
  }

  if (typeof options !== 'function') {
    throw new Error('fn needs to be a function');
  }

  return observeRun(map, options, fn);
}
const watchList = new WeakMap();

function execWatch(target, prop, filter) {
  var _watchList$get;

  const watch = (_watchList$get = watchList.get(target)) === null || _watchList$get === void 0 ? void 0 : _watchList$get.get(prop);

  if (!watch) {
    return;
  }

  let list = [...watch];

  if (filter) {
    list = list.filter(([, t]) => filter(t));
  }

  list.forEach(([w]) => w());
}

let waitList;

function runDeferred(list) {
  for (const [target, set] of list.entries()) {
    var _read;

    const propMap = (_read = read) === null || _read === void 0 ? void 0 : _read.get(target);

    for (const prop of set) {
      execWatch(target, prop, t => !t);

      if (propMap === null || propMap === void 0 ? void 0 : propMap.has(prop)) {
        propMap.set(prop, true);
      }
    }
  }
}

function postponeRun(f, priority) {
  const list = !priority && waitList || new Map();
  const old = waitList;
  waitList = list;

  try {
    return f();
  } finally {
    waitList = old;

    if (list !== waitList) {
      runDeferred(list);
    }
  }
}

function postpone(fn, priority) {
  if (typeof fn === 'function') {
    return postponeRun(fn, priority);
  }

  if (typeof priority !== 'function') {
    throw new Error('fn needs to be a function');
  }

  return postponeRun(priority, fn);
}

function wait(target, prop) {
  if (!waitList) {
    return false;
  }

  getMapValue(waitList, target, () => new Set()).add(prop);
  return true;
}
/**
 * 标记属性的修改，同时触发监听函数
 * @param target 要标记的对象
 * @param prop   要标记的属性 特别的，false 表示原型，true 表示成员
 */


function markChange(target, prop) {
  const indexes = getIndexes(target, prop);

  if (!indexes) {
    return;
  }

  [target, prop] = indexes;

  if (wait(target, prop)) {
    execWatch(target, prop, Boolean);
    return;
  }

  execWatch(target, prop);
}
/**
 * 观察对象属性的变化
 * @param target 要观察的对象
 * @param prop   要观察的属性名 特别的，false 表示原型，true 表示成员
 * @param fn     属性改变后触发的函数
 */

function watchProp(target, prop, cb, disdeferable = false) {
  if (typeof cb !== 'function') {
    return () => {};
  }

  const indexes = getIndexes(target, prop);

  if (!indexes) {
    return () => {};
  }

  [target, prop] = indexes;
  const key = prop;
  let map = watchList.get(target);

  if (!map) {
    map = new Map();
    watchList.set(target, map);
  }

  const list = getMapValue(map, key, () => new Set());
  const item = [safeify(cb), disdeferable];
  list.add(item);
  let removed = false;
  return () => {
    if (removed) {
      return;
    }

    removed = true; // 从当前列表中移除

    list.delete(item); // 从属性关联中删除

    if (list.size) {
      return;
    }

    if (!map) {
      return;
    }

    map.delete(key); // 映射列表中删除

    if (map.size) {
      return;
    }

    watchList.delete(target);
  };
}

function run(cb, fn, options) {
  cb = safeify(cb);
  let cancelList;
  const postpone = options === null || options === void 0 ? void 0 : options.postpone;
  let end = false;
  /** 取消监听 */

  function cancel() {
    if (end) {
      return false;
    }

    end = true;

    if (!cancelList) {
      return true;
    }

    const list = cancelList;
    cancelList = undefined;
    list.forEach(f => f());
    return true;
  }

  function trigger() {
    if (!cancel()) {
      return;
    }

    cb(true);
  }

  function run(thisRead) {
    if (end) {
      return false;
    }

    if (!thisRead.size) {
      end = true;
      return cb(false);
    }

    const list = [];

    for (let [obj, props] of thisRead) {
      for (const [p, m] of props) {
        if (m) {
          return cb(true);
        }

        list.push([obj, p]);
      }
    }

    cancelList = list.map(([obj, p]) => watchProp(obj, p, trigger, options === null || options === void 0 ? void 0 : options.disdeferable));
  }

  function stop() {
    if (!cancel()) {
      return;
    }

    cb(false);
  }
  const thisRead = new Map();
  const result = observe(thisRead, () => fn(stop), {
    postpone
  });
  run(thisRead);

  if (options === null || options === void 0 ? void 0 : options.resultOnly) {
    return result;
  }

  return {
    result,
    stop
  };
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */


function exec(cb, fn, options) {
  if (typeof cb !== 'function') {
    throw new Error('cb needs to be a function');
  }

  if (typeof fn === 'function') {
    return run(cb, fn, options);
  }

  if (typeof options !== 'function') {
    throw new Error('fn needs to be a function');
  }

  return run(cb, options, fn);
}

/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */
function create(cb, fn, options) {
  cb = safeify(cb);
  let cancelList;
  /** 取消监听 */

  function cancel() {
    if (!cancelList) {
      return false;
    }

    const list = cancelList;
    cancelList = undefined;
    list.forEach(f => f());
    return true;
  }

  function trigger() {
    if (!cancel()) {
      return;
    }

    cb(true);
  }

  function run(thisRead) {
    if (!thisRead.size) {
      return cb(false);
    }

    const list = [];

    for (let [obj, props] of thisRead) {
      for (const [p, m] of props) {
        if (m) {
          return cb(true);
        }

        list.push([obj, p]);
      }
    }

    cancelList = list.map(([obj, p]) => watchProp(obj, p, trigger, options === null || options === void 0 ? void 0 : options.disdeferable));
  }

  function exec(...p) {
    cancel();
    const thisRead = new Map();
    const result = observe(thisRead, () => fn(...p), options);
    run(thisRead);
    return result;
  }

  exec.stop = () => {
    if (!cancel()) {
      return;
    }

    cb(false);
  };

  return exec;
}
/**
 * 创建可监听执行函数
 * @param fn 要监听执行的函数
 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
 */


function monitor(cb, fn, options) {
  if (typeof fn === 'function') {
    return create(cb, fn, options);
  }

  if (typeof options !== 'function') {
    throw new Error('fn needs to be a function');
  }

  return create(cb, options, fn);
}

/** 取消监听的方法 */

const values = new WeakSet();
function isValue(x) {
  return values.has(x);
}
/** 触发监听 */

function valueOf() {
  const value = this();

  if (value === undefined) {
    return value;
  }

  if (value === null) {
    return value;
  }

  return value.valueOf();
}

function toString(...p) {
  const value = this();

  if (value === undefined) {
    return String(value);
  }

  if (value === null) {
    return String(value);
  }

  if (typeof value.toString === 'function') {
    return value.toString(...p);
  }

  return String(value);
}

function toPrimitive(hint) {
  const value = this();

  if (value === undefined) {
    return String(value);
  }

  if (value === null) {
    return String(value);
  }

  if (typeof value[Symbol.toPrimitive] === 'function') {
    return value[Symbol.toPrimitive](hint);
  }

  if (hint === 'string') {
    return String(value);
  }

  if (hint === 'number') {
    return Number(value);
  }

  return value;
}

function createValue(recover, setValue, stop = () => {}, change = () => {}) {
  function set(v, marked = false) {
    if (!setValue) {
      return;
    }

    try {
      setValue(v, () => {
        marked = true;
      });
    } finally {
      if (marked) {
        trigger();
      }
    }
  }

  function get() {
    markRead(value, 'value');
    return recover();
  }

  const value = (...v) => {
    if (v.length) {
      set(v[0], v[1]);
      return v[0];
    }

    return get();
  };

  Reflect.defineProperty(value, 'value', {
    get,
    set,
    enumerable: true,
    configurable: true
  });
  Reflect.defineProperty(value, 'valueOf', {
    value: valueOf,
    enumerable: true,
    configurable: true
  });
  Reflect.defineProperty(value, 'toString', {
    value: toString,
    enumerable: true,
    configurable: true
  });
  Reflect.defineProperty(value, Symbol.toPrimitive, {
    value: toPrimitive,
    enumerable: true,
    configurable: true
  });
  let stopList = new Set();

  function watch(cb, disdeferable) {
    if (!stopList) {
      return () => {};
    }

    const cancel = watchProp(value, 'value', () => cb(value, false), disdeferable);
    let cancelled = false;

    const stop = () => {
      if (cancelled) {
        return;
      }

      cancelled = true;

      if (stopList) {
        stopList.delete(stop);
      }

      cancel();
      safeCall(() => cb(value, true));
    };

    stopList.add(stop);
    change();
    return () => {
      if (cancelled) {
        return;
      }

      cancelled = true;

      if (stopList) {
        stopList.delete(stop);
      }

      cancel();
      change();
    };
  }

  Reflect.defineProperty(value, 'watch', {
    get() {
      return watch;
    },

    set() {},

    configurable: true
  });

  const trigger = () => markChange(value, 'value');

  trigger.has = () => {
    var _stopList;

    return Boolean((_stopList = stopList) === null || _stopList === void 0 ? void 0 : _stopList.size);
  };

  trigger.stop = () => {
    if (!stopList) {
      return;
    }

    const list = stopList;
    stopList = undefined;

    for (const stop of [...list]) {
      stop();
    }
  };

  values.add(value);
  let stopped = false;

  value.stop = () => {
    if (stopped) {
      return;
    }

    stopped = true;
    stop();
    trigger.stop();
  };

  return {
    value,
    trigger
  };
}
/**
 * 创建引用值
 * @param value 初始值
 * @param options 选项
 */


function value(def) {
  let source;
  let proxyValue;
  const {
    value
  } = createValue(() => proxyValue, (v, mark) => {
    if (v === source) {
      return;
    }

    source = v;
    proxyValue = source;
    mark();
  });
  value(def);
  return value;
}
function computed(getter, setter, options) {
  var _options, _options2;

  if (typeof setter !== 'function') {
    options = setter;
    setter = undefined;
  }

  const setValue = setter;
  const postpone = (_options = options) === null || _options === void 0 ? void 0 : _options.postpone;
  const deferable = (_options2 = options) === null || _options2 === void 0 ? void 0 : _options2.deferable;
  let source;
  let proxyValue;
  let stopped = false;
  let computed = false;
  let trigger;
  const executable = monitor(changed => {
    computed = !changed;

    if (changed && trigger) {
      trigger();
    }
  }, getter, {
    postpone,
    disdeferable: !deferable
  });

  function run() {
    computed = true;

    try {
      source = executable();
      proxyValue = source;
      return proxyValue;
    } catch (e) {
      if (!stopped) {
        computed = false;
      }

      throw e;
    }
  }

  let value;
  ({
    value,
    trigger
  } = createValue(() => computed || stopped ? proxyValue : run(), setValue && (v => setValue(v)), () => {
    if (stopped) {
      return;
    }

    stopped = true;

    if (computed) {
      return;
    }

    run();
  }));
  return value;
}

function createValue$1(props, key, def, set) {
  function setValue(value, setted) {
    if (!set) {
      return;
    }

    set(value, setted);
  }

  return computed(() => {
    const p = props[key];

    if (p === undefined && def) {
      return def();
    }

    return isValue(p) ? p() : p;
  }, v => {
    const p = props[key];

    if (isValue(p)) {
      p(v);
      setValue(v, true);
      return;
    }

    if (p === undefined && def) {
      def(v);
      setValue(v, false);
      return;
    }

    setValue(v, false);
  });
}

function valueify(props, key, def, set) {
  if (!key) {
    return (k, d, s) => createValue$1(props, k, d, s);
  }

  if (!Array.isArray(key)) {
    return createValue$1(props, key, def, set);
  }

  const r = Object.create(null);

  for (const k of key) {
    const value = createValue$1(props, k, def && def(k), set && ((v, s) => set(v, s, k)));
    Reflect.defineProperty(props, k, {
      get() {
        return value();
      },

      set(v) {
        value.value = v;
      },

      configurable: true,
      enumerable: true
    });
  }

  return r;
}
function mixValue(source, props = Reflect.ownKeys(source), set) {
  const p = Object.create(source);

  if (Array.isArray(props)) {
    for (const key of props) {
      const value = createValue$1(source, key, undefined, set && ((v, s) => set(v, s, key)));
      Reflect.defineProperty(p, key, {
        get() {
          return value();
        },

        set(v) {
          value.value = v;
        },

        configurable: true,
        enumerable: true
      });
    }

    return p;
  }

  const keys = Reflect.ownKeys(props);

  for (const key of keys) {
    const value = createValue$1(source, key, props[key], set && ((v, s) => set(v, s, key)));
    Reflect.defineProperty(p, key, {
      get() {
        return value();
      },

      set(v) {
        value.value = v;
      },

      configurable: true,
      enumerable: true
    });
  }

  return p;
}

function createAsValue(props, key) {
  return computed(() => {
    const p = props[key];
    return isValue(p) ? p() : p;
  }, v => {
    const p = props[key];

    if (isValue(p)) {
      p(v);
    } else {
      props[key] = v;
    }
  });
}

function asValue(props, key) {
  if (arguments.length >= 2) {
    return createAsValue(props, key);
  }

  return k => createAsValue(props, k);
}

function merge(cb) {
  let oldValue;
  let ran = false;
  return (v, stopped) => {
    if (stopped) {
      return cb(v, stopped);
    }

    const newValue = v();

    if (newValue === oldValue && ran) {
      return;
    }

    ran = true;
    oldValue = newValue;
    cb(v, stopped);
  };
}

function defineProperty(obj, key, val) {
  return Reflect.defineProperty(obj, key, {
    get() {
      markRead(obj, key);
      return val;
    },

    set(v) {
      if (v === val) {
        return;
      }

      val = v;
      markChange(obj, key);
    },

    configurable: true,
    enumerable: true
  });
}
function createObject(keys, base = {}, create) {
  const obj = create || base === null ? Object.create(base) : base;

  for (const key of keys) {
    let val = obj[key];
    Reflect.defineProperty(obj, key, {
      get() {
        markRead(obj, key);
        return val;
      },

      set(v) {
        if (v === val) {
          return;
        }

        val = v;
        markChange(obj, key);
      },

      configurable: true,
      enumerable: true
    });
  }

  return obj;
}
function get(obj, key) {
  markRead(obj, key);
  return obj[key];
}
function set(obj, key, v) {
  if (v === obj[key]) {
    return v;
  }

  obj[key] = v;
  markChange(obj, key);
  return v;
}

/**
 * 判断对象是否可被代理
 */

function encashable$1(v) {
  return Boolean(v && ['object', 'function'].includes(typeof v));
}

let getValue;
/**
 * 获取被代理对象
 * @param obj  要被代理的对象
 * @param nest 递归代理的层数
 */

function encase(value, nest = 0) {
  if (!encashable$1(value)) {
    return value;
  }

  const original = recover(value);
  const nestLayer = nest === true ? Infinity : nest || 0;
  const proxy = new Proxy(original, {
    set(target, prop, value, receiver) {
      if (nest === false) {
        return Reflect.set(target, prop, value, receiver);
      }

      const has = Reflect.has(target, prop);
      const old = Reflect.get(target, prop, receiver);
      const modified = Reflect.set(target, prop, value, encase(receiver));

      if (!modified) {
        return modified;
      }

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

      if (nestLayer > 0) {
        return encase(value, nestLayer - 1);
      }

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
      const value = Reflect.getPrototypeOf(target);

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
        const desc = Reflect.getOwnPropertyDescriptor(target, prop);

        if (desc && 'value' in desc && recover(attr.value) === recover(desc.value)) {
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
      if (nest === false) {
        return Reflect.ownKeys(target);
      }

      markRead(target, true);
      markRead(proxy, true);
      return Reflect.ownKeys(target);
    },

    has(target, prop) {
      if (nest === false) {
        return Reflect.has(target, prop);
      }

      markRead(target, true);
      markRead(proxy, true);
      return Reflect.has(target, prop);
    }

  });
  return proxy;
}
/** 获取被代理的原始值 */

function recover(v) {
  if (!v) {
    return v;
  }

  if (!encashable$1(v)) {
    return v;
  }

  let value = v;

  try {
    getValue = v;
    value = v.__monitorable__recover__;
  } catch (_unused) {}

  value = getValue;
  getValue = false;

  if (!value) {
    return v;
  }

  if (typeof value === 'object') {
    return value;
  }

  if (typeof value === 'function') {
    return value;
  }

  return v;
}
function equal(a, b) {
  return recover(a) === recover(b);
}



var Monitorable = /*#__PURE__*/Object.freeze({
	__proto__: null,
	printError: printError,
	setPrintError: setPrintError,
	encashable: encashable,
	safeify: safeify,
	safeCall: safeCall,
	getIndexes: getIndexes,
	getMapValue: getMapValue,
	markRead: markRead,
	observe: observe,
	postpone: postpone,
	markChange: markChange,
	watchProp: watchProp,
	exec: exec,
	monitor: monitor,
	isValue: isValue,
	value: value,
	computed: computed,
	valueify: valueify,
	mixValue: mixValue,
	asValue: asValue,
	merge: merge,
	defineProperty: defineProperty,
	createObject: createObject,
	get: get,
	set: set,
	encase: encase,
	recover: recover,
	equal: equal
});

exports.asValue = asValue;
exports.computed = computed;
exports.createObject = createObject;
exports.default = Monitorable;
exports.defineProperty = defineProperty;
exports.encase = encase;
exports.encashable = encashable;
exports.equal = equal;
exports.exec = exec;
exports.get = get;
exports.getIndexes = getIndexes;
exports.getMapValue = getMapValue;
exports.isValue = isValue;
exports.markChange = markChange;
exports.markRead = markRead;
exports.merge = merge;
exports.mixValue = mixValue;
exports.monitor = monitor;
exports.observe = observe;
exports.postpone = postpone;
exports.printError = printError;
exports.recover = recover;
exports.safeCall = safeCall;
exports.safeify = safeify;
exports.set = set;
exports.setPrintError = setPrintError;
exports.value = value;
exports.valueify = valueify;
exports.watchProp = watchProp;
//# sourceMappingURL=monitorable.common.js.map
