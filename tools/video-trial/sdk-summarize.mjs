// Compatibility launcher for the native Rust receipt qualifier.
// The Rust process validates the complete input before replacing SUMMARY.json.
// Raw measurement outcomes and missing provenance remain distinct.
import { resolve } from 'node:path';
import { nativeQualification } from './sdk-qualification.mjs';

const dir = resolve(process.argv[2] || 'docs/receipts/ant-sdk-015');
const summary = nativeQualification('summarize', { dir });
console.log(`summary: ${summary.samples} samples -> SUMMARY.json`);
