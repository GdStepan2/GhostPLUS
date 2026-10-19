const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
  const root=path.resolve(__dirname,'..');
  const browser=await chromium.launch({headless:true,channel:'chromium'});
  try {
    const page=await browser.newPage({viewport:{width:1400,height:560},deviceScaleFactor:1});
    const icon='data:image/png;base64,'+fs.readFileSync(path.join(root,'icons/icon128.png')).toString('base64');
    const html=fs.readFileSync(path.join(root,'store/promo-1400x560.html'),'utf8').replaceAll('../icons/icon128.png',icon);
    await page.setContent(html);
    await page.evaluate(()=>Promise.all([...document.images].map(image=>image.decode())));
    const output=path.join(root,'store/promo-1400x560.png');
    await page.screenshot({path:output,omitBackground:false});
    const png=fs.readFileSync(output);
    if(png.readUInt32BE(16)!==1400||png.readUInt32BE(20)!==560||png[25]!==2)throw new Error('Expected opaque RGB PNG at 1400 × 560');
    console.log('Created opaque RGB PNG: '+output);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
