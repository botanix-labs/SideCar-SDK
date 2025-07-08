import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import nodePolyfills from 'rollup-plugin-polyfill-node';

export default {
	input: "src/index.ts",
	output: [
		{
			file: "dist/index.js",
			format: "cjs",
			sourcemap: true,
		},
		{
			file: "dist/index.esm.js",
			format: "esm",
			sourcemap: true,
		},
		{
			file: "dist/index.umd.js",
			format: "umd",
			name: "BotanixSidecarSDK",
			sourcemap: true,
			globals: {
				'window': 'undefined',
				'global': 'undefined'
			}
		},
	],
	plugins: [
		nodePolyfills(),
		typescript(), 
		resolve({ 
			browser: false,
			preferBuiltins: true 
		}), 
		commonjs({
			transformMixedEsModules: true
		}), 
		json(), 
		terser()
	],
	external: [
		'tiny-secp256k1',
		'http',
		'https',
		'stream',
		'zlib',
		'crypto',
		'fs',
		'path',
		'os',
		'util',
		'buffer',
		'events',
		'net',
		'tls',
		'querystring'
	],
};
