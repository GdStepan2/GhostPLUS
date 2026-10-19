// Checks the public source package without native-site fixtures or dependencies.
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.version,'1.0.0');
assert.deepEqual([...manifest.permissions].sort(),['notifications','storage']);
const files=new Set(['manifest.json','shared/settings.js','popup/popup.html','popup/popup.css','popup/popup.js',manifest.background.service_worker,...Object.values(manifest.icons)]);
for(const script of manifest.content_scripts){
  for(const match of script.matches)assert(/^https:\/\/ghostecos\.duckdns\.org\/(v2\/social|chat\/)/.test(match));
  for(const name of [...(script.js||[]),...(script.css||[])])files.add(name);
}
for(const file of files){
  assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
  assert(fs.statSync(path.join(root,file)).isFile(),'Missing runtime file '+file);
  if(file.endsWith('.js'))cp.execFileSync(process.execPath,['--check',path.join(root,file)],{stdio:'pipe'});
  if(/\.(js|html)$/.test(file))assert(!/<script[^>]+src=["']https?:/i.test(fs.readFileSync(path.join(root,file),'utf8')),'Remote script in '+file);
}
for(const [size,file] of Object.entries(manifest.icons)){
  const png=fs.readFileSync(path.join(root,file));
  assert.equal(png.readUInt32BE(16),Number(size));assert.equal(png.readUInt32BE(20),Number(size));
}
console.log('PASS: runtime file completeness, JavaScript syntax, permissions, icons and packaged scripts.');
