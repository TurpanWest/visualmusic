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
    Tone.getTransport().bpm.value = 125; // 设定标准 House/Techno 速度

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
      attack: 0.001, decay: 0.15, sustain: 0, // 短促有力
    }).toDestination();

    const bassFilter = new Tone.Filter({ frequency: 800, Q: 3 }).connect(bassEnvelope);
    const bass = new Tone.Oscillator("C2", "sawtooth").connect(bassFilter).start();

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

    // --- BLEEP (哔哔声: 连接延迟效果器，做点缀) ---
    const bleepEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.005, decay: 0.1, sustain: 0,
    }).connect(delay); // 连入延迟！

    const bleep = new Tone.Oscillator("C5", "square").connect(bleepEnvelope).start();

    // 偶尔发声 (Polyrhythm 效果)
    const bleepPart = new Tone.Part(
      (time) => {
        const notes = ["C5", "Eb5", "G5"];
        bleep.frequency.setValueAtTime(notes[Math.floor(Math.random() * notes.length)], time);
        bleepEnvelope.triggerAttack(time);
      },["0:2:2", "1:3:0", "2:1:2", "3:0:2"] // 精心挑选的切分位置
    ).start(0);


    // --- MAIN MELODY (FatOscillator 史诗主音) ---
    const melodyFilter = new Tone.Filter({ frequency: 3000, type: "lowpass", Q: 2 }).connect(reverb); // 连入混响！
    
    const melody = new Tone.Synth({
        volume: -12,
        oscillator: { type: "fatsawtooth", count: 3, spread: 40 },
        envelope: { attack: 0.05, decay: 0.6, sustain: 0.2, release: 1 }
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
    toneObjects.current = { kickEnvelope, bassEnvelope, bleepEnvelope, snare, tom, melody };

    // 收集所有需要清理的 Tone.js 对象
    const disposables = [
        reverb, delay, lowPass,
        kick, kickEnvelope, kickSnapEnv, kickPart,
        snare, snareFilter, snarePart,
        openHiHat, openHiHatPart,
        closedHiHat, closedHatLoop,
        tom, tomPart,
        bass, bassFilter, bassEnvelope, bassPart,
        bleep, bleepEnvelope, bleepPart,
        melody, melodyFilter, melodyPart
    ];

    // ==========================================
    // 🎛️ 4. GUI 控制面板绑定 (保留你原来的代码逻辑)
    // ==========================================

    // --- Global & FX ---
    const globalParams = { 
        bpm: 125, 
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
    kickFolder.add(kickParams, "enabled").onChange((v: boolean) => kick.mute = !v);
    kickFolder.add(kickParams, "volume", -40, 0).onChange((v: number) => kick.volume.value = v);
    kickFolder.add(kickParams, "decay", 0.01, 1).onChange((v: number) => kickEnvelope.decay = v);
    kickFolder.add(kickParams, "punchDecay", 0.01, 0.5).onChange((v: number) => kickSnapEnv.decay = v);
    kickFolder.add(kickParams, "punchOctaves", 0, 10).onChange((v: number) => kickSnapEnv.octaves = v);

    // Snare
    const snareParams = { enabled: true, volume: -5, decay: 0.2, filterFreq: 2000 };
    const snareFolder = drumsFolder.addFolder("Snare");
    snareFolder.add(snareParams, "enabled").onChange((v: boolean) => snare.volume.value = v ? snareParams.volume : -Infinity);
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
    tomFolder.add(tomParams, "enabled").onChange((v: boolean) => tom.volume.value = v ? tomParams.volume : -Infinity);
    tomFolder.add(tomParams, "volume", -40, 0).onChange((v: number) => tom.volume.value = v);
    tomFolder.add(tomParams, "decay", 0.01, 2).onChange((v: number) => tom.envelope.decay = v);
    tomFolder.add(tomParams, "pitchDecay", 0.001, 0.5).onChange((v: number) => tom.pitchDecay = v);

    // --- Melody Group ---
    const melodyGroupFolder = gui.addFolder("Melody Group");

    // Bass
    const bassParams = { enabled: true, volume: 0, filterFreq: 800, filterQ: 3, decay: 0.15 };
    const bassFolder = melodyGroupFolder.addFolder("Bass");
    bassFolder.add(bassParams, "enabled").onChange((v:boolean) => bass.mute = !v);
    bassFolder.add(bassParams, "volume", -40, 0).onChange((v:number) => bass.volume.value = v);
    bassFolder.add(bassParams, "filterFreq", 80, 4000).onChange((v:number) => bassFilter.frequency.value = v);
    bassFolder.add(bassParams, "filterQ", 0, 20).onChange((v: number) => bassFilter.Q.value = v);
    bassFolder.add(bassParams, "decay", 0.01, 1).onChange((v:number) => bassEnvelope.decay = v);

    // Bleep
    const bleepParams = { enabled: true, volume: 0, decay: 0.1 };
    const bleepFolder = melodyGroupFolder.addFolder("Bleep");
    bleepFolder.add(bleepParams, "enabled").onChange((v: boolean) => bleep.mute = !v);
    bleepFolder.add(bleepParams, "volume", -40, 0).onChange((v: number) => bleep.volume.value = v);
    bleepFolder.add(bleepParams, "decay", 0.01, 1).onChange((v: number) => bleepEnvelope.decay = v);

    // Main Melody
    const melodyParams = { 
        enabled: true, volume: -12, 
        spread: 40, count: 3, 
        filterFreq: 3000, filterQ: 2,
        attack: 0.05, decay: 0.6, sustain: 0.2, release: 1
    };
    const melodyFolder = melodyGroupFolder.addFolder("Melody (FatOscillator)");
    melodyFolder.add(melodyParams, "enabled").onChange((v:boolean) => melody.volume.value = v ? melodyParams.volume : -Infinity);
    melodyFolder.add(melodyParams, "volume", -40, 0).onChange((v:number) => melody.volume.value = v);
    melodyFolder.add(melodyParams, "spread", 0, 100).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).spread = v);
    melodyFolder.add(melodyParams, "count", 1, 5, 1).onChange((v: number) => (melody.oscillator as unknown as Tone.FatOscillator).count = v);
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
      p.setup = () => { p.createCanvas(p.windowWidth, p.windowHeight); p.fill(0); p.strokeWeight(1); p.rectMode(p.CENTER); };
      p.windowResized = () => p.resizeCanvas(p.windowWidth, p.windowHeight);

      p.draw = () => {
        p.background(27);
        const { kickEnvelope, bassEnvelope, bleepEnvelope, snare, tom, melody } = toneObjects.current;

        // Kick Wave
        if(kickEnvelope) {
            for (let i = 0; i < p.width; i++) {
            const kickValue = kickEnvelope.value * 200;
            const yDot = Math.sin(i / 60 + phase) * kickValue;
            p.stroke("white");
            p.point(i, p.height - 150 + yDot);
            }
        }
        phase += 1;

        // Bass Circle
        if(bassEnvelope) {
            const bassRadius = p.height * bassEnvelope.value * 1.5;
            p.stroke("red");
            const bassX = p.noise(p.millis() / 1000) * p.width;
            const bassY = p.noise(phase / 100) * p.height;
            p.ellipse(bassX, bassY, bassRadius, bassRadius);
        }

        // Bleep Rect
        if(bleepEnvelope) {
            const beepX = p.noise(p.millis() / 500) * p.width;
            const beepY = p.noise(phase / 50) * p.height;
            const beepSize = p.height * bleepEnvelope.value * 1.5;
            p.stroke("green");
            p.rect(beepX, beepY, beepSize, beepSize);
        }

        // Snare Star
        if (snare && snare.envelope.value > 0.01) {
             p.push();
             const snareX = p.noise(p.millis() / 300 + 1000) * p.width;
             const snareY = p.noise(phase / 30 + 1000) * p.height;
             p.translate(snareX, snareY);
             p.rotate(phase * 0.2);
             p.noFill(); p.stroke(255, 215, 0); p.strokeWeight(3);
             const radius = snare.envelope.value * 250;
             p.beginShape();
             for (let i = 0; i < 24; i++) {
                 const r = i % 2 === 0 ? radius : radius * 0.4;
                 p.vertex(Math.cos(Math.PI * i / 12) * r, Math.sin(Math.PI * i / 12) * r);
             }
             p.endShape(p.CLOSE);
             p.pop();
         }
 
         // Tom Hexagons
         if (tom && tom.envelope.value > 0.01) {
              p.push();
              const tomX = p.noise(p.millis() / 500 + 2000) * p.width;
              const tomY = p.noise(phase / 50 + 2000) * p.height;
              p.translate(tomX, tomY);
              p.noFill(); p.stroke("cyan"); p.strokeWeight(4);
              const baseSize = tom.envelope.value * 300;
              for(let k = 0; k < 3; k++) {
                  const currentSize = baseSize * (1 - k * 0.25);
                  if (currentSize > 0) {
                      p.beginShape();
                      for (let i = 0; i < 6; i++) {
                         p.vertex(Math.cos(Math.PI/3 * i + phase*0.01) * currentSize, Math.sin(Math.PI/3 * i + phase*0.01) * currentSize);
                      }
                      p.endShape(p.CLOSE);
                  }
              }
              p.pop();
         }

         // Melody Flow
         if (melody && melody.envelope && melody.envelope.value > 0.01) {
             p.push();
             p.translate(0, p.height / 2);
             p.noFill(); p.stroke("purple"); p.strokeWeight(2);
             const melodyVal = melody.envelope.value * 200;
             p.beginShape();
             for (let i = 0; i < p.width; i+=10) {
                 const yOffset = Math.sin(i * 0.05 + phase * 0.1) * melodyVal;
                 const noiseVal = (p.noise(i * 0.01, phase * 0.05) - 0.5) * melodyVal * 2;
                 p.vertex(i, yOffset + noiseVal);
             }
             p.endShape();
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