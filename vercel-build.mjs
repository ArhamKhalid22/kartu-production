import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const supabaseUrl = process.env.KARTU_SUPABASE_URL || '';
const publishableKey = process.env.KARTU_SUPABASE_PUBLISHABLE_KEY || '';
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl)) throw new Error('Missing/invalid KARTU_SUPABASE_URL');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw new Error('Missing/invalid KARTU_SUPABASE_PUBLISHABLE_KEY');

const temp = await mkdtemp(path.join(os.tmpdir(), 'kartu-'));
execFileSync('unzip', ['-q', 'New project.zip', '-d', temp]);
const source = path.join(temp, 'New project');
const out = path.join(process.cwd(), 'dist');
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'icon.svg', 'manifest.webmanifest']) {
  await copyFile(path.join(source, file), path.join(out, file));
}
await writeFile(path.join(out, 'config.js'), 'window.KARTU_CONFIG = ' + JSON.stringify({supabaseUrl, supabasePublishableKey:publishableKey}) + ';\n');
console.log('Built the Kartu website from the uploaded New project.zip archive.');
