// ===== 视觉动效层：浮动文字 / 震动 / 闪光 / 粒子 =====
// 所有特效都挂在独立的 #fxLayer 覆盖层上（position:fixed），
// 不依赖页面 DOM 结构，页面重渲染不会打断正在播放的动画。
// 无头环境（测试）下缺少 DOM 时全部安全降级为无操作。

const FX = {
  layer: null,

  // 获取/创建覆盖层；无 document.body 时返回 null（测试环境）
  ensureLayer(){
    if (this.layer && document.body && typeof document.body.contains === 'function' && document.body.contains(this.layer)) return this.layer;
    if (typeof document === 'undefined' || !document.body || typeof document.body.appendChild !== 'function') return null;
    const d = document.createElement('div');
    d.id = 'fxLayer';
    document.body.appendChild(d);
    this.layer = d;
    return d;
  },

  // 在视口坐标 (x,y) 处漂浮一段文字
  float(x, y, text, color, big){
    const layer = this.ensureLayer();
    if (!layer) return;
    const d = document.createElement('div');
    d.className = 'fx-float' + (big ? ' big' : '');
    d.textContent = text;
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    if (color) d.style.color = color;
    layer.appendChild(d);
    setTimeout(()=>d.remove(), big ? 1500 : 1000);
  },

  // 以某个元素为锚点漂浮文字（元素不可见/不存在时自动跳过）
  floatAtEl(el, text, color, big){
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    this.float(r.left + r.width/2, r.top + r.height*0.35, text, color, big);
  },

  // 粒子爆开（Boss 击杀、升级等）
  burst(x, y, emoji, count){
    const layer = this.ensureLayer();
    if (!layer) return;
    const n = count || 8;
    for (let i=0; i<n; i++){
      const p = document.createElement('div');
      p.className = 'fx-particle';
      p.textContent = emoji || '✨';
      const a = Math.random()*Math.PI*2, dist = 30 + Math.random()*45;
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.setProperty('--dx', (Math.cos(a)*dist).toFixed(1) + 'px');
      p.style.setProperty('--dy', (Math.sin(a)*dist).toFixed(1) + 'px');
      layer.appendChild(p);
      setTimeout(()=>p.remove(), 750);
    }
  },

  burstAtEl(el, emoji, count){
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return;
    this.burst(r.left + r.width/2, r.top + r.height/2, emoji, count);
  },

  // 震动（受击）
  shake(el){
    if (!el || !el.classList) return;
    el.classList.remove('shake');
    void el.offsetWidth; // 强制重排以重启动画
    el.classList.add('shake');
    setTimeout(()=>el.classList.remove('shake'), 400);
  },

  // 红白闪光（受击）
  flash(el){
    if (!el || !el.classList) return;
    el.classList.remove('hitflash');
    void el.offsetWidth;
    el.classList.add('hitflash');
    setTimeout(()=>el.classList.remove('hitflash'), 320);
  },

  // 弹跳（获得物品/升级）
  pop(el){
    if (!el || !el.classList) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(()=>el.classList.remove('pop'), 350);
  }
};

if (typeof window !== 'undefined') window.FX = FX;
