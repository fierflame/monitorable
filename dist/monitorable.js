
/*!
 * monitorable v0.0.0
 * (c) 2020 Fierflame
 * @license MIT
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = global || self, factory(global.Monitorable = {}));
}(this, function (exports) { 'use strict';

	/** 回调函数安全化处理 */
	function safeify(fn) {
	  return (...p) => {
	    try {
	      fn(...p);
	    } catch (e) {
	      console.error(e);
	    }
	  };
	}

	const ValueMap = new WeakMap();
	const ProxyHandler = {
	  get(target, prop, receiver) {
	    markRead(target, typeof prop === 'number' ? String(prop) : prop);
	    return Reflect.get(target, prop, receiver); // return getProxy(Reflect.get(target, prop, receiver));
	  },

	  set(target, prop, value, receiver) {
	    if (Reflect.get(target, prop, receiver) !== value) {
	      markChange(target, typeof prop === 'number' ? String(prop) : prop);
	    }

	    return Reflect.set(target, prop, value, receiver);
	  }

	};

	function isProxyable(v) {
	  return Boolean(v && ['object', 'function'].includes(typeof v));
	}

	function getProxy(v) {
	  if (!isProxyable(v)) {
	    return v;
	  }

	  if (ValueMap.has(v)) {
	    return v;
	  }

	  return new Proxy(v, ProxyHandler);
	}
	function getValue(v) {
	  return ValueMap.get(v) || v;
	}
	/** 已被读取的 */

	let read;
	function markRead(obj, prop) {
	  if (!read) {
	    return;
	  }

	  let set = read.get(obj);

	  if (!set) {
	    set = new Set();
	    read.set(obj, set);
	  }

	  set.add(prop);
	}
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
	    const oldRead = read;
	    read = thisRead;

	    try {
	      return fn();
	    } catch (e) {
	      thisRead.clear();
	      throw e;
	    } finally {
	      read = oldRead;

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
	const watchList = new WeakMap();
	/**
	 * 监听对象属性的变化
	 * @param v 要监听属性的值
	 * @param key 要监听的属性名
	 * @param f 属性改变后触发的函数
	 */

	function watchProp(v, key, f) {
	  if (!v) {
	    return () => {};
	  }

	  if (!(typeof v === 'object' || typeof v === 'function')) {
	    return () => {};
	  }

	  if (typeof f !== 'function') {
	    return () => {};
	  }

	  if (typeof key !== 'symbol' && typeof key !== 'string') {
	    return () => {};
	  }

	  v = getValue(v);
	  let map = watchList.get(v);

	  if (!map) {
	    map = new Map();
	    watchList.set(v, map);
	  }

	  let list = map.get(key);

	  if (!list) {
	    list = [];
	    map.set(key, list);
	  }

	  list.push(f);
	  let removed = false;
	  return () => {
	    if (removed) {
	      return;
	    }

	    removed = true; // 从当前列表中移除

	    if (!list) {
	      return;
	    }

	    const index = list.findIndex(a => a === f);

	    if (index < 0) {
	      return;
	    }

	    list.splice(index, 1); // 从属性关联中删除

	    if (list.length) {
	      return;
	    }

	    if (!map) {
	      return;
	    }

	    map.delete(key); // 映射列表中删除

	    if (map.size) {
	      return;
	    }

	    watchList.delete(v);
	  };
	}
	/** 
	 * 标记属性的修改，同时触发监听函数
	 */

	function markChange(v, key) {
	  var _watchList$get, _watchList$get$get;

	  if (!v) {
	    return;
	  }

	  if (!(typeof v === 'object' || typeof v === 'function')) {
	    return;
	  }

	  if (typeof key === 'number') {
	    key = String(key);
	  } else if (typeof key !== 'symbol' && typeof key !== 'string') {
	    return;
	  }

	  const watch = (_watchList$get = watchList.get(v)) === null || _watchList$get === void 0 ? void 0 : (_watchList$get$get = _watchList$get.get) === null || _watchList$get$get === void 0 ? void 0 : _watchList$get$get.call(_watchList$get, key);

	  if (!watch) {
	    return;
	  }

	  for (const w of [...watch]) {
	    try {
	      w();
	    } catch (e) {
	      console.error(e);
	    }
	  }
	}

	/** 取消监听的方法 */

	const values = new WeakSet();
	function isValue(x) {
	  return values.has(x);
	}
	/** 触发监听 */

	function createValue(setValue, getValue, stop = () => {}, change = () => {}) {
	  function set(v, marked = false) {
	    try {
	      return setValue(v, () => {
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
	    return getValue();
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

	function value(def, options) {
	  const proxy = options === true || options && options.proxy;
	  let source;
	  let proxyed;
	  const {
	    value
	  } = createValue((v, mark) => {
	    if (proxy) {
	      v = getValue(v);
	    }

	    if (v === source) {
	      return;
	    }

	    source = v;
	    proxyed = proxy ? getProxy(source) : source;
	    mark();
	  }, () => proxyed);
	  value(def);
	  return value;
	}
	/** 计算值 */

	function computed(getter, options) {
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
	        source = getValue(source);
	      }

	      proxyed = proxy ? getProxy(source) : source;
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
	  } = createValue((v, mark) => {// TODO
	    // v = getValue(v);
	    // if (v === source) { return; }
	    // source = v;
	    // mark();
	  }, () => computed || stoped ? proxyed : run(), () => {
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

	    const newValue = getValue(v());

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

	    if ('get' in descriptor || 'set' in descriptor || !('value' in descriptor)) {
	      continue;
	    }

	    const value = descriptor.value;

	    if (!isValue(value)) {
	      continue;
	    }

	    descriptor.get = () => value();

	    if (descriptor.writable) {
	      descriptor.set = v => value(v);
	    }

	    delete descriptor.value;
	    delete descriptor.writable;
	    Reflect.defineProperty(source, k, descriptor);
	  }

	  return source;
	}

	exports.computed = computed;
	exports.isValue = isValue;
	exports.merge = merge;
	exports.mix = mix;
	exports.value = value;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=monitorable.js.map
