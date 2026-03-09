import { useEffect, useRef, useState } from "react";
import p5 from "p5";
import * as Tone from "tone";
import GUI from "lil-gui";

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  // 实例引用：保存 p5 实例以便在组件销毁时进行清理
  const p5Instance = useRef<p5 | null>(null);

  // GUI 引用：保存调试面板实例
  const guiRef = useRef<GUI | null>(null);

  // Tone.js 对象引用：用于在 React 渲染之间保持音频对象，供 p5.js 可视化使用
  const toneObjects = useRef<any>({});

  useEffect(() => {
    if (p5Instance.current) {
      p5Instance.current.remove();
    }
    if (guiRef.current) {
      guiRef.current.destroy();
    }

    // 2. 初始化 GUI 调试面板 (lil-gui)
    const gui = new GUI({ title: "Controls" });
    guiRef.current = gui;

    // 3. 初始化 Tone.js 音频系统

    // --- 通用效果器 ---
    // LowPass Filter (低通滤波器): 切除高频，让声音听起来更“闷”或更柔和
    const lowPass = new Tone.Filter({
      frequency: 4000, // 截止频率
    }).toDestination(); // .toDestination() 表示连接到主输出（扬声器）

    // --- 乐器 1: Open Hi-Hat (开镲) ---
    // NoiseSynth: 噪声合成器，专门用于制作镲片、沙锤等无音高打击乐
    const openHiHat = new Tone.NoiseSynth({
      volume: -10, // 音量 (分贝 dB)
      envelope: {
        attack: 0.1, // 起音时间：声音达到最大音量所需时间 (秒)
        decay: 0.3, // 衰减时间：声音从最大音量消失所需时间 (秒)
      },
    }).connect(lowPass); // 连接到滤波器

    // Part: 序列发生器，用于编排音符
    // 参数1: 回调函数，在触发时执行
    // 参数2: 事件数组，定义触发的时间点
    const openHiHatPart = new Tone.Part(
      (time) => {
        // triggerAttack: 触发包络的开始（发声）
        openHiHat.triggerAttack(time);
      },
      [{ "8n": 2 }, { "8n": 6 }],
    ).start(0); // 在每小节的第2和第6个8分音符位置触发

    // --- 乐器 2: Closed Hi-Hat (闭镲) ---
    const closedHiHat = new Tone.NoiseSynth({
      volume: -10,
      envelope: {
        attack: 0.01,
        decay: 0.15, // 比开镲更短的衰减，模拟闭镲短促的声音
      },
    }).connect(lowPass);

    // 复杂的节奏序列：在多个时间点触发
    const closedHatPart = new Tone.Part(
      (time) => {
        closedHiHat.triggerAttack(time);
      },
      [
        0,
        { "16n": 1 },
        { "8n": 1 },
        { "8n": 3 },
        { "8n": 4 },
        { "8n": 5 },
        { "8n": 7 },
        { "8n": 8 },
      ],
    ).start(0);

    // --- 乐器 3: BASS (贝斯) ---
    // AmplitudeEnvelope: 振幅包络，独立控制音量变化
    const bassEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 1,
      sustain: 0,
    }).toDestination();

    // 滤波器：用于塑造贝斯的音色，使其更有质感
    const bassFilter = new Tone.Filter({
      frequency: 600,
      Q: 8, // 品质因子 (Resonance)，值越高共振峰越明显，声音越有“电子味”
    });

    // PulseOscillator: 脉冲振荡器，产生方波/脉冲波
    // chain: 链式连接信号流：振荡器 -> 滤波器 -> 包络 -> 输出
    const bass = new Tone.PulseOscillator("A2", 0.4).chain(
      bassFilter,
      bassEnvelope,
    );
    bass.start(); // 启动振荡器（此时无声，因为包络默认为关闭，需 triggerAttack 触发）

    // 贝斯旋律序列：包含时间和音高
    const bassPart = new Tone.Part(
      (time, note) => {
        bass.frequency.setValueAtTime(note, time); // 设置音高
        bassEnvelope.triggerAttack(time); // 触发发声
      },
      [
        // 第 1 小节
        ["0:0", "A1"], 
        ["0:2", "G1"],
        ["0:2:2", "C2"],
        ["0:3:2", "A1"],
        // 第 2 小节 (新加的戏)
        ["1:0", "F1"],
        ["1:2", "E1"],
        ["1:2:2", "G1"], 
        ["1:3:2", "C2"],
      ],
    ).start(0);

    // --- 乐器 4: BLEEP (高音哔哔声) ---
    const bleepEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 0.4,
      sustain: 0,
    }).toDestination();

    const bleep = new Tone.Oscillator("A4").connect(bleepEnvelope);
    bleep.start();

    // Loop: 循环触发器，比 Part 更简单，用于重复单一事件
    // "2n" 表示每二分音符触发一次
    const bleepLoop = new Tone.Loop((time) => {
      bleepEnvelope.triggerAttack(time);
    }, "2n").start(0);

    // --- 乐器 5: KICK (底鼓) ---
    const kickEnvelope = new Tone.AmplitudeEnvelope({
      attack: 0.01,
      decay: 0.2,
      sustain: 0,
    }).toDestination();

    const kick = new Tone.Oscillator("A2").connect(kickEnvelope).start();

    // FrequencyEnvelope: 频率包络
    // 底鼓的特点是音高会在极短时间内从高处滑落，产生“咚”的打击感
    const kickSnapEnv = new Tone.FrequencyEnvelope({
      attack: 0.005,
      decay: 0.01,
      sustain: 0,
      baseFrequency: "A2", // 基础频率
      octaves: 2.7, // 音高滑落的八度范围
    }).connect(kick.frequency); // 将包络连接到振荡器的频率参数

    const kickPart = new Tone.Part(
      (time) => {
        kickEnvelope.triggerAttack(time); // 触发音量包络
        kickSnapEnv.triggerAttack(time); // 触发频率包络
      },
      [
        // 第 1 小节
        "0:0", "0:0:3", "0:2:0", "0:3:1", 
        // 第 2 小节 (加点切分音)
        "1:0", "1:1:2", "1:2", "1:3" 
      ],
    ).start(0);

    // --- 乐器 6: SNARE (军鼓) ---
    // 军鼓通常由两部分组成：打击声（Tone）和沙带声（Noise）
    // 这里我们用 NoiseSynth 模拟沙带声，并加一个滤波器
    const snareFilter = new Tone.Filter({
        frequency: 3000,
        type: "highpass",
        Q: 1
    }).toDestination();

    const snare = new Tone.NoiseSynth({
        volume: 0,
        noise: {
            type: "pink", // 粉红噪声比白噪声更柔和
        },
        envelope: {
            attack: 0.001,
            decay: 1,
            sustain: 0
        }
    }).connect(snareFilter);

    const snarePart = new Tone.Part(
        (time) => {
            snare.triggerAttack(time);
        },
        ["0:1", "0:3"] // 在第2拍和第4拍触发 (典型的摇滚/流行节奏)
    ).start(0);

    // --- 乐器 8: TOM (嗵鼓) ---
    // MembraneSynth 专门用于模拟鼓皮振动
    const tom = new Tone.MembraneSynth({
        volume: 0,
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: {
            type: "sine"
        },
        envelope: {
            attack: 0.001,
            decay: 2,
            sustain: 0.01,
            release: 1.4,
            attackCurve: "exponential"
        }
    }).toDestination();

    const tomPart = new Tone.Part(
        (time, note) => {
            tom.triggerAttack(note, time);
        },
        [
            ["0:3:2", "A2"], 
            ["0:3:3", "G2"]
        ]
    ).start(0);


    // --- Transport (时间轴) 设置 ---
    // Tone.js 的核心计时器
    Tone.getTransport().loopStart = 0;
    Tone.getTransport().loopEnd = "2:0"; // 循环长度：2小节 (8拍)
    Tone.getTransport().loop = true; // 开启循环播放

    // 将包络对象保存到 ref 中，以便在 p5.js 的 draw 循环中访问它们的值进行可视化
    toneObjects.current = {
      kickEnvelope,
      bassEnvelope,
      bleepEnvelope,
      snare, // Snare 本身有 envelope 属性: snare.envelope.value
      tom, // Tom 也有 envelope
    };

    // 3.5. 绑定 GUI 控制面板到 Tone.js 乐器参数

    // --- Hihat 文件夹 ---
    const hihatParams = {
      openEnabled: true, // openHiHat 是否启用
      openVolume: -10, // openHiHat 初始音量
      openDecay: 0.3, // openHiHat 包络衰减
      closedEnabled: true, // closedHiHat 是否启用
      closedVolume: -10, // closedHiHat 初始音量
      closedDecay: 0.15, // closedHiHat 包络衰减
    };
    const hihatFolder = gui.addFolder("Hihat");
    hihatFolder
      .add(hihatParams, "openEnabled")
      .name("Open Enabled")
      .onChange((v: boolean) => {
        // volume.value = -Infinity 等同于静音；恢复时读取滑条当前值，GUI 显示不变
        openHiHat.volume.value = v ? hihatParams.openVolume : -Infinity;
      });
    hihatFolder
      .add(hihatParams, "openVolume", -40, 0, 0.1)
      .name("Open Volume (dB)")
      .onChange((v: number) => {
        openHiHat.volume.value = v;
      });
    hihatFolder
      .add(hihatParams, "openDecay", 0.05, 2, 0.01)
      .name("Open Decay (s)")
      .onChange((v: number) => {
        openHiHat.envelope.decay = v;
      });
    hihatFolder
      .add(hihatParams, "closedEnabled")
      .name("Closed Enabled")
      .onChange((v: boolean) => {
        closedHiHat.volume.value = v ? hihatParams.closedVolume : -Infinity;
      });
    hihatFolder
      .add(hihatParams, "closedVolume", -40, 0, 0.1)
      .name("Closed Volume (dB)")
      .onChange((v: number) => {
        closedHiHat.volume.value = v;
      });
    hihatFolder
      .add(hihatParams, "closedDecay", 0.01, 1, 0.01)
      .name("Closed Decay (s)")
      .onChange((v: number) => {
        closedHiHat.envelope.decay = v;
      });

    // --- Bass 文件夹 ---
    const bassParams = {
      enabled: true, // bass 是否启用
      volume: 0, // bass PulseOscillator 初始音量
      filterFreq: 600, // bassFilter 截止频率
      filterQ: 8, // bassFilter 共振
      decay: 1, // bassEnvelope 衰减
    };
    const bassFolder = gui.addFolder("Bass");
    bassFolder
      .add(bassParams, "enabled")
      .name("Enabled")
      .onChange((v: boolean) => {
        // bass 是振荡器源头，静音它即可静音整条信号链
        bass.mute = !v;
      });
    bassFolder
      .add(bassParams, "volume", -40, 0, 0.1)
      .name("Volume (dB)")
      .onChange((v: number) => {
        bass.volume.value = v;
      });
    bassFolder
      .add(bassParams, "filterFreq", 80, 4000, 1)
      .name("Filter Freq (Hz)")
      .onChange((v: number) => {
        bassFilter.frequency.value = v;
      });
    bassFolder
      .add(bassParams, "filterQ", 0.1, 20, 0.1)
      .name("Filter Q (Resonance)")
      .onChange((v: number) => {
        bassFilter.Q.value = v;
      });
    bassFolder
      .add(bassParams, "decay", 0.01, 1, 0.01)
      .name("Decay (s)")
      .onChange((v: number) => {
        bassEnvelope.decay = v;
      });

    // --- Bleep 文件夹 ---
    const bleepParams = {
      enabled: true, // bleep 是否启用
      volume: 0, // bleep Oscillator 初始音量
      decay: 0.4, // bleepEnvelope 衰减
    };
    const bleepFolder = gui.addFolder("Bleep");
    bleepFolder
      .add(bleepParams, "enabled")
      .name("Enabled")
      .onChange((v: boolean) => {
        bleep.mute = !v;
      });
    bleepFolder
      .add(bleepParams, "volume", -40, 0, 0.1)
      .name("Volume (dB)")
      .onChange((v: number) => {
        bleep.volume.value = v;
      });
    bleepFolder
      .add(bleepParams, "decay", 0.01, 2, 0.01)
      .name("Decay (s)")
      .onChange((v: number) => {
        bleepEnvelope.decay = v;
      });

    // --- Kick 文件夹 ---
    const kickParams = {
      enabled: true, // kick 是否启用
      volume: 0, // kick Oscillator 初始音量
      decay: 0.2, // kickEnvelope 衰减
      octaves: 2.7, // kickSnapEnv 音高滑落范围（八度数）
    };
    const kickFolder = gui.addFolder("Kick");
    kickFolder
      .add(kickParams, "enabled")
      .name("Enabled")
      .onChange((v: boolean) => {
        kick.mute = !v;
      });
    kickFolder
      .add(kickParams, "volume", -40, 0, 0.1)
      .name("Volume (dB)")
      .onChange((v: number) => {
        kick.volume.value = v;
      });
    kickFolder
      .add(kickParams, "decay", 0.01, 1, 0.01)
      .name("Decay (s)")
      .onChange((v: number) => {
        kickEnvelope.decay = v;
      });
    kickFolder
      .add(kickParams, "octaves", 0.5, 6, 0.1)
      .name("Pitch Slide (oct)")
      .onChange((v: number) => {
        kickSnapEnv.octaves = v;
      });

    // --- Snare 文件夹 ---
    const snareParams = {
        enabled: true,
        volume: 0,
        decay: 1
    };
    const snareFolder = gui.addFolder("Snare");
    snareFolder.add(snareParams, "enabled").onChange((v: boolean) => snare.volume.value = v ? snareParams.volume : -Infinity);
    snareFolder.add(snareParams, "volume", -40, 0).onChange((v: number) => snare.volume.value = v);
    snareFolder.add(snareParams, "decay", 0.05, 2).onChange((v: number) => snare.envelope.decay = v);

    // --- Tom 文件夹 ---
    const tomParams = {
        enabled: true,
        volume: 0,
        decay: 2
    };
    const tomFolder = gui.addFolder("Tom");
    tomFolder.add(tomParams, "enabled").onChange((v: boolean) => tom.volume.value = v ? tomParams.volume : -Infinity);
    tomFolder.add(tomParams, "volume", -40, 0).onChange((v: number) => tom.volume.value = v);
    tomFolder.add(tomParams, "decay", 0.1, 4).onChange((v: number) => tom.envelope.decay = v);

    // 4. 初始化 p5.js 绘图 (Sketch)
    const sketch = (p: p5) => {
      let phase = 0; // 相位变量，用于让波形动起来

      // p5.setup: 初始化函数，只运行一次
      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        p.fill(255);
        p.strokeWeight(1);
        p.rectMode(p.CENTER);
      };

      // 监听窗口大小变化，自适应画布
      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      // p5.draw: 动画循环，默认每秒 60 帧
      p.draw = () => {
        p.background(255); // 每帧清空背景 (白色)

        // --- 可视化 1: Kick Wave (底鼓波形) ---
        // 遍历画布宽度，绘制正弦波
        for (let i = 0; i < p.width; i++) {
          // 获取当前底鼓包络值 (0~1)，并放大作为波的振幅
          // 当底鼓响时，value 变大，波形振幅变大
          const kickValue = kickEnvelope.value * 200;

          // 计算 y 坐标：sin((x坐标/频率) + 相位) * 振幅
          const yDot = Math.sin(i / 60 + phase) * kickValue;
          p.point(i, p.height - 150 + yDot); // 绘制点
        }

        phase += 1; // 增加相位，让波形产生水平移动的效果

        // --- 可视化 2: Bass Circle (贝斯圆) ---
        // 圆的大小随贝斯音量变化
        const bassRadius = p.height * bassEnvelope.value;
        p.stroke("red");

        // 使用 Perlin Noise (p.noise) 生成平滑的随机运动
        // p.millis() 获取运行时间，作为噪声函数的输入
        const bassX = p.noise(p.millis() / 1000) * p.width;
        const bassY = p.noise(phase / 100) * p.height;
        p.ellipse(bassX, bassY, bassRadius, bassRadius);

        // --- 可视化 3: Bleep Rect (哔哔声方块) ---
        const beepX = p.noise(p.millis() / 500) * p.width;
        const beepY = p.noise(phase / 50) * p.height;
        const beepSize = p.height * bleepEnvelope.value;
        p.stroke("green");
        p.rect(beepX, beepY, beepSize, beepSize);

        // --- 可视化 4: Snare Star (军鼓星芒) ---
         // 使用多角星形模拟军鼓的爆发力
         if (snare.envelope.value > 0.01) {
             p.push();
             // 使用 Noise 让位置随机游走，而不是固定在中心
             // 加偏移量 1000 避免和 Bass/Bleep 轨迹重叠
             const snareX = p.noise(p.millis() / 300 + 1000) * p.width;
             const snareY = p.noise(phase / 30 + 1000) * p.height;
             p.translate(snareX, snareY);
             
             p.rotate(phase * 0.2); // 快速旋转
             p.noFill();
             p.stroke(255, 215, 0); // 金色
             p.strokeWeight(3);
             
             const radius = snare.envelope.value * 250;
             const points = 12; // 12角星
             
             p.beginShape();
             for (let i = 0; i < points * 2; i++) {
                 const angle = (Math.PI * i) / points;
                 // 奇数点半径大，偶数点半径小，形成尖刺
                 const r = i % 2 === 0 ? radius : radius * 0.4;
                 const x = Math.cos(angle) * r;
                 const y = Math.sin(angle) * r;
                 p.vertex(x, y);
             }
             p.endShape(p.CLOSE);
             p.pop();
         }
 
         // --- 可视化 5: Tom Hexagons (嗵鼓六边形) ---
         // 使用同心六边形模拟嗵鼓的层层递进
         if (tom.envelope.value > 0.01) {
              p.push();
              // 使用 Noise 让位置随机游走
              // 加偏移量 2000 确保轨迹独特
              const tomX = p.noise(p.millis() / 500 + 2000) * p.width;
              const tomY = p.noise(phase / 50 + 2000) * p.height;
              p.translate(tomX, tomY);

              p.noFill();
              p.stroke("cyan"); // 青色
              p.strokeWeight(4);
              
              const baseSize = tom.envelope.value * 300;
              
              // 绘制3个同心六边形
              for(let k = 0; k < 3; k++) {
                  const currentSize = baseSize * (1 - k * 0.25);
                  if (currentSize > 0) {
                      p.beginShape();
                      for (let i = 0; i < 6; i++) {
                         // 加上 phase 让六边形缓慢旋转
                         const angle = (Math.PI / 3) * i + (phase * 0.01);
                         const x = Math.cos(angle) * currentSize;
                         const y = Math.sin(angle) * currentSize;
                         p.vertex(x, y);
                      }
                      p.endShape(p.CLOSE);
                  }
              }
              p.pop();
         }
      };
    };

    // 创建 p5 实例，并将其挂载到 canvasRef 指向的 div 上
    if (canvasRef.current) {
      p5Instance.current = new p5(sketch, canvasRef.current);
    }

    // 5. Cleanup 函数：当组件卸载或重新渲染前运行
    return () => {
      // 销毁 p5 实例
      if (p5Instance.current) {
        p5Instance.current.remove();
      }
      // 销毁 GUI
      if (guiRef.current) {
        guiRef.current.destroy();
      }
      // 停止并取消 Tone Transport
      Tone.getTransport().stop();
      Tone.getTransport().cancel();

      // 销毁所有 Tone.js 节点，防止内存泄漏和声音残留
      lowPass.dispose();
      openHiHat.dispose();
      openHiHatPart.dispose();
      closedHiHat.dispose();
      closedHatPart.dispose();
      bassEnvelope.dispose();
      bassFilter.dispose();
      bass.dispose();
      bassPart.dispose();
      bleepEnvelope.dispose();
      bleep.dispose();
      bleepLoop.dispose();
      kickEnvelope.dispose();
      kick.dispose();
      kickSnapEnv.dispose();
      kickPart.dispose();
      snare.dispose();
      snareFilter.dispose();
      snarePart.dispose();
      tom.dispose();
      tomPart.dispose();
    };
  }, []);

  // 处理播放/停止点击事件
  const togglePlay = async () => {
    if (!isPlaying) {
      await Tone.start();
      Tone.getTransport().start(); // 启动时间轴，开始播放音乐
      setIsPlaying(true);
    } else {
      Tone.getTransport().stop(); // 停止时间轴
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-100">
      {/* 这是一个容器 div，p5 的 canvas 会被插入到这里 */}
      <div
        ref={canvasRef}
        id="canvas-container"
        className="absolute inset-0 z-0"
      ></div>

      {/* 播放按钮层，使用 pointer-events-none 防止遮挡 canvas 的交互（虽然这里 canvas 也没交互） */}
      <div className="relative z-10 flex top-10 left-10 pointer-events-none">
        <button
          onClick={togglePlay}
          className={`px-6 py-3 rounded-full text-white font-bold text-lg transition-colors pointer-events-auto shadow-lg ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600"
              : "bg-green-500 hover:bg-green-600"
          }`}
        >
          <span className="material-icons align-middle mr-2">
            {isPlaying ? "stop" : "play_arrow"}
          </span>
          {isPlaying ? "Stop" : "Play"}
        </button>
      </div>
    </div>
  );
}

export default App;
