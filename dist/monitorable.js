
/*!
 * monitorable v0.1.0-alpha.2
 * (c) 2020 Fierflame
 * @license MIT
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.Monitorable = {}));
}(this, function (exports) { 'use strict';

	let printErrorLog;
	/** 设置或移除错误打印函数 */

	function printError(info, print = false) {
	  if (!print && (typeof info === 'function' || info === undefined)) {
	    printErrorLog = info;
	    return;
	  }

	  if (typeof printErrorLog === 'function') {
	    printErrorLog(info);
	    return;
	  }

	  console.error(info);
	}
	/** 回调函数安全化处理 */

	function safeify(fn) {
	  return (...p) => {
	    try {
	      fn(...p);
	    } catch (e) {
	      printError(e, true);
	    }
	  };
	}
	function getMapValue(map, key, def) {
	  if (map.has(key)) {
	    return map.get(key);
	  }

	  const value = def();
	  map.set(key, value);
	  return value;
	}

	/**
	 * 判断对象是否可被代理
	 */

	function isProxyable(v) {
	  return Boolean(v && ['object', 'function'].includes(typeof v));
	}

	let getValue;
	/**
	 * 获取被代理对象
	 * @param obj  要被代理的对象
	 * @param nest 递归代理的层数
	 */

	function encase(value, nest = 0) {
	  if (!isProxyable(value)) {
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
	      const modified = Reflect.set(target, prop, value, encase(receiver));

	      if (!modified) {
	        return modified;
	      }

	      if (has !== Reflect.has(target, prop)) {
	        markChange(target, true);
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

	      markRead(target, prop);
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
	      }

	      return modified;
	    },

	    getPrototypeOf(target) {
	      if (nest === false) {
	        return Reflect.getPrototypeOf(target);
	      }

	      markRead(target, false);
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
	      }

	      return modified;
	    },

	    getOwnPropertyDescriptor(target, prop) {
	      if (nest === false) {
	        return Reflect.getOwnPropertyDescriptor(target, prop);
	      }

	      markRead(target, prop);
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
	      }

	      return deleted;
	    },

	    ownKeys(target) {
	      if (nest === false) {
	        return Reflect.ownKeys(target);
	      }

	      markRead(target, true);
	      return Reflect.ownKeys(target);
	    },

	    has(target, prop) {
	      if (nest === false) {
	        return Reflect.has(target, prop);
	      }

	      markRead(target, true);
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

	  if (!isProxyable(v)) {
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

	/** 已被读取的 */
	let read;
	/**
	 * 标记已读状态
	 * @param obj  要标记的对象
	 * @param prop 要标记的属性
	 */

	function markRead(obj, prop) {
	  if (!read) {
	    return;
	  }

	  const set = getMapValue(read, obj, () => new Set());

	  if (typeof prop === 'number') {
	    prop = String(prop);
	  }

	  set.add(prop);
	}
	/**
	 * 监听函数的执行，并将执行过程中读取的对象值设置到 map 中
	 * @param fn 要执行的含糊
	 * @param map 用于存储被读取对象的 map
	 * @param clear 是否在发送错误时清空 map
	 */

	function observe(fn, map = new Map(), clear = false) {
	  const oldRead = read;
	  read = map;

	  try {
	    return fn();
	  } catch (e) {
	    if (clear) {
	      map.clear();
	    }

	    throw e;
	  } finally {
	    read = oldRead;
	  }
	}
	const watchList = new WeakMap();
	/**
	 * 标记属性的修改，同时触发监听函数
	 * @param target 要标记的对象
	 * @param prop   要标记的属性 特别的，false 表示原型，true 表示成员
	 */

	function markChange(target, prop) {
	  var _watchList$get, _watchList$get$get;

	  if (!target) {
	    return;
	  }

	  if (!isProxyable(target)) {
	    return;
	  }

	  if (typeof prop === 'number') {
	    prop = String(prop);
	  } else if (typeof prop !== 'symbol' && typeof prop !== 'string' && typeof prop !== 'boolean') {
	    return;
	  }

	  const watch = (_watchList$get = watchList.get(target)) === null || _watchList$get === void 0 ? void 0 : (_watchList$get$get = _watchList$get.get) === null || _watchList$get$get === void 0 ? void 0 : _watchList$get$get.call(_watchList$get, prop);

	  if (!watch) {
	    return;
	  }

	  for (const w of [...watch]) {
	    w();
	  }
	}
	/**
	 * 监听对象属性的变化
	 * @param target 要监听的对象
	 * @param prop   要监听的属性名 特别的，false 表示原型，true 表示成员
	 * @param fn     属性改变后触发的函数
	 */

	function watchProp(target, prop, cb) {
	  if (!target) {
	    return () => {};
	  }

	  if (!(typeof target === 'object' || typeof target === 'function')) {
	    return () => {};
	  }

	  if (typeof cb !== 'function') {
	    return () => {};
	  }

	  if (typeof prop === 'number') {
	    prop = String(prop);
	  }

	  if (typeof prop !== 'symbol' && typeof prop !== 'string' && typeof prop !== 'boolean') {
	    return () => {};
	  }

	  const key = prop;
	  target = recover(target);
	  let map = watchList.get(target);

	  if (!map) {
	    map = new Map();
	    watchList.set(target, map);
	  }

	  const list = getMapValue(map, key, () => new Set());
	  cb = safeify(cb);
	  list.add(cb);
	  let removed = false;
	  return () => {
	    if (removed) {
	      return;
	    }

	    removed = true; // 从当前列表中移除

	    list.delete(cb); // 从属性关联中删除

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

	/**
	 * 创建可监听执行函数
	 * @param fn 要监听执行的函数
	 * @param cb 当监听的值发生可能改变时触发的回调函数，单如果没有被执行的函数或抛出错误，将会在每次 fn 被执行后直接执行
	 */
	function createExecutable(fn, cb) {
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

	  function exec() {
	    cancel();
	    const thisRead = new Map();

	    try {
	      return observe(fn, thisRead, true);
	    } finally {
	      if (thisRead.size) {
	        cancelList = [];

	        for (let [obj, props] of thisRead) {
	          for (const p of props) {
	            cancelList.push(watchProp(obj, p, trigger));
	          }
	        }
	      } else {
	        cb(false);
	      }
	    }
	  }

	  exec.stop = () => {
	    if (!cancel()) {
	      return;
	    }

	    cb(false);
	  };

	  return exec;
	}

	/** 取消监听的方法 */

	const values = new WeakSet();
	function isValue(x) {
	  return values.has(x);
	}
	/** 触发监听 */

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

	  function watch(cb) {
	    if (!callbacks) {
	      return () => {};
	    }

	    cb = safeify(cb);
	    callbacks.push(cb);
	    change();
	    let cancelled = false;
	    return () => {
	      if (cancelled) {
	        return;
	      }

	      cancelled = true;

	      if (!callbacks) {
	        return;
	      }

	      const index = callbacks.findIndex(a => a === cb);

	      if (index < 0) {
	        return;
	      }

	      callbacks.splice(index, 1);
	      change();
	    };
	  }

	  let callbacks = [];
	  Reflect.defineProperty(value, 'watch', {
	    get() {
	      return watch;
	    },

	    set() {},

	    configurable: true
	  });

	  const trigger = () => {
	    if (!callbacks) {
	      return;
	    }

	    markChange(value, 'value');

	    for (const cb of [...callbacks]) {
	      cb(value, false);
	    }
	  };

	  trigger.has = () => {
	    var _callbacks;

	    return Boolean((_callbacks = callbacks) === null || _callbacks === void 0 ? void 0 : _callbacks.length);
	  };

	  trigger.stop = () => {
	    if (!callbacks) {
	      return;
	    }

	    const list = callbacks;
	    callbacks = undefined;

	    for (const cb of [...list]) {
	      cb(value, true);
	    }
	  };

	  values.add(value);
	  let stoped = false;

	  value.stop = () => {
	    if (stoped) {
	      return;
	    }

	    stoped = true;
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


	function value(def, options) {
	  const proxy = options === true || options && options.proxy;
	  let source;
	  let proxyed;
	  const {
	    value
	  } = createValue(() => proxyed, (v, mark) => {
	    if (proxy) {
	      v = recover(v);
	    }

	    if (v === source) {
	      return;
	    }

	    source = v;
	    proxyed = proxy ? encase(source) : source;
	    mark();
	  });
	  value(def);
	  return value;
	}
	/**
	 * 创建计算值
	 * @param getter 取值方法
	 * @param options 选项
	 */

	function computed(getter, setter, options) {
	  if (typeof setter !== 'function') {
	    options = setter;
	    setter = undefined;
	  }

	  const setValue = setter;
	  const proxy = options === true || options && options.proxy;
	  let source;
	  let proxyed;
	  let stoped = false;
	  let computed = false;
	  let trigger;
	  const executable = createExecutable(getter, changed => {
	    computed = !changed;

	    if (changed && trigger) {
	      trigger();
	    }
	  });

	  function run() {
	    computed = true;

	    try {
	      source = executable();

	      if (proxy) {
	        source = recover(source);
	      }

	      proxyed = proxy ? encase(source) : source;
	      return proxyed;
	    } catch (e) {
	      if (!stoped) {
	        computed = false;
	      }

	      throw e;
	    }
	  }

	  let value;
	  ({
	    value,
	    trigger
	  } = createValue(() => computed || stoped ? proxyed : run(), setValue && (v => setValue(proxy ? recover(v) : v)), () => {
	    if (stoped) {
	      return;
	    }

	    stoped = true;

	    if (computed) {
	      return;
	    }

	    run();
	  }));
	  return value;
	}
	function merge(cb) {
	  let oldValue;
	  let runed = false;
	  return (v, stoped) => {
	    if (stoped) {
	      return cb(v, stoped);
	    }

	    const newValue = recover(v());

	    if (newValue === oldValue && runed) {
	      return;
	    }

	    runed = true;
	    oldValue = newValue;
	    cb(v, stoped);
	  };
	}
	function mix(source) {
	  for (const k of Reflect.ownKeys(source)) {
	    const descriptor = Reflect.getOwnPropertyDescriptor(source, k);

	    if (!descriptor) {
	      continue;
	    }

	    if (!('value' in descriptor) || 'get' in descriptor || 'set' in descriptor) {
	      continue;
	    }

	    const value = descriptor.value;

	    if (!isValue(value)) {
	      continue;
	    }

	    descriptor.get = () => value.value;

	    if (descriptor.writable) {
	      descriptor.set = v => value.value = v;
	    }

	    delete descriptor.value;
	    delete descriptor.writable;
	    Reflect.defineProperty(source, k, descriptor);
	  }

	  return source;
	}

	exports.computed = computed;
	exports.createExecutable = createExecutable;
	exports.encase = encase;
	exports.equal = equal;
	exports.getMapValue = getMapValue;
	exports.isValue = isValue;
	exports.markChange = markChange;
	exports.markRead = markRead;
	exports.merge = merge;
	exports.mix = mix;
	exports.observe = observe;
	exports.printError = printError;
	exports.recover = recover;
	exports.safeify = safeify;
	exports.value = value;
	exports.watchProp = watchProp;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=monitorable.js.map
