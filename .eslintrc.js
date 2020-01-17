module.exports = {
	env: {
		node: true,
		es6: true,
	},
	parser: 'babel-eslint',
	plugins: ['babel', '@typescript-eslint'],
	rules: {
		// 强制命名泛型类型变量	
		'@typescript-eslint/generic-type-naming': 'error',
		// 单引号
		'quotes': ['error', 'single'],
		// 行尾部分号
		'semi':['error', 'always'],
		// 禁止 if 语句中有 return 之后有 else
		'no-else-return':'error',
		// 禁止出现空函数.如果一个函数包含了一条注释，它将不会被认为有问题
		'no-implicit-coercion': 'error',
		// 禁止或强制在单行代码块中使用空格
		'block-spacing': ['error', 'always'],
		// 驼峰法命名
		'@typescript-eslint/camelcase': 'error',
		// 数组和对象键值对最后一个逗号， never参数：不能带末尾的逗号, always参数：必须带末尾的逗,always-multiline：多行模式必须带逗号，单行模式不能带逗号号
		'comma-dangle': ['error', 'always-multiline'],
		// 控制逗号前后的空格
		'comma-spacing': ['error', { 'before': false, 'after': true }],
		// 控制逗号在行尾出现还是在行首出现 (默认行尾)
		'comma-style': ['error', 'last'],
		// 构造函数首字母大写
		'new-cap': ['error', { 'newIsCap': true, 'capIsNew': false}], 
		// 空行不能够超过2行
		'no-multiple-empty-lines': ['error', {'max': 2}],
		// 换行风格
		'linebreak-style': [ 'error', 'unix' ],
		// 禁止对一些关键字或者保留字进行赋值操作，比如NaN、Infinity、undefined、eval、arguments等
		'no-shadow-restricted-names': 'error',
		// 禁止使用 console
		'no-console': 'off',
	},
}
