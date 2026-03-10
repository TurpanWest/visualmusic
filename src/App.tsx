import { useEffect, useRef, useState } from "react";
import p5 from "p5";
import * as Tone from "tone";
import GUI from "lil-gui";

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const p5Instance = useRef<p5 | null>(null);
  const guiRef = useRef<GUI | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toneObjects = useRef<any>({});

  useEffect(() => {
    if (p5Instance.current) p5Instance.current.remove();
    if (guiRef.current) guiRef.current.destroy();

    const gui = new GUI({ title: "Controls" });
    guiRef.current = gui;

    // ==========================================
    // 🎧 1. 全局设置 & 空间效果器 (Mix & FX)
    // ==========================================
    Tone.getTransport().bpm.value = 90; // 设定标准 House/Techno 速度

    // 混响：让声音有在巨大空间里的感觉
    const reverb = new Tone.Reverb({
      decay: 4,
      wet: 0.4,
    }).toDestination();

    // 乒乓延迟：声音在左右耳之间来回跳动
    const delay = new Tone.PingPongDelay("8n.", 0.5).toDestination();

    // 全局低通滤波
    const lowPass = new Tone.Filter({
      frequency: 8000, 
    }).toDestination();

    // ==========================================
    // 🥁 2. 打击乐组 (Drums: Kick, Snare, HiHats)
    // ==========================================

    // --- KICK (底鼓: 四四拍，稳住下盘) ---
    const kickEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.2, sustain: 0,
    }).toDestination();

    const kick = new Tone.Oscillator("C1").connect(kickEnvelope).start();
    const kickSnapEnv = new Tone.FrequencyEnvelope({
      attack: 0.001, decay: 0.1, sustain: 0, baseFrequency: "C1", octaves: 4, // 让音高快速滑落产生 punch
    }).connect(kick.frequency);

    // 稳如泰山的 4-on-the-floor 节奏 (每拍打一下)
    const kickPart = new Tone.Part(
      (time) => {
        kickEnvelope.triggerAttack(time);
        kickSnapEnv.triggerAttack(time);
      },["0:0", "0:1", "0:2", "0:3", "1:0", "1:1", "1:2", "1:3", "2:0", "2:1", "2:2", "2:3", "3:0", "3:1", "3:2", "3:3"]
    ).start(0);

    // --- SNARE (军鼓: 骨架，打在 2、4 拍) ---
    const snareFilter = new Tone.Filter({ frequency: 2000, type: "highpass", Q: 1 }).toDestination();
    const snare = new Tone.NoiseSynth({
      volume: -5,
      noise: { type: "white" },
      envelope: { attack: 0.001, decay: 0.2, sustain: 0 }, // decay 变短，让军鼓清脆
    }).connect(snareFilter);

    const snarePart = new Tone.Part(
      (time) => snare.triggerAttack(time),["0:1", "0:3", "1:1", "1:3", "2:1", "2:3", "3:1", "3:3"]
    ).start(0);

    // --- HI-HATS (踩镲: 织网格，提供速度感) ---
    const openHiHat = new Tone.NoiseSynth({
      volume: -15, envelope: { attack: 0.01, decay: 0.3 },
    }).connect(lowPass);

    // Open Hat 打在反拍 (动-呲-打-呲)
    const openHiHatPart = new Tone.Part(
      (time) => openHiHat.triggerAttack(time),["0:0:2", "0:1:2", "0:2:2", "0:3:2", "1:0:2", "1:1:2", "1:2:2", "1:3:2", "2:0:2", "2:1:2", "2:2:2", "2:3:2", "3:0:2", "3:1:2", "3:2:2", "3:3:2"]
    ).start(0);

    const closedHiHat = new Tone.NoiseSynth({
      volume: -18, envelope: { attack: 0.005, decay: 0.05 },
    }).connect(lowPass);

    // Closed Hat 填补 16 分音符的缝隙
    const closedHatLoop = new Tone.Loop((time) => {
      // 稍微随机化力度，增加人性化
      closedHiHat.volume.value = Math.random() > 0.5 ? -18 : -24;
      closedHiHat.triggerAttack(time);
    }, "16n").start(0);

    // --- TOM (嗵鼓: 专门在第4小节末尾加花 Drop) ---
    const tom = new Tone.MembraneSynth({
      volume: -5, pitchDecay: 0.05, octaves: 4,
      envelope: { attack: 0.001, decay: 0.4, sustain: 0 }
    }).toDestination();

    const tomPart = new Tone.Part(
      (time, note) => tom.triggerAttack(note, time),
      [["3:3:0", "G1"], ["3:3:2", "C1"]] // 只在最后一拍轰两下
    ).start(0);


    // ==========================================
    // 🎸 3. 旋律组 (Bass, Bleep, Melody)
    // ==========================================
    // 统一调性：C小调五声音阶 (极其带感，绝不冲突)
    const scaleMinor =["C2", "Eb2", "F2", "G2", "Bb2", "C3"];

    // --- BASS (贝斯: 弹跳感 Acid Bass) ---
    const bassEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.001, decay: 0.66, sustain: 0, // 短促有力
    }).toDestination();

    const bassFilter = new Tone.Filter({ frequency: 800, Q: 3 }).connect(bassEnvelope);
    const bass = new Tone.Oscillator("C2", "sawtooth").connect(bassFilter).start();
    bass.volume.value = -5; // 初始 Volume

    // 让 Bass 专挑 Kick 不响的缝隙打 (切分音)
    const generateGroovyBass = () => {
      const events =[];
      const steps = 16; 
      // 经典的 3-3-2 变体律动
      const hitPattern =[1,0,0,1,0,0,1,0, 1,0,1,0,0,1,0,0]; 
      
      for (let bar = 0; bar < 4; bar++) {
        for (let s = 0; s < steps; s++) {
          if (hitPattern[s] === 1) {
            const time = `${bar}:${Math.floor(s/4)}:${s%4}`;
            // 80% 弹根音 C2，20% 弹音阶里随机的音
            const note = Math.random() > 0.2 ? "C2" : scaleMinor[Math.floor(Math.random() * scaleMinor.length)];
            events.push([time, note]);
          }
        }
      }
      return events;
    };

    const bassPart = new Tone.Part(
      (time, note) => {
        bass.frequency.setValueAtTime(note, time);
        bassEnvelope.triggerAttack(time);
      },
      generateGroovyBass()
    ).start(0);




    // --- MAIN MELODY (FatOscillator 史诗主音) ---
    const melodyFilter = new Tone.Filter({ frequency: 3000, type: "lowpass", Q: 2 }).connect(reverb); // 连入混响！
    
    const melody = new Tone.Synth({
        volume: 0,
        oscillator: { type: "fatsawtooth", count: 7, spread: 40 }, // count 增加到 7
        envelope: { attack: 0.05, decay: 0.6, sustain: 0.53, release: 2.5 }
    }).connect(melodyFilter);

    // 使用同调性的 C Minor Pentatonic，稍微提高八度
    const melodyPart = new Tone.Part(
        (time, note) => melody.triggerAttackRelease(note, "8n", time),
        [
            ["0:0:0", "C4"],["0:1:2", "Eb4"], ["0:2:0", "F4"],["1:0:0", "G4"], ["1:1:2", "Bb4"], ["1:2:2", "G4"],
            ["2:0:0", "C5"], ["2:1:2", "Bb4"],["2:2:0", "G4"],
            ["3:0:0", "F4"],["3:1:0", "Eb4"], ["3:2:0", "C4"] // 落回根音
        ]
    ).start(0);

    // --- Transport 循环设置 ---
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = "4:0"; // 4小节循环
    Tone.getTransport().loop = true;

    // 保存引用供可视化使用
    toneObjects.current = { 
        kickEnvelope, kickEnabled: true,
        bassEnvelope, bassEnabled: true,
        snare, snareEnabled: true,
        tom, tomEnabled: true,
        melody, melodyEnabled: true
    };

    // 收集所有需要清理的 Tone.js 对象
    const disposables = [
        reverb, delay, lowPass,
        kick, kickEnvelope, kickSnapEnv, kickPart,
        snare, snareFilter, snarePart,
        openHiHat, openHiHatPart,
        closedHiHat, closedHatLoop,
        tom, tomPart,
        bass, bassFilter, bassEnvelope, bassPart,
        melody, melodyFilter, melodyPart
    ];

    // ==========================================
    // 🎛️ 4. GUI 控制面板绑定 (保留你原来的代码逻辑)
    // ==========================================

    // --- Global & FX ---
    const globalParams = { 
        bpm: 90, 
        reverbDecay: 4, reverbWet: 0.4,
        delayFeedback: 0.5, delayWet: 0.5,
        masterLowPass: 8000
    };
    const globalFolder = gui.addFolder("Global & FX");
    globalFolder.add(globalParams, "bpm", 60, 180).name("BPM").onChange((v: number) => Tone.getTransport().bpm.value = v);
    globalFolder.add(globalParams, "reverbDecay", 0.1, 10).name("Reverb Decay").onChange((v: number) => reverb.decay = v);
    globalFolder.add(globalParams, "reverbWet", 0, 1).name("Reverb Wet").onChange((v: number) => reverb.wet.value = v);
    globalFolder.add(globalParams, "delayFeedback", 0, 1).name("Delay Feedback").onChange((v: number) => delay.feedback.value = v);
    globalFolder.add(globalParams, "delayWet", 0, 1).name("Delay Wet").onChange((v: number) => delay.wet.value = v);
    globalFolder.add(globalParams, "masterLowPass", 100, 20000).name("Master LowPass").onChange((v: number) => lowPass.frequency.value = v);

    // --- Drums Group ---
    const drumsFolder = gui.addFolder("Drums Group");
    
    // Kick
    const kickParams = { enabled: true, volume: 0, decay: 0.2, punchDecay: 0.1, punchOctaves: 4 };
    const kickFolder = drumsFolder.addFolder("Kick");
    kickFolder.add(kickParams, "enabled").onChange((v: boolean) => { kick.mute = !v; toneObjects.current.kickEnabled = v; });
    kickFolder.add(kickParams, "volume", -40, 0).onChange((v: number) => kick.volume.value = v);
    kickFolder.add(kickParams, "decay", 0.01, 1).onChange((v: number) => kickEnvelope.decay = v);
    kickFolder.add(kickParams, "punchDecay", 0.01, 0.5).onChange((v: number) => kickSnapEnv.decay = v);
    kickFolder.add(kickParams, "punchOctaves", 0, 10).onChange((v: number) => kickSnapEnv.octaves = v);

    // Snare
    const snareParams = { enabled: true, volume: -5, decay: 0.2, filterFreq: 2000 };
    const snareFolder = drumsFolder.addFolder("Snare");
    snareFolder.add(snareParams, "enabled").onChange((v: boolean) => { snare.volume.value = v ? snareParams.volume : -Infinity; toneObjects.current.snareEnabled = v; });
    snareFolder.add(snareParams, "volume", -40, 0).onChange((v: number) => snare.volume.value = v);
    snareFolder.add(snareParams, "decay", 0.01, 1).onChange((v: number) => snare.envelope.decay = v);
    snareFolder.add(snareParams, "filterFreq", 100, 10000).onChange((v: number) => snareFilter.frequency.value = v);

    // HiHats
    const hihatParams = { openEnabled: true, openVolume: -15, openDecay: 0.3, closedEnabled: true, closedVolume: -18, closedDecay: 0.05 };
    const hihatFolder = drumsFolder.addFolder("Hihats");
    hihatFolder.add(hihatParams, "openEnabled").onChange((v:boolean) => openHiHat.volume.value = v ? hihatParams.openVolume : -Infinity);
    hihatFolder.add(hihatParams, "openVolume", -40, 0).onChange((v:number) => openHiHat.volume.value = v);
    hihatFolder.add(hihatParams, "openDecay", 0.01, 1).onChange((v: number) => openHiHat.envelope.decay = v);
    hihatFolder.add(hihatParams, "closedEnabled").onChange((v:boolean) => closedHiHat.volume.value = v ? hihatParams.closedVolume : -Infinity);
    hihatFolder.add(hihatParams, "closedVolume", -40, 0).onChange((v:number) => closedHiHat.volume.value = v);
    hihatFolder.add(hihatParams, "closedDecay", 0.01, 0.5).onChange((v: number) => closedHiHat.envelope.decay = v);

    // Tom
    const tomParams = { enabled: true, volume: -5, decay: 0.4, pitchDecay: 0.05 };
    const tomFolder = drumsFolder.addFolder("Tom");
    tomFolder.add(tomParams, "enabled").onChange((v: boolean) => { tom.volume.value = v ? tomParams.volume : -Infinity; toneObjects.current.tomEnabled = v; });
    tomFolder.add(tomParams, "volume", -40, 0).onChange((v: number) => tom.volume.value = v);
    tomFolder.add(tomParams, "decay", 0.01, 2).onChange((v: number) => tom.envelope.decay = v);
    tomFolder.add(tomParams, "pitchDecay", 0.001, 0.5).onChange((v: number) => tom.pitchDecay = v);

    // --- Melody Group ---
    const melodyGroupFolder = gui.addFolder("Melody Group");

    // Bass
    const bassParams = { enabled: true, volume: -5, filterFreq: 800, filterQ: 3, decay: 0.66 };
    const bassFolder = melodyGroupFolder.addFolder("Bass");
    bassFolder.add(bassParams, "enabled").onChange((v:boolean) => { bass.mute = !v; toneObjects.current.bassEnabled = v; });
    bassFolder.add(bassParams, "volume", -40, 0).onChange((v:number) => bass.volume.value = v);
    bassFolder.add(bassParams, "filterFreq", 80, 4000).onChange((v:number) => bassFilter.frequency.value = v);
    bassFolder.add(bassParams, "filterQ", 0, 20).onChange((v: number) => bassFilter.Q.value = v);
    bassFolder.add(bassParams, "decay", 0.01, 1).onChange((v:number) => bassEnvelope.decay = v);



    // Main Melody
    const melodyParams = { 
        enabled: true, volume: 0, 
        spread: 40, count: 7, 
        filterFreq: 3000, filterQ: 2,
        attack: 0.05, decay: 0.6, sustain: 0.53, release: 2.5
    };
    const melodyFolder = melodyGroupFolder.addFolder("Melody (FatOscillator)");
    melodyFolder.add(melodyParams, "enabled").onChange((v:boolean) => { melody.volume.value = v ? melodyParams.volume : -Infinity; toneObjects.current.melodyEnabled = v; });
    melodyFolder.add(melodyParams, "volume", -40, 0).onChange((v:number) => melody.volume.value = v);
    melodyFolder.add(melodyParams, "spread", 0, 100).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).spread = v);
    melodyFolder.add(melodyParams, "count", 1, 9, 1).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).count = v);
    melodyFolder.add(melodyParams, "filterFreq", 100, 10000).onChange((v: number) => melodyFilter.frequency.value = v);
    melodyFolder.add(melodyParams, "filterQ", 0, 20).onChange((v: number) => melodyFilter.Q.value = v);
    melodyFolder.add(melodyParams, "attack", 0, 2).onChange((v: number) => melody.envelope.attack = v);
    melodyFolder.add(melodyParams, "decay", 0, 2).onChange((v: number) => melody.envelope.decay = v);
    melodyFolder.add(melodyParams, "sustain", 0, 1).onChange((v: number) => melody.envelope.sustain = v);
    melodyFolder.add(melodyParams, "release", 0, 5).onChange((v: number) => melody.envelope.release = v);

    // ==========================================
    // 🎨 5. p5.js 可视化引擎 (保持原样)
    // ==========================================
    const sketch = (p: p5) => {
      let phase = 0;
      // Kick 冲击波数组
      const shockwaves: { size: number; opacity: number }[] = [];

      p.setup = () => { 
        p.createCanvas(p.windowWidth, p.windowHeight); 
        p.colorMode(p.HSB, 360, 100, 100, 100); // 切换 HSB 模式
        p.rectMode(p.CENTER); 
      };
      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

      p.draw = () => {
        const { kickEnvelope, kickEnabled, bassEnvelope, bassEnabled, snare, snareEnabled, tom, tomEnabled, melody, melodyEnabled } = toneObjects.current;

        // --- 1. 全局氛围 & 背景 (Global Atmosphere) ---
        // 背景始终为深灰/黑色，带透明度拖尾，不再闪烁
        p.background(20, 30); // 纯深色背景

        // 将原点移至屏幕中心，构建星系
        p.translate(p.width / 2, p.height / 2);
        phase += 1;

        // --- 2. Kick Shockwaves (同心圆冲击波) ---
        if (kickEnvelope && kickEnabled && kickEnvelope.value > 0.1 && p.frameCount % 5 === 0) { // 限制产生频率
            shockwaves.push({ size: 50, opacity: 100 });
        }
        
        p.noFill();
        p.strokeWeight(2);
        for (let i = shockwaves.length - 1; i >= 0; i--) {
            const wave = shockwaves[i];
            wave.size += 15; // 扩散速度
            wave.opacity -= 2; // 衰减速度
            
            if (wave.opacity <= 0) {
                shockwaves.splice(i, 1);
            } else {
                p.stroke(0, 0, 100, wave.opacity); // 白色波纹
                p.ellipse(0, 0, wave.size, wave.size);
            }
        }

        // --- 3. Bass Core (恒星/心脏) ---
        if(bassEnvelope && bassEnabled) {
            const bassVal = bassEnvelope.value; 
            const baseRadius = p.height * 0.15 + bassVal * 150;
            
            // Bass 核心颜色: 降低饱和度的暗红色
            p.stroke(350, 60, 80); 
            p.strokeWeight(3);
            p.noFill();  
            
            p.beginShape();
            for (let a = 0; a < p.TWO_PI; a += 0.1) {
                // 有机蠕动
                const xoff = Math.cos(a) + phase * 0.02;
                const yoff = Math.sin(a) + phase * 0.02;
                const r = baseRadius + p.map(p.noise(xoff, yoff, phase * 0.05), 0, 1, -30, 30) * (1 + bassVal * 3); 
                const x = r * Math.cos(a);
                const y = r * Math.sin(a);
                p.vertex(x, y);
            }
            p.endShape(p.CLOSE);
        }

        // --- 4. Melody Orbit (土星环) ---
        if (melody && melodyEnabled && melody.envelope) {
             const melodyVal = melody.envelope.value;
             p.noFill(); 
             p.stroke(280, 80, 100); // 紫色
             p.strokeWeight(2);
             
             const orbitRadius = p.height * 0.35;
             p.beginShape();
             for (let a = 0; a <= p.TWO_PI; a += 0.05) {
                 // 环绕圆周的波形
                 // 映射角度到线性 noise
                 const noiseVal = (p.noise(a * 5, phase * 0.05) - 0.5) * melodyVal * 300;
                 const r = orbitRadius + noiseVal;
                 const x = r * Math.cos(a);
                 const y = r * Math.sin(a);
                 p.vertex(x, y);
             }
             p.endShape(p.CLOSE);
        }

        // --- 5. Snare & Tom Satellites (公转行星) ---
        
        // Snare: 内圈快速公转的星星
        if (snare && snareEnabled && snare.envelope.value > 0.01) {
             p.push();
             const snareDist = p.height * 0.25; // 轨道距离
             const snareAngle = phase * 0.05; // 公转速度
             p.rotate(snareAngle);
             p.translate(snareDist, 0); // 移动到轨道位置
             
             // 自转
             p.rotate(phase * 0.1); 
             
             p.noFill(); 
             p.stroke(50, 100, 100); // 金黄色
             p.strokeWeight(3);
             
             const radius = snare.envelope.value * 200;
             p.beginShape();
             for (let i = 0; i < 16; i++) { // 8角星
                 const r = i % 2 === 0 ? radius : radius * 0.4;
                 p.vertex(Math.cos(Math.PI * i / 8) * r, Math.sin(Math.PI * i / 8) * r);
             }
             p.endShape(p.CLOSE);
             p.pop();
         }
 
         // Tom: 外圈缓慢公转的六边形
         if (tom && tomEnabled && tom.envelope.value > 0.01) {
              p.push();
              const tomDist = p.height * 0.45; // 更远的轨道
              const tomAngle = -phase * 0.02; // 反向慢速公转
              p.rotate(tomAngle);
              p.translate(tomDist, 0);
              
              p.noFill(); 
              p.stroke(180, 100, 100); // 青色
              p.strokeWeight(4);
              
              const baseSize = tom.envelope.value * 250;
              // 绘制同心六边形
              for(let k = 0; k < 3; k++) {
                  const currentSize = baseSize * (1 - k * 0.3);
                  if (currentSize > 0) {
                      p.beginShape();
                      for (let i = 0; i < 6; i++) {
                         p.vertex(Math.cos(Math.PI/3 * i) * currentSize, Math.sin(Math.PI/3 * i) * currentSize);
                      }
                      p.endShape(p.CLOSE);
                  }
              }
              p.pop();
         }
      };
    };

    if (canvasRef.current) p5Instance.current = new p5(sketch, canvasRef.current);

    return () => {
      if (p5Instance.current) p5Instance.current.remove();
      if (guiRef.current) guiRef.current.destroy();
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      // 清理所有音源
      disposables.forEach(n => n.dispose());
    };
  },[]);

  const togglePlay = async () => {
    if (!isPlaying) {
      await Tone.start();
      Tone.getTransport().start();
      setIsPlaying(true);
    } else {
      Tone.getTransport().pause(); // 用 pause 保持时间轴状态，或 stop
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-100">
      <div ref={canvasRef} className="absolute inset-0 z-0"></div>
      <div className="relative z-10 flex top-10 left-10 pointer-events-none">
        <button
          onClick={togglePlay}
          className={`px-6 py-3 rounded-full text-white font-bold text-lg transition-colors pointer-events-auto shadow-lg ${
            isPlaying ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
          }`}
        >
          {isPlaying ? "Stop" : "Play"}
        </button>
      </div>
    </div>
  );
}

export default App;