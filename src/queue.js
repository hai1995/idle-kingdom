// ===== 行动队列：多任务顺序执行 + 兜底动作 =====
// 玩家可把若干「采集 / 制作」任务排入队列，角色按顺序自动执行；
// 队列为空、或所有任务都被阻塞（等级不足 / 原料不足）时，自动切换到玩家设定的「兜底动作」。

// ---------- 行动类型 ----------
// mode: gather = 采集类（按产出数量计数）| recipe = 制作类（按制作次数计数）
const ActionKinds = {
  chop:        { skill:'woodcutting',  label:'伐木', icon:'🪓', mode:'gather' },
  mine:        { skill:'mining',       label:'挖矿', icon:'⛏️', mode:'gather' },
  fish:        { skill:'fishing',      label:'钓鱼', icon:'🎣', mode:'gather' },
  smith:       { skill:'smithing',     label:'锻造', icon:'🔥', mode:'recipe' },
  craft:       { skill:'crafting',     label:'制造', icon:'🔨', mode:'recipe' },
  fletch:      { skill:'fletching',    label:'弓弩', icon:'🏹', mode:'recipe' },
  cook:        { skill:'cooking',      label:'烹饪', icon:'🍳', mode:'recipe' },
  runecrafting:{ skill:'runecrafting', label:'符文', icon:'🔮', mode:'recipe' },
  herblore:    { skill:'herblore',     label:'炼药', icon:'🧪', mode:'recipe' },
};
const QUEUE_MAX = 10;                 // 队列任务数上限
const FALLBACK_IDLE = { kind:'idle', target:'', qty:1 };   // 兜底 = 空闲

// ---------- 目标列表 ----------
function actionTargets(kind){
  const def = ActionKinds[kind];
  if (!def) return [];
  if (def.mode === 'gather'){
    const pool = {
      chop: (window.WoodcuttingTrees||[]),
      mine: (window.MiningOres||[]),
      fish: (window.FishingSpots||[]),
    }[kind] || [];
    return pool.map(id=>{
      const it = Items[id];
      if (!it) return null;
      return { id, name:it.name, icon:it.icon, lvl:it.lvl||1 };
    }).filter(Boolean);
  }
  return Recipes.filter(r=>r.type===kind).map(r=>{
    const it = Items[r.out];
    return { id:r.out, name:(it?it.name:r.out), icon:(it?it.icon:'📦'), lvl:r.lvl||1, per:r.qty||1 };
  }).filter(Boolean);
}

// ---------- 任务对象 ----------
let queueSeq = 1;
function makeQueueEntry(kind, target, qty){
  return {
    id: 'q' + Date.now().toString(36) + '_' + (queueSeq++),
    kind, target,
    qty: Math.max(1, Math.floor(qty)||1),
    done: 0,
    completed: 0,
  };
}
function entryDef(e){ return e ? ActionKinds[e.kind] : null; }
// 任务显示名：伐木·普通原木
function entryLabel(e){
  const def = entryDef(e);
  const it = Items[e.target];
  const name = it ? it.name : e.target;
  return `${def?def.icon:'❓'}${def?def.label:'行动'}·${name}`;
}
// 任务单位：采集=个，制作=次
function entryUnit(e){
  const def = entryDef(e);
  return (def && def.mode==='recipe') ? '次' : '个';
}
function entryProgressText(e){
  return `${e.done||0}/${e.qty} ${entryUnit(e)}`;
}

// ---------- 可执行性 ----------
function entryCanRun(e){
  if (!e) return { ok:false, reason:'空任务' };
  const def = entryDef(e);
  if (!def) return { ok:false, reason:'未知行动' };
  if (def.mode === 'gather'){
    const it = Items[e.target];
    if (!it) return { ok:false, reason:'目标不存在' };
    if (levelOf(def.skill) < (it.lvl||1)) return { ok:false, reason:`${def.label} ${it.lvl} 级` };
    return { ok:true, reason:'' };
  }
  const rec = Recipes.find(r=>r.type===e.kind && r.out===e.target);
  if (!rec) return { ok:false, reason:'配方不存在' };
  if (levelOf(def.skill) < (rec.lvl||1)) return { ok:false, reason:`${def.label} ${rec.lvl} 级` };
  if (!canAfford(rec.cost)) return { ok:false, reason:'原料不足' };
  return { ok:true, reason:'' };
}

