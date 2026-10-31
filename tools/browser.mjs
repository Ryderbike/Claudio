import { createRequire } from 'module';
const require = createRequire('/opt/node-tools/');
export const { chromium } = require('playwright');
export const LAUNCH_ARGS = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--enable-webgl', '--disable-web-security'];
