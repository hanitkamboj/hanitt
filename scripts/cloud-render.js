/* ============================================
   LyricForge — Cloud Render Script (GitHub Actions)
   ============================================
   This runs in a GitHub Actions workflow.
   Dependencies: puppeteer, @supabase/supabase-js, ffmpeg-static, fluent-ffmpeg
   Install: npm install puppeteer @supabase/supabase-js ffmpeg-static fluent-ffmpeg
   ============================================ */

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');
const os = require('os');

ffmpeg.setFfmpegPath(ffmpegStatic);

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nldebawdjbiktuefhihr.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const JOB_ID = process.env.RENDER_JOB_ID;

if (!SUPABASE_SERVICE_KEY || !JOB_ID) {
    console.error('Missing SUPABASE_SERVICE_KEY or RENDER_JOB_ID');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log(`Processing render job: ${JOB_ID}`);

    // 1. Fetch job from Supabase
    const { data: job, error } = await supabase
        .from('render_jobs')
        .select('*')
        .eq('id', JOB_ID)
        .single();

    if (error || !job) {
        console.error('Failed to fetch job:', error);
        process.exit(1);
    }

    // Mark as processing
    await supabase.from('render_jobs').update({
        status: 'processing',
        started_at: new Date().toISOString()
    }).eq('id', JOB_ID);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricforge-'));
    const outPath = path.join(tmpDir, 'output.mp4');
    const htmlPath = path.join(tmpDir, 'render.html');

    try {
        // 2. Download assets from Supabase storage
        const audioPath = path.join(tmpDir, 'audio.mp3');
        const bgPath = path.join(tmpDir, 'bg.jpg');
        const lyricsPath = path.join(tmpDir, 'lyrics.lrc');

        if (job.audio_url) await downloadFile(job.audio_url, audioPath);
        if (job.bg_url) await downloadFile(job.bg_url, bgPath);
        if (job.lyrics_url) await downloadFile(job.lyrics_url, lyricsPath);

        // 3. Generate render HTML that puppeteer will load
        const config = job.config || {};
        const lyrics = job.lyrics || [];
        const html = generateRenderHTML(config, lyrics, audioPath, bgPath);
        fs.writeFileSync(htmlPath, html);

        // 4. Launch headless browser and render
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader']
        });

        const page = await browser.newPage();
        await page.goto('file://' + htmlPath, { waitUntil: 'networkidle0', timeout: 30000 });

        // Wait for render to complete
        const result = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Render timeout')), 600000); // 10 min
            page.on('console', msg => {
                if (msg.text().startsWith('RENDER_COMPLETE:')) {
                    clearTimeout(timeout);
                    resolve(msg.text().replace('RENDER_COMPLETE:', ''));
                }
                if (msg.text().startsWith('RENDER_ERROR:')) {
                    clearTimeout(timeout);
                    reject(new Error(msg.text().replace('RENDER_ERROR:', '')));
                }
            });
        });

        await browser.close();

        // 5. Merge audio with ffmpeg if available
        const finalPath = path.join(tmpDir, 'final.mp4');
        if (job.audio_url) {
            await new Promise((resolve, reject) => {
                ffmpeg()
                    .input(result)
                    .input(audioPath)
                    .outputOptions([
                        '-c:v', 'libx264', '-preset', 'medium',
                        '-b:v', '20M', '-maxrate', '25M', '-bufsize', '40M',
                        '-c:a', 'aac', '-b:a', '192k',
                        '-shortest', '-pix_fmt', 'yuv420p', '-r', '60',
                        '-movflags', '+faststart'
                    ])
                    .save(finalPath)
                    .on('end', resolve)
                    .on('error', reject);
            });
        } else {
            fs.copyFileSync(result, finalPath);
        }

        // 6. Upload result to Supabase storage
        const videoBuffer = fs.readFileSync(finalPath);
        const fileName = `cloud-render-${JOB_ID}.mp4`;

        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('rendered-videos')
            .upload(fileName, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('rendered-videos')
            .getPublicUrl(fileName);

        // 7. Mark job as complete
        await supabase.from('render_jobs').update({
            status: 'completed',
            result_url: urlData.publicUrl,
            completed_at: new Date().toISOString()
        }).eq('id', JOB_ID);

        console.log(`Render complete: ${urlData.publicUrl}`);
    } catch (err) {
        console.error('Render failed:', err.message);
        await supabase.from('render_jobs').update({
            status: 'failed',
            error: err.message,
            completed_at: new Date().toISOString()
        }).eq('id', JOB_ID);
        process.exit(1);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

function generateRenderHTML(config, lyrics, audioPath, bgPath) {
    const lyricsJSON = JSON.stringify(lyrics);
    const configJSON = JSON.stringify(config);
    const audioData = audioPath ? `file://${audioPath}` : '';
    const bgData = bgPath ? `file://${bgPath}` : '';

    return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;overflow:hidden}
canvas{display:block;width:1920px;height:1080px}
</style>
</head><body>
<canvas id="c" width="1920" height="1080"></canvas>
<script>
const config = ${configJSON};
const lyricsData = ${lyricsJSON};

class CloudRenderer {
    constructor() {
        this.c = document.getElementById('c');
        this.ctx = this.c.getContext('2d', { alpha: false, willReadFrequently: false });
        this.lyrics = lyricsData.map((l,i) => ({
            ...l,
            endTime: i < lyricsData.length - 1
                ? lyricsData[i+1].time - Math.min(0.5, (lyricsData[i+1].time - l.time)*0.15)
                : l.time + 5
        }));
        this.config = { fontFamily:'Amatic SC', fontSize:6, textColor:'#ffffff',
            shadowIntensity:15, animSpeed:10, driftAmount:15,
            fadeInDuration:1.5, fadeOutDuration:1.5, maxTextWidth:85,
            maxCharsPerLine:0, audioOffset:0,
            overlayColor:'#6c11c9', overlayOpacity:0.3, bgBlur:5,
            artistName:'', songName:'', versionName:'', ...config };
        this.bgImage = null;
        this.totalFrames = 0;
        this.frame = 0;
    }

    async init() {
        if ('${bgData}') {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = resolve;
                img.src = '${bgData}';
            });
            this.bgImage = img;
        }
    }

    drawFrame(time) {
        const ctx = this.ctx, w=1920, h=1080;
        ctx.clearRect(0,0,w,h);
        this.drawBg(ctx,w,h);
        this.drawOverlay(ctx,w,h);
        this.drawLyrics(ctx,w,h,time+(this.config.audioOffset||0));
        this.drawWatermark(ctx,w,h);
    }

    drawBg(ctx,w,h) {
        if(this.bgImage) {
            ctx.save();
            if(this.config.bgBlur>0) ctx.filter='blur('+this.config.bgBlur+'px)';
            ctx.drawImage(this.bgImage,0,0,w,h);
            ctx.restore();
        } else {
            const g=ctx.createLinearGradient(0,0,0,h);
            g.addColorStop(0,this.config.overlayColor||'#6c11c9');
            g.addColorStop(1,this.lightenColor(this.config.overlayColor||'#6c11c9',40));
            ctx.fillStyle=g;
            ctx.fillRect(0,0,w,h);
        }
    }

    drawOverlay(ctx,w,h) {
        if(!this.bgImage) return;
        ctx.fillStyle=this.hexToRgba(this.config.overlayColor||'#6c11c9',this.config.overlayOpacity||0.3);
        ctx.fillRect(0,0,w,h);
    }

    drawLyrics(ctx,w,h,time) {
        const speed=this.config.animSpeed||10, drift=this.config.driftAmount||15;
        let active=null;
        for(const l of this.lyrics) { if(time>=l.time&&time<l.endTime) { active=l; break; } }
        if(!active) {
            const prev=this.lyrics.filter(l=>l.endTime<=time).pop();
            if(prev) { const fOut=this.config.fadeOutDuration||1.5; if(time>prev.endTime-fOut&&time<prev.endTime) this.drawSingle(ctx,w,h,prev,time,speed,drift); }
            return;
        }
        this.drawSingle(ctx,w,h,active,time,speed,drift);
    }

    drawSingle(ctx,w,h,lyric,time,speed,drift) {
        const elapsed=time-lyric.time, dur=lyric.endTime-lyric.time;
        const fi=Math.min(this.config.fadeInDuration||1.5,dur*0.4), fo=Math.min(this.config.fadeOutDuration||1.5,dur*0.4);
        let o=1;
        if(elapsed<fi) o=elapsed/fi;
        else if(time>lyric.endTime-fo) o=Math.max(0,1-(time-(lyric.endTime-fo))/fo);
        const ph=(elapsed%(speed||10))/(speed||10);
        const xd=Math.sin(ph*Math.PI*2)*drift, yd=Math.sin((ph*Math.PI*2)-Math.PI/2)*(drift*0.8);
        const mw=(w*(this.config.maxTextWidth||85))/100, bs=(this.config.fontSize||6)*(h/1080)*100;
        const ff='"'+this.config.fontFamily+'", cursive';
        let text=lyric.text;
        const mc=parseInt(this.config.maxCharsPerLine)||0;
        let lines=[text];
        if(mc>0&&text.length>mc) lines=this.wrap(text,mc);
        const lh=1.3;
        ctx.save();
        ctx.textAlign='center'; ctx.textBaseline='middle';
        let fs=bs;
        ctx.font='700 '+fs+'px '+ff;
        let ml=0; for(const l of lines) { const lw=ctx.measureText(l).width; if(lw>ml) ml=lw; }
        if(ml>mw) { fs=bs*(mw/ml); ctx.font='700 '+fs+'px '+ff; }
        const sp=this.config.shadowIntensity||15;
        ctx.shadowColor='rgba(0,0,0,'+Math.min(0.8,sp/20)+')';
        ctx.shadowBlur=sp; ctx.globalAlpha=o;
        ctx.fillStyle=this.config.textColor||'#ffffff';
        ctx.save(); ctx.translate(w/2+xd,h/2+yd);
        const th=lines.length*fs*lh, sy=-(th/2)+(fs*lh*0.35);
        for(let i=0;i<lines.length;i++) ctx.fillText(lines[i],0,sy+i*fs*lh);
        ctx.restore(); ctx.restore();
    }

    drawWatermark(ctx,w,h) {
        const a=this.config.artistName||'', s=this.config.songName||'';
        if(!a&&!s) return;
        ctx.save();
        ctx.font='400 32px "'+(this.config.fontFamily||'Amatic SC')+'", cursive';
        ctx.textAlign='center'; ctx.textBaseline='bottom';
        ctx.globalAlpha=0.35;
        ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=4;
        ctx.fillStyle='#ffffff';
        ctx.fillText(a+' — '+s,w/2,h-40);
        ctx.restore();
    }

    wrap(t,m) {
        const w=t.split(' '), l=[]; let c='';
        for(const x of w) { const n=(c+' '+x).trim(); if(n.length<=m) c=n; else { if(c) l.push(c); c=x; if(c.length>m) { while(c.length>m) { l.push(c.substring(0,m)); c=c.substring(m); } } } }
        if(c) l.push(c);
        return l.length?l:[t];
    }

    hexToRgba(h,a) {
        if(!h) return 'rgba(0,0,0,'+a+')';
        const r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
    }

    lightenColor(h,p) {
        if(!h) return '#a238ff';
        const n=parseInt(h.slice(1),16),amt=Math.round(2.55*p);
        const R=Math.min(255,(n>>16)+amt),G=Math.min(255,((n>>8)&0xFF)+amt),B=Math.min(255,(n&0xFF)+amt);
        return '#'+(0x1000000+R*0x10000+G*0x100+B).toString(16).slice(1);
    }
}