// ---------- 与当前活动的同步 ----------
function entryMatchesActivity(e){
  const a = Game.activity;
  if (!a || !e) return false;
  const def = entryDef(e);
  if (!def) return false;
  if (def.mode === 'gather') return a.kind === e.kind && a.itemId === e.target;
  return a.kind === e.kind && !!(a.recipe) && a.recipe.out === e.target;
}
function startEntryActivity(e, src){
  const def = entryDef(e);
  if (!def) return false;
  if (def.mode === 'gather'){
    const it = Items[e.target];
    if (!it) return false;
    activityProgress = 0;
    Game.activity = { kind:e.kind, itemId:e.target, src: src||'queue' };
  } else {
    const rec = Recipes.find(r=>r.type===e.kind && r.out===e.target);
    if (!rec) return false;
    activityProgress = 0;
    Game.activity = { kind:e.kind, recipe:rec, src: src||'queue' };
  }
  return true;
}

// ---------- 兜底动作 ----------
function fallbackEntry(){
  const fb = Game.fallback;
  if (!fb || fb.kind === 'idle') return null;
  return { id:'__fallback', kind:fb.kind, target:fb.target, qty:Math.max(1, fb.qty||1), done:0 };
}
function applyFallback(){
  const fb = fallbackEntry();
  if (!fb){ stopActivity(); return; }
  if (!entryCanRun(fb).ok){ stopActivity(); return; }
  if (!entryMatchesActivity(fb) || (Game.activity && Game.activity.src !== 'fallback')){
    startEntryActivity(fb, 'fallback');
  }
}

// ---------- 队列控制 ----------
function startQueue(){
  if (Game.queueIdx >= Game.queue.length) Game.queueIdx = 0;
  Game.queueRunning = true;
  ensureQueueActivity();
  if (UI && UI.toast){
    UI.toast(Game.queue.length ? '▶ 任务队列已启动' : '▶ 已启动（无任务，执行兜底动作）');
  }
  log('▶ 任务队列启动', 'good');
  saveGame();
  return true;
}
function pauseQueue(reason){
  if (!Game.queueRunning) return false;
  Game.queueRunning = false;
  if (UI && UI.toast) UI.toast(`⏸ 任务队列已暂停${reason?`（${reason}）`:''}`);
  log('⏸ 任务队列已暂停', 'gold');
  saveGame();
  return true;
}
function toggleQueue(){
  return Game.queueRunning ? (pauseQueue(), false) : startQueue();
}
function addQueueEntry(kind, target, qty){
  if (Game.queue.length >= QUEUE_MAX){
    if (UI && UI.toast) UI.toast(`队列最多 ${QUEUE_MAX} 个任务`);
    return null;
  }
  const e = makeQueueEntry(kind, target, qty);
  Game.queue.push(e);
  saveGame();
  return e;
}
function removeQueueEntry(id){
  const i = Game.queue.findIndex(e=>e.id===id);
  if (i < 0) return false;
  Game.queue.splice(i,1);
  if (Game.queueIdx >= Game.queue.length) Game.queueIdx = Math.max(0, Game.queue.length-1);
  saveGame();
  return true;
}
function moveQueueEntry(id, dir){
  const i = Game.queue.findIndex(e=>e.id===id);
  if (i < 0) return false;
  const j = i + dir;
  if (j < 0 || j >= Game.queue.length) return false;
  const tmp = Game.queue[i];
  Game.queue[i] = Game.queue[j];
  Game.queue[j] = tmp;
  if (Game.queueIdx === i) Game.queueIdx = j;
  else if (Game.queueIdx === j) Game.queueIdx = i;
  saveGame();
  return true;
}
function clearQueue(){
  Game.queue = [];
  Game.queueIdx = 0;
  Game.queueRunning = false;
  saveGame();
}
function setFallback(kind, target, qty){
  if (!kind || kind === 'idle'){
    Game.fallback = { kind:'idle', target:'', qty:1 };
  } else {
    Game.fallback = { kind, target, qty:Math.max(1, qty||1) };
  }
  saveGame();
  return Game.fallback;
}

