
import resolve from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import dts from 'rollup-plugin-dts';
import replace from 'rollup-plugin-replace';
import { terser } from 'rollup-plugin-terser';
import fsFn from 'fs';
const { name, version, author, license } = JSON.parse(fsFn.readFileSync('./package.json'));

const beginYear = 2020;
const year = new Date().getFullYear();

const banner = `
/*!
 * ${ name } v${ version }
 * (c) ${ beginYear === year ? beginYear : `${ beginYear }-${ year }` } ${ author }
 * @license ${ license }
 */
`;
const GlobalName = name.replace(/(?:^|-)([a-z])/g, (_, s) => s.toUpperCase());
export default [
	{
		input: 'src/index.ts',
		output: [
			{
				file: `dist/${ name }.esm.js`,
				sourcemap: true,
				format: 'esm',
				banner,
			},
			{
				file: `dist/${ name }.common.js`,
				sourcemap: true,
				format: 'cjs',
				banner,
			},
			{
				file: `dist/${ name }.js`,
				sourcemap: true,
				format: 'umd',
				name: GlobalName,
				banner,
			},
		],
		plugins: [
			resolve({ extensions: [ '.mjs', '.js', '.jsx', '.json', '.ts', '.tsx' ] }),
			babel({ extensions: [ '.mjs', '.js', '.jsx', '.es', '.ts', '.tsx' ] }),
			replace({ __VERSION__: version }),
		],
	},
	{
		input: 'src/index.ts',
		output: [
			{
				file: `dist/${ name }.esm.min.js`,
				sourcemap: true,
				format: 'esm',
				banner,
			},
			{
				file: `dist/${ name }.min.js`,
				sourcemap: true,
				format: 'umd',
				name: GlobalName,
				banner,
			},
		],
		plugins: [
			resolve({ extensions: [ '.mjs', '.js', '.jsx', '.json', '.ts', '.tsx' ] }),
			babel({ extensions: [ '.mjs', '.js', '.jsx', '.es', '.ts', '.tsx' ] }),
			replace({ __VERSION__: version }),
			terser(),
		],
	},
	{
		input: [ 'src/index.ts' ],
		output: [ { file: 'types.d.ts', format: 'esm', banner } ],
		plugins: [ dts() ],
	},
];
