import { Configuration } from 'webpack';
import * as MiniCssExtractPlugin from 'mini-css-extract-plugin';
import * as path from 'path';
import * as fs from 'fs';
import { emitAllFactory } from '@dojo/webpack-contrib/emit-all-plugin/EmitAllPlugin';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';

const postcssPresetEnv = require('postcss-preset-env');
const postcssModules = require('postcss-modules');
const cssModulesLoader = require('@dojo/cli-build-theme/cssModulesLoader');
const removeEmpty = (items: any[]) => items.filter((item) => item);

const basePath = process.cwd();
const packageJsonPath = path.join(basePath, 'package.json');
const packageJson = fs.existsSync(packageJsonPath) ? require(packageJsonPath) : {};

export default function webpackConfigFactory(args: any): Configuration {
	const themeVersion = args.release || packageJson.version;
	const themesPath = args.themePath ? path.join(basePath, args.themePath) : path.join(basePath, 'src', 'theme');
	const outputPath = path.join(basePath, 'output', 'theme');
	const themes: string[] = args.themes;

	const postcssPresetConfig = {
		browsers: ['last 2 versions', 'ie >= 10'],
		features: {
			'nesting-rules': true
		},
		autoprefixer: {
			grid: true
		},
		importFrom: themes.map((theme) => {
			return path.join(themesPath, theme, 'variables.css');
		})
	};

	const emitAll = emitAllFactory({
		legacy: false,
		inlineSourceMaps: false,
		basePath: themesPath
	});

	const tsLoaderOptions = {
		instance: 'dojo',
		onlyCompileBundledFiles: true,
		compilerOptions: {
			declaration: true,
			rootDir: path.resolve('./src'),
			outDir: path.resolve(`./output/`)
		},
		getCustomTransformers() {
			return {
				before: [emitAll.transformer]
			};
		}
	};

	const config: Configuration = {
		mode: 'production',
		entry: themes.reduce(
			(entry, theme) => {
				entry[theme] = [path.join(themesPath, theme, 'index.ts')];
				return entry;
			},
			{} as { [index: string]: any }
		),
		output: {
			filename: `[name]/[name]-${themeVersion}.js`,
			path: outputPath,
			library: '[name]',
			libraryTarget: 'umd'
		},
		resolveLoader: {
			modules: [path.resolve(__dirname, 'node_modules'), 'node_modules']
		},
		resolve: {
			modules: [basePath, path.join(basePath, 'node_modules')],
			extensions: ['.ts', '.tsx', '.mjs', '.js']
		},
		devtool: 'source-map',
		plugins: [
			new MiniCssExtractPlugin({
				filename: `[name]/[name]-${themeVersion}.css`
			}),
			emitAll.plugin,
			new CleanWebpackPlugin()
		],
		module: {
			rules: removeEmpty([
				{
					include: themesPath,
					test: /.*\.ts?$/,
					enforce: 'pre',
					loader: `@dojo/webpack-contrib/css-module-dts-loader?type=ts&instanceName=0_dojo`
				},
				{
					include: themesPath,
					test: /.*\.m\.css?$/,
					enforce: 'pre',
					loader: '@dojo/webpack-contrib/css-module-dts-loader?type=css'
				},
				{
					include: themesPath,
					test: /.*\.ts(x)?$/,
					use: removeEmpty([
						{
							loader: 'ts-loader',
							options: tsLoaderOptions
						}
					])
				},
				{
					include: themesPath,
					test: /.*\.(gif|png|jpe?g|svg|eot|ttf|woff|woff2)$/i,
					loader: 'file-loader',
					options: {
						name: (file: string) => {
							const fileDir = path
								.dirname(file.replace(path.join(basePath, 'src', 'theme'), ''))
								.replace(/^(\/|\\)/, '');
							return `${fileDir}/[hash:base64:8].[ext]`;
						},
						publicPath: (url: string) => {
							return url.replace(new RegExp(`(${themes.join('|')})(/|\\\\)`), '');
						},
						hash: 'sha512',
						digest: 'hex'
					}
				},
				{
					test: /\.css$/,
					exclude: themesPath,
					use: [MiniCssExtractPlugin.loader, 'css-loader?sourceMap']
				},
				{
					test: /\.m\.css.js$/,
					exclude: themesPath,
					use: ['json-css-module-loader']
				},
				{
					include: themesPath,
					test: /.*\.css?$/,
					use: [
						{
							loader: MiniCssExtractPlugin.loader,
							options: {}
						},
						'@dojo/webpack-contrib/css-module-decorator-loader',
						'@dojo/cli-build-theme/cssModulesLoader',
						{
							loader: 'css-loader',
							options: {
								importLoaders: 1,
								modules: {
									localIdentName: '[name]__[local]__[hash:base64:5]'
								},
								sourceMap: true
							}
						},
						{
							loader: 'postcss-loader?sourceMap',
							options: {
								ident: 'postcss',
								plugins: [
									postcssModules({
										getJSON: (filename: string, json: any) => {
											cssModulesLoader.classesMap.set(filename, json);
										},
										generateScopedName: '[local]'
									}),
									postcssPresetEnv(postcssPresetConfig)
								]
							}
						}
					]
				}
			])
		}
	};

	return config;
}