// ---------- 主驱动（由 gameLoop 调用） ----------
function ensureQueueActivity(){
  if (!Game.queueRunning) return;
  if (Game.combat) return;              // 战斗中不抢占行动
  const list = Game.queue;
  if (!list.length){ applyFallback(); return; }
  let guard = 0;
  while (guard++ <= list.length + 1){
    const e = list[Game.queueIdx];
    if (!e){ applyFallback(); return; }
    if (entryCanRun(e).ok){
      if (!entryMatchesActivity(e) || (Game.activity && Game.activity.src !== 'queue')){
        startEntryActivity(e, 'queue');
      }
      return;
    }
    // 当前任务被阻塞 → 顺延到下一个可执行任务
    const next = (Game.queueIdx + 1) % list.length;
    if (next === Game.queueIdx){ applyFallback(); return; }   // 全部阻塞 → 兜底
    if (!Game.queueLoop && next === 0){
      Game.queueIdx = 0;
      Game.queueRound++;
      Game.queueRunning = false;
      applyFallback();
      return;
    }
    Game.queueIdx = next;
    if (next === 0) Game.queueRound++;
  }
  applyFallback();
}

// ---------- 任务进度（由 performAction 调用） ----------
function queueOnActionDone(a, gained){
  if (!Game.queueRunning) return;
  if (!Game.activity || Game.activity.src !== 'queue') return;
  const e = Game.queue[Game.queueIdx];
  if (!e || a.kind !== e.kind) return;
  const def = entryDef(e);
  if (!def) return;
  if (def.mode === 'recipe'){
    // 制作类：按「制作次数」计数
    if (!a.recipe || a.recipe.out !== e.target) return;
    e.done = (e.done||0) + 1;
  } else {
    // 采集类：按产出数量计数
    if (a.itemId !== e.target) return;
    e.done = (e.done||0) + Math.max(0, gained||0);
  }
  if (e.done >= e.qty) onQueueEntryDone(e);
}

// 任务达成 → 推进到下一项
function onQueueEntryDone(e){
  const list = Game.queue;
  const idx = list.indexOf(e);
  if (idx >= 0) Game.queueIdx = idx;
  e.done = 0;
  e.completed = (e.completed||0) + 1;
  if (UI && UI.toast) UI.toast(`✅ 任务完成：${entryLabel(e)}`);
  log(`✅ 任务完成：${entryLabel(e)}`, 'good');
  const isLast = (Game.queueIdx + 1) >= list.length;
  if (isLast){
    Game.queueRound++;
    Game.queueIdx = 0;
    if (!Game.queueLoop){
      // 单轮模式：跑完一轮后转入兜底动作
      Game.queueRunning = false;
      applyFallback();
      saveGame();
      return;
    }
  } else {
    Game.queueIdx++;
  }
  ensureQueueActivity();
  saveGame();
}

// ---------- 导出 ----------
if (typeof window !== 'undefined'){
  window.ActionKinds = ActionKinds;
  window.QUEUE_MAX = QUEUE_MAX;
  window.actionTargets = actionTargets;
  window.makeQueueEntry = makeQueueEntry;
  window.entryDef = entryDef;
  window.entryLabel = entryLabel;
  window.entryUnit = entryUnit;
  window.entryProgressText = entryProgressText;
  window.entryCanRun = entryCanRun;
  window.startQueue = startQueue;
  window.pauseQueue = pauseQueue;
  window.toggleQueue = toggleQueue;
  window.addQueueEntry = addQueueEntry;
  window.removeQueueEntry = removeQueueEntry;
  window.moveQueueEntry = moveQueueEntry;
  window.clearQueue = clearQueue;
  window.setFallback = setFallback;
  window.fallbackEntry = fallbackEntry;
  window.ensureQueueActivity = ensureQueueActivity;
  window.queueOnActionDone = queueOnActionDone;
  window.queueOnActionDoneRef = queueOnActionDone;
}