(async()=>{
    const r=new CloudRenderer();
    await r.init();
    const fps=60, dur=Math.max(1, (r.lyrics.length>0 ? r.lyrics[r.lyrics.length-1].time+5 : 30));
    const total=dur*fps;
    r.totalFrames=total;
    r.frame=0;

    const stream=r.c.captureStream(fps);
    const chunks=[];
    let mt='video/webm;codecs=vp9';
    if(!MediaRecorder.isTypeSupported(mt)) { mt='video/webm;codecs=vp8'; if(!MediaRecorder.isTypeSupported(mt)) mt='video/webm'; }

    const mr=new MediaRecorder(stream, {mimeType:mt, videoBitsPerSecond:20000000});
    mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data)};
    mr.onstop=()=>{
        const b=new Blob(chunks, {type:'video/webm'});
        const url=URL.createObjectURL(b);
        console.log('RENDER_COMPLETE:'+url);
    };
    mr.onerror=e=>console.log('RENDER_ERROR:'+e.error.message);
    mr.start(1000/fps);

    const fi=1000/fps;
    let pt=performance.now();
    const loop=(now)=>{
        if(r.frame>total) { if(mr.state==='recording') mr.stop(); return; }
        const el=now-pt;
        if(el>=fi-1) {
            pt=now-(el%fi);
            r.drawFrame(r.frame/fps);
            r.frame++;
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
})();
<\/script>
</body></html>`;
}

async function downloadFile(url, dest) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Download failed: ${url}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(dest, buffer);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
