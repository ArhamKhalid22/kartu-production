import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'dist');
const supabaseUrl = process.env.KARTU_SUPABASE_URL || '';
const publishableKey = process.env.KARTU_SUPABASE_PUBLISHABLE_KEY || '';
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(supabaseUrl)) throw new Error('Missing/invalid KARTU_SUPABASE_URL');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw new Error('Missing/invalid KARTU_SUPABASE_PUBLISHABLE_KEY');

await mkdir(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'icon.svg', 'manifest.webmanifest']) {
  await copyFile(path.join(root, file), path.join(out, file));
}
await writeFile(path.join(out, 'config.js'), 'window.KARTU_CONFIG = ' + JSON.stringify({supabaseUrl, supabasePublishableKey:publishableKey}) + ';\n');
console.log('Built Kartu static website from the extracted project source.');
