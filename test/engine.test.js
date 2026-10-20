// 无 DOM 引擎冒烟测试：验证资源-加工-战斗闭环可玩
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// ---- 轻量 shim ----
class LocalStorageStub {
  constructor(){ this.store = {}; }
  getItem(k){ return this.store[k] || null; }
  setItem(k,v){ this.store[k] = String(v); }
  removeItem(k){ delete this.store[k]; }
}
const document = {
  getElementById: () => ({ textContent:'', innerHTML:'', classList:{ add(){}, remove(){}, }, appendChild(){}, addEventListener(){}, style:{} }),
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => ({ className:'', textContent:'', style:{}, remove(){}, }),
  addEventListener(){},   // 键盘导航等 document 级监听
};
const UIstub = {
  log(){}, toast(){}, floatText(){}, levelUp(){}, flashSkill(){},
  refreshActivity(){}, refreshGear(){}, refreshInventory(){}, startCombat(){},
  hit(){}, actionFeedback(){}, coinFloat(){}, lootFloat(){}, bossKillFx(){},
  deathFloat(){}, cropGrown(){}, tickProgress(){},
};
const window = { location:{href:'x'}, localStorage: new LocalStorageStub() };
const context = {
  window, document, localStorage: window.localStorage,
  console, Math, Date, JSON, setInterval:()=>0, setTimeout:()=>0, clearInterval:()=>{},
  getComputedStyle: ()=>({}),
  UI: UIstub, document_ : document,
};
context.window.UI = UIstub;
vm.createContext(context);

const base = path.join(__dirname, '..', 'src');
function loadJS(file){ vm.runInContext(fs.readFileSync(path.join(base, file), 'utf8'), context, {filename:file}); }

['gameData.js','engine.js','game.js','queue.js','interact.js','fx.js'].forEach(loadJS);

// 手动暴露 engine 内部函数（engine 未挂 window 的再补）
const G = context;
const ST = context.window;  // ST 上挂 Game / Items / 工具函数等

// 从默认存档开始
G.resetToDefault();

function assert(cond, msg){ if(!cond){ console.error('FAIL: '+msg); process.exitCode=1; } else console.log('PASS: '+msg); }

// ---- 1. 伐木 ----
G.startActivity('chop','normal_log');
// 手动调用 performAction 几次
G.performAction(ST.Game.activity);
G.performAction(ST.Game.activity);
assert(ST.totalOf('normal_log') >= 5, '伐木获得原木 (开始有5) -> '+ST.totalOf('normal_log'));
assert(ST.levelOf('woodcutting') == 1 || ST.Game.skills.woodcutting.xp>0, '伐木获得经验');

// ---- 2. 挖矿 + 锻造铁锭 ----
G.startActivity('mine','copper_ore');
G.performAction(ST.Game.activity);
// 给足矿物
ST.giveItem('copper_ore', 5,false); ST.giveItem('tin_ore', 5,false);
ST.giveItem('iron_ore', 3,false); ST.giveItem('coal_ore', 3,false);
const ironBarRecipe = ST.Recipes.find(r=>r.out==='iron_bar');
ST.processRecipe(ironBarRecipe, 1);
assert(ST.totalOf('iron_bar') >= 1, '锻造出铁锭 -> '+ST.totalOf('iron_bar'));

// ---- 3. 烹饪 + 自动进食原料 ----
ST.giveItem('raw_shrimp',4,false);
const shrimpRecipe = ST.Recipes.find(r=>r.out==='shrimp');
ST.processRecipe(shrimpRecipe, 3);
assert(ST.totalOf('shrimp') >= 3, '烤熟 3 只虾 -> '+ST.totalOf('shrimp'));

// ---- 4. 战斗闭环 ----
// 装备青铜剑
ST.giveItem('bronze_sword',1,false);
G.equipItem('bronze_sword');
// 装备铁甲
ST.giveItem('copper_bar',2,false);
const bodyRecipe = ST.Recipes.find(r=>r.out==='bronze_body');
G.processRecipe(bodyRecipe, 1);
G.startCombat('goblin');
// 模拟战斗 tick
let guard=0;
ST.Game.combat.playerHp = G.playerMaxHp();
for(let i=0;i<200 && ST.Game.combat; i++){
  G.combatTick(0.3);
  if(guard++>200) break;
}
if(ST.Game.combat===null || ST.Game.stats.kills>0){
  assert(true, '战斗进行并结算 (kills='+ST.Game.stats.kills+')');
} else {
  assert(false, '战斗未结算');
}

// ---- 5. 等级提升 ----
G.gainXp('combat', 500);
assert(G.levelOf('combat') >= 1, '战斗等级可提升 level='+G.levelOf('combat'));

// ---- 6. 存档/读档 ----
G.saveGame();
const saved = context.localStorage.getItem('melvor_idle_save_v1');
assert(saved && saved.length>0, '存档写入 localStorage，长度='+(saved? saved.length:0));

// ---- 7. UI 渲染全页面冒烟（不抛异常即可） ----
loadJS('ui.js');
// 增强 document stub 以支撑渲染用 querySelectorAll(具体选择器)
const renderTargets = {};
const mkTarget = ()=>({ innerHTML:'', dataset:{}, style:{}, classList:{ add(){}, remove(){}, toggle(){} } });
['content','skills','combat','bank','inventory','equipment','farming','stats','log','shop','queue','fightArea','modalBox'].forEach(t=>renderTargets[t]=mkTarget());
context.document.getElementById = (id)=> renderTargets[id] || {
  textContent:'', innerHTML:'', classList:{add(){},remove(){},toggle(){}}, style:{}, appendChild(){},
  addEventListener(){}, querySelector:()=>null, querySelectorAll:()=>[], value:'', checked:false,
};
context.document.query_html_app = {};
try{
  const uiFns = ['renderSkills','renderCombat','renderBank','renderInventory','renderEquipment','renderShop','renderQueue','renderFarming','renderStats','renderLog'];
  for (const fn of uiFns){
    const f = context.window[fn] || context[fn];
    f && f();
  }
  console.log('PASS: 全部 8 个 UI 页面渲染无异常');
  // 再跑活动切换 + 战斗选区
  G.startActivity('chop','oak_log');
  context.window.UI.refreshActivity && context.window.UI.refreshActivity();
  context.window.currentActivityLabel();
  G.startCombat('goblin');
  context.window.UI.refreshActivity && context.window.UI.refreshActivity();
  console.log('PASS: 活动切换与状态栏刷新无异常');
}catch(e){
  console.error('FAIL: '+e.message);
  console.error(e.stack);
  process.exitCode = 1;
}

// ---- 8. 更多技能闭环：钓鱼 / 农牧 / 弓弩 / 符文 / 远程战斗 ----
try{
  // 钓鱼
  G.startActivity('fish','raw_shrimp');
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('raw_shrimp')>=1 || ST.Game.skills.fishing.xp>0, '钓鱼产出 raw_shrimp 或获得经验 -> '+ST.totalOf('raw_shrimp'));

  // 农牧：种植并催熟
  ST.giveItem('crop_potato',0,false);
  ST.giveItem('seed_potato',2,false);
  G.plantAt(0,'seed_potato');
  assert(ST.Game.farms['farm0'] && ST.Game.farms['farm0'].seedId==='seed_potato','种植土豆到第1块地');
  G.farmTick(999); // 直接催熟
  assert(ST.totalOf('crop_potato')>=1, '收获土豆 -> '+ST.totalOf('crop_potato'));

  // 弓弩：造箭杆+箭
  ST.giveItem('normal_log',10,false);
  const shaftRecipe = ST.Recipes.find(r=>r.out==='arrow_shaft');
  G.processRecipe(shaftRecipe,1);
  const arrowRecipe = ST.Recipes.find(r=>r.out==='arrow_bronze');
  G.processRecipe(arrowRecipe,1);
  assert(ST.totalOf('arrow_bronze')>=2, '制造青铜箭 -> '+ST.totalOf('arrow_bronze'));

  // 符文
  ST.giveItem('essense',5,false);
  const airRecipe = ST.Recipes.find(r=>r.out==='air_rune');
  G.processRecipe(airRecipe,2);
  assert(ST.totalOf('air_rune')>=4, '制作气符文 -> '+ST.totalOf('air_rune'));

  // 远程战斗：装备弓+箭
  ST.giveItem('shortbow',1,false); ST.giveItem('arrow_bronze',5,false);
  G.equipItem('shortbow');
  G.equipItem('arrow_bronze');
  assert(ST.Game.gear.bow && ST.Game.gear.bow.ranged, '弓已装备到 bow 槽');
  G.startCombat('goblin');
  let g2=0; ST.Game.combat.playerHp = G.playerMaxHp();
  while(ST.Game.combat && g2<200){ G.combatTick(0.3); g2++; }
  assert(ST.Game.combat===null || ST.Game.stats.kills>0, '远程战斗可进行 (kills='+ST.Game.stats.kills+')');

  // 自动装备
  ST.giveItem('iron_sword',1,false);
  G.startCombat('goblin'); // 已有战斗
  assert(true, '自动装备路径可调用（未强制断言带货）');

  console.log('PASS: 钓鱼/农牧/弓弩/符文/远程战斗闭环通过');
}catch(e){
  console.error('FAIL: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 8.5 商店：买入 / 卖出金币 ----
try{
  const coins0 = ST.Game.coins;
  G.buyItem('health_pot', 90, 3);
  assert(ST.Game.coins === coins0-90, '购买治疗药水扣除金币 '+coins0+'->'+ST.Game.coins);
  assert(ST.totalOf('health_pot')>=3, '治疗药水入库');
  const logsBefore = ST.totalOf('normal_log');
  ST.giveItem('normal_log', 15, false); // 加素材
  G.sellAll('normal_log');
  // 普通原木 value=2，应全卖
  const soldVal = 2 * (logsBefore + 15);
  assert(ST.Game.coins >= coins0-90 + soldVal-2, '卖出原木后金币增加，当前='+ST.Game.coins);
  console.log('PASS: 商店买入/卖出金币闭环通过');
}catch(e){
  console.error('FAIL: 商店: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 9. init() 冒烟（页面对接路径） ----
try{
  context.init && context.init();
  console.log('PASS: init() 启动流程无异常');
}catch(e){
  console.error('FAIL: init(): '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 10. 扩充内容：炼药 / 药水buff / Boss / 里程碑 / 珠宝 / 自动购工具 ----
try{
  // 10a. 炼药：种草 -> 收获草本 -> 炼药
  ST.giveItem('herb_guam',3,false); ST.giveItem('eye_of_newt',3,false); ST.giveItem('vial_water',3,false);
  const atkPotRecipe = ST.Recipes.find(r=>r.out==='potion_attack');
  assert(atkPotRecipe && atkPotRecipe.type==='herblore', '炼药配方存在');
  G.processRecipe(atkPotRecipe, 2);
  assert(ST.totalOf('potion_attack')>=2, '炼出攻击药剂 -> '+ST.totalOf('potion_attack'));
  assert(ST.Game.skills.herblore.xp>0, '炼药获得经验');

  // 10b. 饮用药水 -> buff 生效并提升伤害
  const dmgBefore = G.playerDamageRange().hi;
  G.drinkPotion('potion_attack');
  assert(ST.Game.buff && ST.Game.buff.kind==='dmg', '饮用后 buff 生效 kind='+ (ST.Game.buff&&ST.Game.buff.kind));
  const dmgAfter = G.playerDamageRange().hi;
  assert(dmgAfter > dmgBefore, `攻击药剂提升伤害 ${dmgBefore} -> ${dmgAfter}`);
  // buff 计时衰减
  G.tickBuffs(999);
  assert(ST.Game.buff===null, 'buff 到时后清除');

  // 10c. Boss 门槛：低战斗等级无法挑战
  ST.Game.combat = null;
  const lowLvl = ST.Game.skills.combat.level;
  ST.Game.skills.combat.level = 1; // 压低等级
  const r1 = G.startCombat('guard_titan'); // needLvl 30
  assert(ST.Game.combat===null, '低等级无法挑战守护巨灵（被拦截）');
  ST.Game.skills.combat.level = 35; // 恢复/提升
  G.startCombat('guard_titan');
  assert(ST.Game.combat && ST.Game.combat.monsterId==='guard_titan', '达到等级可挑战守护巨灵');
  // 模拟击败 Boss
  let g3=0; ST.Game.combat.playerHp = 99999;
  ST.Game.combat.monsterHp = 1; // 直接打到残血
  const bossKillsBefore = ST.Game.stats.bossKills;
  const coinsBefore = ST.Game.coins;
  while(ST.Game.combat && g3<50){ G.combatTick(0.3); g3++; }
  assert(ST.Game.stats.bossKills === bossKillsBefore+1, 'Boss 击杀计数 +1');
  assert(ST.Game.coins > coinsBefore, `击败 Boss 获得金币 ${coinsBefore} -> ${ST.Game.coins}`);
  assert(ST.Game.combat===null, 'Boss 战后不自动连战');

  // 10d. 里程碑：击杀数解锁
  ST.Game.stats.kills = 60;
  const mu = G.milestonesUnlocked();
  assert(mu.kills_10 && mu.kills_50, '里程碑按击杀数解锁 (kills_10/kills_50)');
  assert(G.milestoneCount() >= 2, 'milestoneCount >= 2 -> '+G.milestoneCount());
  assert(G.xpMult() > 1, '里程碑提供经验加成 xpMult='+G.xpMult().toFixed(3));

  // 10e. 珠宝：指环/护符装备与自动装备（指环按攻击、护符按防御等级解锁）
  ST.Game.skills.attack.level = 60;
  ST.Game.skills.defence.level = 60;
  ST.giveItem('ring_bronze',1,false); ST.giveItem('amulet_topaz',1,false);
  G.equipItem('ring_bronze');
  assert(ST.Game.gear.ring && ST.Game.gear.ring.dmg===1, '指环装备到 ring 槽');
  G.equipItem('amulet_topaz');
  assert(ST.Game.gear.amulet && ST.Game.gear.amulet.xpBonus>0, '护符装备到 amulet 槽');
  const dmgWithRing = G.playerDamageRange().hi;
  assert(dmgWithRing >= 1, '指环提供伤害加成');

  // 10f. 自动购买工具：给足金币和高等级，开启开关
  ST.Game.coins = 20000;
  ST.Game.skills.woodcutting.level = 50;
  ST.Game.skills.mining.level = 50;
  ST.Game.gear.axe = null; ST.Game.gear.pickaxe = null;
  ST.Game.auto_buy_tools = true;
  G.autoBuyTools();
  assert(ST.Game.gear.axe && ST.Game.gear.axe.axePower>=40, '自动购买并装备符文斧 -> '+(ST.Game.gear.axe&&ST.Game.gear.axe.name));
  assert(ST.Game.gear.pickaxe && ST.Game.gear.pickaxe.pickPower>=40, '自动购买并装备符文镐 -> '+(ST.Game.gear.pickaxe&&ST.Game.gear.pickaxe.name));
  ST.Game.auto_buy_tools = false;

  console.log('PASS: 炼药/药水buff/Boss/里程碑/珠宝/自动购工具 闭环通过');
}catch(e){
  console.error('FAIL: 扩充内容: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 11. 修复验证：炼药活动 / 仓储交互 / 箭矢消耗 / 近战回退 / 战斗进食 / 经验倍率 / 离线农牧 ----
try{
  // 11a. 炼药活动可通过 performAction 驱动（修复 herblore 活动无产出）
  ST.Game.skills.herblore.level = 20;
  ST.giveItem('herb_guam',3,false); ST.giveItem('eye_of_newt',3,false); ST.giveItem('vial_water',3,false);
  const potRec = ST.Recipes.find(r=>r.out==='potion_attack');
  const potsBefore = ST.totalOf('potion_attack');
  G.startRecipeActivity('herblore', potRec);
  assert(ST.Game.activity && ST.Game.activity.kind==='herblore', '炼药活动可开始');
  assert(G.currentActionInterval()===2, '炼药动作间隔为 2s -> '+G.currentActionInterval());
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('potion_attack') >= potsBefore+1, '炼药活动产出药剂 -> '+ST.totalOf('potion_attack'));

  // 11b. 背包/仓库：丢弃、双向移动（修复丢弃崩溃与仓库单向）
  ST.giveItem('normal_log', 5, false);
  G.dropItem('inv','normal_log');
  assert((ST.Game.inventory['normal_log']||0)===0, '丢弃背包物品生效');
  ST.giveItem('normal_log', 5, false);
  G.moveItem('normal_log','toBank');
  assert((ST.Game.banking['normal_log']||0)===5 && (ST.Game.inventory['normal_log']||0)===0, '背包→仓库移动');
  G.moveItem('normal_log','toInv');
  assert((ST.Game.inventory['normal_log']||0)===5 && (ST.Game.banking['normal_log']||0)===0, '仓库→背包移动');

  // 11c. 远程战斗消耗箭矢
  ST.giveItem('shortbow',1,false); ST.giveItem('arrow_bronze',5,false);
  G.equipItem('shortbow'); G.equipItem('arrow_bronze');
  const arrows0 = ST.totalOf('arrow_bronze');
  G.startCombat('goblin');
  assert(ST.Game.combat && ST.Game.combat.style==='ranged', '远程战斗风格');
  let g4=0; ST.Game.combat.playerHp = G.playerMaxHp();
  while(ST.Game.combat && g4<200){ G.combatTick(0.3); g4++; }
  assert(ST.totalOf('arrow_bronze') < arrows0, `箭矢被消耗 ${arrows0} -> ${ST.totalOf('arrow_bronze')}`);

  // 11d. 箭矢耗尽自动切换近战；无近战武器则拒绝开战
  ST.Game.combat=null; ST.Game.gear.arrow=null; delete ST.Game.inventory['arrow_bronze'];
  ST.giveItem('iron_sword',1,false); G.equipItem('iron_sword');
  G.startCombat('goblin');
  assert(ST.Game.combat && ST.Game.combat.style==='attack', '无箭矢自动切换近战');
  ST.Game.combat=null;
  ST.Game.gear.weapon=null;
  G.startCombat('goblin');
  assert(ST.Game.combat===null, '无箭矢且无近战武器时拒绝开战');

  // 11e. 战斗中进食回复生命
  ST.giveItem('shrimp',2,false);
  ST.giveItem('bronze_sword',1,false); G.equipItem('bronze_sword');
  G.startCombat('goblin');
  ST.Game.combat.playerHp = 5;
  const hpBefore = ST.Game.combat.playerHp;
  G.eatItem('shrimp');
  assert(ST.Game.combat.playerHp > hpBefore, `战斗中进食回血 ${hpBefore} -> ${ST.Game.combat.playerHp}`);
  ST.Game.combat=null;

  // 11f. 经验倍率生效（修复 xpMult 从未被应用）
  ST.Game.stats.kills = 100;
  const mult = G.xpMult();
  assert(mult > 1, '里程碑提供经验倍率 -> '+mult.toFixed(3));
  const xp0 = ST.Game.skills.mining.xp;
  G.gainXp('mining', 100);
  assert(ST.Game.skills.mining.xp - xp0 > 100, `经验倍率已应用 ${xp0} -> ${ST.Game.skills.mining.xp}`);

  // 11g. 离线作物生长收获（farmCatchUp）
  ST.giveItem('seed_potato',2,false);
  G.plantAt(2,'seed_potato');
  assert(ST.Game.farms['farm2'], '种植土豆到第3块地');
  const harvestsBefore = ST.Game.stats.harvests||0;
  G.farmCatchUp(9999);
  assert(!ST.Game.farms['farm2'], '离线追赶后作物收获');
  assert((ST.Game.stats.harvests||0) > harvestsBefore, '收获计入统计 -> '+ST.Game.stats.harvests);

  // 11h. 自动装备更好的箭矢
  ST.Game.gear.arrow = null;
  ST.giveItem('arrow_iron',5,false);
  G.maybeAutoEquip();
  assert(ST.Game.gear.arrow && ST.Game.gear.arrow.dmg>=3, '自动装备更好的箭矢 -> '+(ST.Game.gear.arrow&&ST.Game.gear.arrow.name));

  // 11i. 战斗中死亡只计数一次（修复双倍死亡）
  const deathsBefore = ST.Game.stats.deaths;
  ST.Game.gear.weapon = null; ST.Game.gear.bow = null; ST.Game.gear.arrow = null;
  ST.giveItem('bronze_sword',1,false); G.equipItem('bronze_sword');
  G.startCombat('dragon'); // 高血量怪：玩家先攻打不死，必被怪物击杀
  assert(!!ST.Game.combat, '可以挑战红龙');
  ST.Game.combat.playerHp = 1; // 残血，怪物一击必杀
  G.combatTick(10);
  assert(ST.Game.combat===null, '玩家死亡后战斗结束');
  assert(ST.Game.stats.deaths === deathsBefore+1, `单次死亡只计数一次 ${deathsBefore} -> ${ST.Game.stats.deaths}`);

  // 11j. 死亡后自动重开：开关默认关闭；开启后死亡会安排重开（setTimeout 在无头环境为 no-op，不真正开战）
  assert(ST.Game.auto_revive === false, '自动重开默认关闭');
  ST.Game.auto_revive = true;
  G.startCombat('dragon');
  assert(!!ST.Game.combat, '自动重开测试可挑战红龙');
  ST.Game.combat.playerHp = 1;
  G.combatTick(10);
  assert(ST.Game.combat===null, '开启自动重开后死亡仍立即结束当前战斗');
  assert(ST.Game.stats.deaths === deathsBefore+2, '自动重开不吞死亡计数 -> '+ST.Game.stats.deaths);
  ST.Game.auto_revive = false;
  // 存档往返：auto_revive 持久化
  ST.Game.auto_revive = false;
  G.saveGame();
  ST.Game.auto_revive = true;   // 弄脏后再读档，验证从存档恢复
  G.loadGame();
  assert(ST.Game.auto_revive === false, 'auto_revive 存档往返正确');

  console.log('PASS: 修复验证（炼药活动/仓储交互/箭矢消耗/近战回退/战斗进食/经验倍率/离线农牧/自动装箭/单次死亡）');
}catch(e){
  console.error('FAIL: 修复验证: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 12. 动效反馈：钩子在无头环境下安全降级且不抛异常 ----
try{
  // 12a. FX 层可用且在无 DOM 时静默降级
  assert(typeof ST.FX === 'object' && ST.FX !== null, 'FX 动效层已加载');
  ST.FX.float(0, 0, 'test'); ST.FX.floatAtEl(null, 'x'); ST.FX.burst(0,0,'✨',4);
  ST.FX.shake(null); ST.FX.flash(null); ST.FX.pop(null);
  assert(true, 'FX 在无头环境下静默降级不抛异常');

  // 12b. 战斗全流程动效钩子（浮动数字/震屏/闪光/战利品/Boss 粒子/败北）
  ST.Game.gear.weapon = null; ST.Game.gear.bow = null; ST.Game.gear.arrow = null;
  ST.giveItem('bronze_sword',1,false); G.equipItem('bronze_sword');
  const killsBefore12 = ST.Game.stats.kills;
  G.startCombat('goblin');
  let g7=0; ST.Game.combat.playerHp = G.playerMaxHp();
  while(ST.Game.combat && g7<200){ G.combatTick(0.3); g7++; }
  assert(ST.Game.stats.kills > killsBefore12, '带动效钩子的战斗闭环正常 (kills='+ST.Game.stats.kills+')');

  // 12c. 战斗区就地刷新与进度条钩子
  G.startCombat('wolf');
  G.updateCombatLive();
  G.startActivity('chop','normal_log');
  context.window.UI.tickProgress();
  assert(true, 'updateCombatLive / tickProgress 可调用');
  assert(G.totalSkillLevel() >= 16, '总等级可计算 -> '+G.totalSkillLevel());

  // 12d. 农牧就地刷新与收获飘字
  ST.giveItem('seed_potato',1,false);
  G.plantAt(1,'seed_potato');
  G.updateFarmingLive();
  G.farmTick(999);
  assert(!ST.Game.farms['farm1'], '农牧就地刷新与收获钩子正常');

  // 12e. 金币飘字（买卖）
  ST.Game.coins = 500;
  ST.giveItem('normal_log',3,false);
  G.sellAll('normal_log');
  G.buyItem('health_pot', 90, 1);
  assert(isFinite(ST.Game.coins), '金币飘字钩子执行后金币有效 -> '+ST.Game.coins);

  console.log('PASS: 动效反馈钩子无头环境冒烟通过');
}catch(e){
  console.error('FAIL: 动效反馈: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 13. 可获得性审计：所有配方原料都必须有产出来源 ----
try{
  // 来源集合：采集目标 + 怪物掉落 + 商店 + 初始背包
  const sources = new Set([
    ...ST.WoodcuttingTrees, ...ST.MiningOres, ...ST.FishingSpots,
    ...Object.values(ST.Monsters).flatMap(m=>(m.loot||[]).map(l=>l[0])),
    ...ST.ShopStock.map(s=>s.itemId),
    ...Object.keys(G.cloneDefaultGame().inventory),
  ]);
  // 农田：种子可得 -> 作物可得
  for (const id in ST.Items){
    const it = ST.Items[id];
    if (it.type==='seed' && it.crop && sources.has(id)) sources.add(it.crop);
  }
  // 配方闭包：原料齐备即可制作，产出再作为其它配方的原料
  let grew = true;
  while (grew){
    grew = false;
    for (const r of ST.Recipes){
      if (sources.has(r.out)) continue;
      if (r.cost.every(([id])=>sources.has(id))){ sources.add(r.out); grew = true; }
    }
  }
  const missing = [];
  for (const r of ST.Recipes){
    for (const [id] of r.cost){
      if (!sources.has(id) && !missing.includes(id)) missing.push(id);
    }
  }
  assert(missing.length===0, '所有配方原料均有产出来源' + (missing.length?`，缺失: ${missing.map(i=>ST.Items[i].name).join('、')}`:''));

  // 锡矿石可挖取（修复青铜锭阻断）
  assert(ST.MiningOres.includes('tin_ore'), '锡矿石在挖矿目标列表中');
  G.startActivity('mine','tin_ore');
  const tinBefore = ST.totalOf('tin_ore');
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('tin_ore') > tinBefore, '挖矿可获得锡矿石 -> '+ST.totalOf('tin_ore'));

  // 青铜锭闭环：铜+锡 -> 青铜锭 -> 青铜剑
  ST.giveItem('copper_ore',2,false); ST.giveItem('tin_ore',2,false);
  const bronzeBarRec = ST.Recipes.find(r=>r.out==='bronze_bar');
  G.processRecipe(bronzeBarRec, 1);
  assert(ST.totalOf('bronze_bar') >= 1, '青铜锭可炼制 -> '+ST.totalOf('bronze_bar'));
  const swordRec = ST.Recipes.find(r=>r.out==='bronze_sword');
  G.processRecipe(swordRec, 1);
  assert(ST.totalOf('bronze_sword') >= 1, '青铜剑可锻造 -> '+ST.totalOf('bronze_sword'));

  // 炼药材料：商店可买清水瓶与草籽，种植可得草药
  assert(ST.ShopStock.some(s=>s.itemId==='vial_water'), '商店出售清水瓶');
  assert(ST.ShopStock.some(s=>s.itemId==='seed_marrentill'), '商店出售马伦草籽');
  ST.Game.coins = 9999; ST.Game.skills.farming.level = 40;
  G.buyItem('seed_ranarr', 120, 2);
  assert(ST.totalOf('seed_ranarr') >= 2, '可购买瑞纳尔籽 -> '+ST.totalOf('seed_ranarr'));
  G.plantAt(0, 'seed_ranarr');
  assert(ST.Game.farms['farm0'] && ST.Game.farms['farm0'].seedId==='seed_ranarr', '高等级可种植瑞纳尔');
  G.farmTick(999);
  assert(ST.totalOf('herb_ranarr') >= 1, '收获瑞纳尔 -> '+ST.totalOf('herb_ranarr'));
  // 等级不足不能种植高阶种子
  ST.Game.skills.farming.level = 1;
  ST.giveItem('seed_snapdragon',1,false);
  G.plantAt(1, 'seed_snapdragon');
  assert(!ST.Game.farms['farm1'], '农牧等级不足时无法种植龙兰草籽');

  console.log('PASS: 可获得性审计与锡矿/炼药材料闭环通过');
}catch(e){
  console.error('FAIL: 可获得性审计: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 14. 经验曲线与升级进度条（修复 xpForLevel 差一错误） ----
try{
  assert(G.xpForLevel(1) === 0, '1 级起始累计经验为 0 -> '+G.xpForLevel(1));
  assert(G.xpForLevel(2) === 140, '2 级需累计 140 经验 -> '+G.xpForLevel(2));
  assert(G.xpForLevel(3) === 326, '3 级需累计 326 经验 -> '+G.xpForLevel(3));
  // levelFromXp 与 xpForLevel 必须完全一致（同一公式）
  let consistent = true;
  for (const x of [0, 50, 139, 140, 141, 221, 325, 326, 1000, 5000, 50000]){
    const r = G.levelFromXp(x);
    if (G.xpForLevel(r.level) !== r.spent) consistent = false;
  }
  assert(consistent, 'levelFromXp 与 xpForLevel 在所有采样点一致');

  // 截图形状：伐木 221 经验（2 级）-> 本级 81/186，进度约 43.5%
  const g = { level: G.levelFromXp(221).level, xp: 221 };
  const pct = G.xpProgress(g);
  assert(pct > 40 && pct < 47, `进度条百分比合理 -> ${pct.toFixed(1)}%`);
  assert(G.skillXpText(g) === '81 / 186', '技能卡显示本级内经验 -> '+G.skillXpText(g));

  // 边界：0 经验 0%，达到升级线 100%
  assert(G.xpProgress({level:1, xp:0}) === 0, '1 级 0 经验进度 0%');
  assert(G.xpProgress({level:1, xp:140}) === 100, '达到升级线进度 100%');
  assert(G.xpProgress({level:1, xp:999}) === 100, '超界经验钳制到 100%');

  // 接入游戏状态后仍正确
  ST.Game.skills.woodcutting = { level: 2, xp: 221 };
  assert(G.xpProgress(ST.Game.skills.woodcutting) > 40, '游戏状态进度条非空');

  console.log('PASS: 经验曲线与升级进度条验证通过');
}catch(e){
  console.error('FAIL: 经验曲线: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 15. 商店改造：分类分组 / 无套利 / 一键出售 / 交易统计 / 等级门槛 ----
try{
  // 15a. 分类完整性
  const cats = ST.SHOP_CATS || [];
  assert(cats.length > 0, '商店分类表存在 -> '+cats.length+' 类');
  const badCat = ST.ShopStock.filter(s=>!cats.some(c=>c.id===s.cat));
  assert(badCat.length===0, '每件商品都归入有效分类' + (badCat.length?`，异常: ${badCat.map(s=>s.itemId).join('、')}`:''));
  const emptyCat = cats.filter(c=>!ST.ShopStock.some(s=>s.cat===c.id)).map(c=>c.id);
  assert(emptyCat.length===0, '每个分类都有商品' + (emptyCat.length?`，空分类: ${emptyCat.join('、')}`:''));

  // 15b. 套利审计：买入单价必须 >= 回收价（杜绝低买高卖）
  const arbitrage = ST.ShopStock.filter(s=>{
    const it = ST.Items[s.itemId];
    if (!it) return true;
    return s.cost/s.qty < it.value;
  });
  assert(arbitrage.length===0, '商店无低买高卖套利' + (arbitrage.length?`，违规: ${arbitrage.map(s=>`${s.itemId}(${(s.cost/s.qty).toFixed(1)}<${ST.Items[s.itemId].value})`).join('、')}`:''));

  // 15c. 渲染结构：分类分组 + 一键出售 + 每件商品都有购买按钮
  G.renderShop();
  const shopHtml = context.document.getElementById('content').innerHTML;
  assert(shopHtml.includes('shop-group'), '商店按分类分组渲染');
  assert(shopHtml.includes('data-sellall'), '商店提供一键出售全部');
  assert((shopHtml.match(/data-buy=/g)||[]).length === ST.ShopStock.length, '每件商品都有购买按钮 -> '+(shopHtml.match(/data-buy=/g)||[]).length);
  assert(shopHtml.includes('shop-layout'), '商店使用左右分栏布局');

  // 15d. 交易统计与一键出售
  ST.Game.coins = 1000;
  const coinsBefore = ST.Game.coins;
  const spentBefore = ST.Game.stats.spent||0;
  G.buyItem('vial_water', 30, 10, 1);
  assert(ST.Game.coins === coinsBefore-30, '购买扣除金币 '+coinsBefore+'->'+ST.Game.coins);
  assert((ST.Game.stats.purchases||0) > 0, '购买计入交易笔数统计');
  assert((ST.Game.stats.spent||0) === spentBefore+30, '累计消费统计正确 -> '+(ST.Game.stats.spent||0));
  // 一键出售：清空全部可回收物品并结算金币
  ST.giveItem('normal_log', 10, false);
  ST.giveItem('bones', 5, false);
  const expectGain = Object.entries(ST.Game.inventory)
    .filter(([id,qty])=>ST.Items[id]&&ST.Items[id].value&&qty>0&&!ST.Items[id].equip)
    .reduce((sum,[id,qty])=> sum+Math.floor(ST.Items[id].value*qty), 0);
  const sellGain = G.sellAllJunk();
  assert(sellGain === expectGain, `一键出售金额正确 -> ${sellGain}（期望 ${expectGain}）`);
  const leftSellable = Object.entries(ST.Game.inventory).filter(([id,qty])=>ST.Items[id]&&ST.Items[id].value&&qty>0&&!ST.Items[id].equip);
  assert(leftSellable.length===0, '一键出售清空全部可卖物品');
  assert((ST.Game.stats.sold||0) >= sellGain, '累计卖出统计正确 -> '+(ST.Game.stats.sold||0));

  // 15e. 等级门槛：等级不足买不到高阶商品
  ST.Game.skills.farming.level = 1;
  const coins0 = ST.Game.coins;
  G.buyItem('seed_snapdragon', 220, 1, 40);
  assert(ST.Game.coins === coins0, '等级不足时无法购买高阶商品');
  ST.Game.skills.farming.level = 40;
  G.buyItem('seed_snapdragon', 220, 1, 40);
  assert(ST.totalOf('seed_snapdragon') >= 1, '等级达标后可购买 -> '+ST.totalOf('seed_snapdragon'));

  // 15f. 批量购买：×10 / 最大（合并结算）
  ST.Game.skills.herblore.level = 50;
  ST.Game.coins = 1000;
  const vialCost = 30, vialQty = 10;
  G.buyItem('vial_water', vialCost, vialQty, 1, true);   // silent 单次
  assert(ST.Game.coins === 970, 'silent 购买扣除金币但不提示 -> '+ST.Game.coins);
  for (let i=0;i<9 && ST.Game.coins>=vialCost;i++) G.buyItem('vial_water', vialCost, vialQty, 1, true);
  assert(ST.Game.coins === 700, '×10 批量后金币正确 -> '+ST.Game.coins);
  const maxTimes = Math.floor(700/vialCost);
  for (let i=0;i<maxTimes;i++) G.buyItem('vial_water', vialCost, vialQty, 1, true);
  assert(ST.Game.coins === 700 - maxTimes*vialCost, '最大批量按金币买满 -> '+ST.Game.coins);
  assert((ST.Game.stats.purchases||0) >= 10, '批量购买计入交易笔数 -> '+ST.Game.stats.purchases);

  console.log('PASS: 商店改造（分类/无套利/一键出售/交易统计/等级门槛/批量购买）通过');
}catch(e){
  console.error('FAIL: 商店改造: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 16. 功能完善：里程碑提示 / 装备Δ / 一键装备 / 怪物评估 / 离线摘要 / 重置 ----
try{
  // 16a. 里程碑解锁提示只弹一次
  ST.Game.stats.kills = 0;
  const unlockedNow = G.milestonesUnlocked();
  ST.Game.stats.seenMilestones = Object.assign({}, unlockedNow);
  const n1 = G.checkMilestoneToast();
  assert(n1 === 0, '已提示过的里程碑不重复提示');
  ST.Game.stats.kills = 60;
  const n2 = G.checkMilestoneToast();
  assert(n2 >= 2, '新达成里程碑时给出提示 -> '+n2);
  const n3 = G.checkMilestoneToast();
  assert(n3 === 0, '同一里程碑不会重复提示');

  // 16b. 装备属性对比与一键装备更优
  ST.Game.skills.attack.level = 60;
  ST.Game.gear.weapon = null;
  ST.giveItem('bronze_sword', 1, false);   // 伤害 5
  ST.giveItem('iron_sword', 1, false);     // 伤害 9
  const nEquip = G.equipAllBetter();
  assert(nEquip >= 1, '一键装备换上更优装备 -> '+nEquip);
  assert(ST.Game.gear.weapon && ST.Game.gear.weapon.dmg === 9, '装备槽位为更强的铁剑 -> '+(ST.Game.gear.weapon&&ST.Game.gear.weapon.name));
  const deltaHtml = G.gearDeltaHtml(ST.Items['iron_sword']);
  assert(typeof deltaHtml === 'string' && deltaHtml.includes('delta'), '装备属性对比输出 Δ -> '+deltaHtml);
  assert(G.gearIsBetter(ST.Items['iron_sword']) === false, '已装备最强武器时不再判定为更优');

  // 16c. 怪物威胁评估
  const r1 = G.monsterRating(ST.Monsters['goblin']);
  assert(r1 && !!r1.tag, '怪物评估给出推荐标记 -> '+(r1&&r1.tag));
  const r2 = G.monsterRating(ST.Monsters['dragon']);
  assert(r2 && !!r2.tag, '高难怪物同样有评估 -> '+(r2&&r2.tag));

  // 16d. 离线结算摘要
  ST.Game.activity = null; ST.Game.combat = null;
  ST.Game.stats.harvests = 0;
  ST.giveItem('seed_potato', 1, false);
  G.plantAt(3, 'seed_potato');
  const off0 = Date.now() - 3600*1000;
  context.localStorage.setItem('melvor_idle_save_v1_time', String(off0));
  const offRec = G.offlineProgress();
  assert(offRec && offRec.time, '离线结算返回摘要 -> '+(offRec&&offRec.time));
  assert(offRec && offRec.crops >= 1, '离线期间作物收获计入摘要 -> '+(offRec&&offRec.crops));
  assert(ST.Game.stats.lastOffline && ST.Game.stats.lastOffline.time, '离线摘要写入统计供统计页展示');

  // 16e. 重置存档会清零统计（修复：统计曾继承旧存档）
  ST.Game.stats.kills = 123; ST.Game.stats.purchases = 5; ST.Game.stats.spent = 999;
  G.resetToDefault();
  assert(ST.Game.stats.kills === 0 && ST.Game.stats.purchases === 0 && ST.Game.stats.spent === 0, '重置存档清零统计');

  console.log('PASS: 功能完善（里程碑提示/装备Δ/一键装备/怪物评估/离线摘要/重置）通过');
}catch(e){
  console.error('FAIL: 功能完善: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 17. 布局体检：网格不留空轨道 + 商店分栏密实 ----
try{
  const css = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
  const autoFill = (css.match(/auto-fill/g)||[]).length;
  assert(autoFill === 0, '样式表已全部改用 auto-fit（消除空轨道留白）-> 剩余 auto-fill: '+autoFill);
  assert(css.includes('.shop-layout'), '商店使用左右分栏布局');
  assert(css.includes('.shop-group'), '商店有分类分组样式');

  // 商店渲染：分组数 = 分类数
  G.renderShop();
  const shopHtml = context.document.getElementById('content').innerHTML;
  const groupCount = (shopHtml.match(/class="shop-group"/g)||[]).length;
  assert(groupCount === (ST.SHOP_CATS||[]).length, '商店渲染出全部分类分组 -> '+groupCount);
  assert(shopHtml.includes('shop-layout'), '商店渲染使用分栏容器');
  assert(shopHtml.includes('sell-toolbar'), '出售区带工具条（可售数量 / 合计 / 一键出售）');

  // 所有网格最小列宽 >= 150px（轨道过窄会让内容挤成一条）
  const minCols = [...css.matchAll(/minmax\((\d+)px/g)].map(m=>parseInt(m[1]));
  const tooNarrow = minCols.filter(v=>v<150);
  assert(tooNarrow.length===0, '所有网格最小列宽 ≥ 150px -> '+(tooNarrow.length?tooNarrow.join(','):'OK'));

  console.log('PASS: 布局体检（无空轨道 / 商店分栏密实）通过');
}catch(e){
  console.error('FAIL: 布局体检: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 18. 行动队列：任务顺序 / 进度 / 兜底动作 / 阻塞顺延 ----
try{
  // 18a. 队列基础
  G.clearQueue();
  assert(ST.Game.queue.length===0, '清空队列');
  const e1 = G.addQueueEntry('chop','normal_log',5);
  const e2 = G.addQueueEntry('mine','copper_ore',3);
  assert(ST.Game.queue.length===2, '加入两个任务 -> '+ST.Game.queue.length);
  assert(G.entryLabel(e1).includes('伐木'), '任务显示名正确 -> '+G.entryLabel(e1));
  assert(G.entryCanRun(e1).ok, '伐木普通原木可执行（1 级）');

  // 18b. 启动队列 → 驱动当前动作
  G.startQueue();
  assert(ST.Game.queueRunning===true, '队列已启动');
  G.ensureQueueActivity();
  assert(ST.Game.activity && ST.Game.activity.kind==='chop' && ST.Game.activity.itemId==='normal_log',
    '队列驱动当前动作为伐木普通原木 -> '+(ST.Game.activity&&ST.Game.activity.kind));

  // 18c. 进度累计与达成后顺延
  const before = ST.totalOf('normal_log');
  G.performAction(ST.Game.activity);
  assert(ST.Game.queue[0].done >= 1, '任务进度累计 -> '+ST.Game.queue[0].done+'/'+ST.Game.queue[0].qty);
  // 直接推到达成
  ST.Game.queue[0].done = ST.Game.queue[0].qty;
  const qIdxBefore = ST.Game.queueIdx;
  G.queueOnActionDone(ST.Game.activity, 0);
  assert(ST.Game.queueIdx === qIdxBefore+1, '任务达成后顺延到下一项 -> idx '+ST.Game.queueIdx);
  assert(ST.Game.queue[0].done === 0, '已完成任务进度归零（下一轮重新计数）');
  assert(ST.Game.queue[0].completed === 1, '完成任务计数 +1');

  // 18d. 队列项操作：上移 / 下移 / 删除
  const id0 = ST.Game.queue[0].id, id1 = ST.Game.queue[1].id;
  G.moveQueueEntry(id0, 1);
  assert(ST.Game.queue[0].id===id1 && ST.Game.queue[1].id===id0, '任务下移生效');
  G.moveQueueEntry(id0, -1);
  assert(ST.Game.queue[0].id===id0, '任务上移生效');
  G.removeQueueEntry(id0);
  assert(ST.Game.queue.length===1, '删除任务生效 -> '+ST.Game.queue.length);

  // 18e. 兜底动作
  G.clearQueue();
  G.setFallback('mine','copper_ore',1);
  assert(ST.Game.fallback && ST.Game.fallback.kind==='mine', '兜底动作已设置 -> '+(ST.Game.fallback&&ST.Game.fallback.kind));
  G.startQueue();
  G.ensureQueueActivity();   // 队列为空 → 应切换到兜底
  assert(ST.Game.activity && ST.Game.activity.src==='fallback', '队列为空时切换到兜底动作 -> '+(ST.Game.activity&&ST.Game.activity.src));
  assert(ST.Game.activity.kind==='mine', '兜底动作为挖矿铜矿石 -> '+(ST.Game.activity&&ST.Game.activity.kind));
  G.setFallback('idle','',1);
  G.ensureQueueActivity();
  assert(ST.Game.activity===null, '兜底设为空闲时停止行动');

  // 18f. 任务阻塞时顺延（等级不足的采集任务）
  G.clearQueue();
  ST.Game.skills.mining.level = 1;
  const blocked = G.addQueueEntry('mine','mithril_ore',2);      // 需要挖矿 30 级
  const okEntry = G.addQueueEntry('chop','normal_log',2);
  assert(!G.entryCanRun(blocked).ok, '高等级任务被判定为阻塞 -> '+G.entryCanRun(blocked).reason);
  G.startQueue();
  G.ensureQueueActivity();
  assert(ST.Game.activity && ST.Game.activity.itemId==='normal_log', '阻塞任务被跳过，执行可执行任务 -> '+(ST.Game.activity&&ST.Game.activity.itemId));

  // 18g. 制作类任务按「制作次数」计数
  G.clearQueue();
  ST.Game.skills.smithing.level = 20;
  ST.giveItem('copper_ore',10,false); ST.giveItem('tin_ore',10,false);
  const craftEntry = G.addQueueEntry('smith','bronze_bar',2);   // 锻造青铜锭 2 次
  G.startQueue();
  G.ensureQueueActivity();
  assert(ST.Game.activity && ST.Game.activity.kind==='smith', '队列启动制作类任务 -> '+(ST.Game.activity&&ST.Game.activity.kind));
  const bronze0 = ST.totalOf('bronze_bar');
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('bronze_bar') > bronze0, '制作类任务产出青铜锭 -> '+ST.totalOf('bronze_bar'));
  assert(ST.Game.queue[0].done === 1, '制作类任务按次数计数 -> done='+ST.Game.queue[0].done);

  // 18h. 手动选择行动会暂停队列
  G.startQueue();
  assert(ST.Game.queueRunning===true, '队列重新启动');
  G.startActivity('chop','normal_log');
  assert(ST.Game.queueRunning===false, '手动选择行动后队列自动暂停');

  // 18i. 队列状态可存档
  G.clearQueue();
  G.addQueueEntry('chop','normal_log',10);
  G.setFallback('mine','copper_ore',1);
  G.startQueue();
  G.saveGame();
  const savedRaw = context.localStorage.getItem('melvor_idle_save_v1');
  const saved = JSON.parse(savedRaw);
  assert(Array.isArray(saved.queue) && saved.queue.length===1, '队列写入存档 -> '+(saved.queue||[]).length);
  assert(saved.fallback && saved.fallback.kind==='mine', '兜底动作写入存档');
  assert(saved.queueRunning===true, '队列运行状态写入存档');

  G.clearQueue();
  G.setFallback('idle','',1);
  console.log('PASS: 行动队列（顺序/进度/兜底/阻塞顺延/制作计数/存档）通过');
}catch(e){
  console.error('FAIL: 行动队列: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 19. 战斗页美化：竞技场待机 / 威胁评估 / 战绩统计 / 战利品记录 ----
try{
  G.renderCombat();
  const combatHtml = context.document.getElementById('content').innerHTML;
  assert(combatHtml.includes('arena'), '战斗页使用常驻竞技场容器');
  assert(combatHtml.includes('combat-stats-panel'), '战斗页含战绩统计面板');
  assert(combatHtml.includes('loot-strip'), '战斗页含最近战利品面板');
  assert(combatHtml.includes('class="diff"'), '怪物卡片含难度条');
  assert(combatHtml.includes('cStatDps'), '战斗属性条含 DPS');

  // 待机面板：未战斗时左栏也有内容
  ST.Game.combat = null;
  G.updateCombatLive();
  const fa = context.document.getElementById('fightArea');
  const standby = fa.innerHTML;
  assert(standby.includes('standby'), '未战斗时显示待机面板');
  assert(standby.includes('hero-chips'), '待机面板显示装备摘要');
  assert(standby.includes('推荐目标'), '待机面板显示推荐目标');

  // 威胁评估带风险值
  const rt = G.monsterRating(ST.Monsters['goblin']);
  assert(rt && typeof rt.risk === 'number', '威胁评估返回风险值 -> '+(rt&&rt.risk));
  const rec = G.recommendMonster();
  assert(rec && rec.id, '能给出推荐挑战目标 -> '+(rec&&rec.name));

  // DPS 估算
  assert(G.dpsEstimate() > 0, 'DPS 估算为正 -> '+G.dpsEstimate());

  // 预估掉落价值
  const lv1 = G.monsterLootValue(ST.Monsters['wolf']);
  assert(lv1 > 0, '怪物卡片给出预估掉落价值 -> '+lv1);
  const lv2 = G.monsterLootValue(ST.Monsters['dragon']);
  assert(lv2 > lv1, '高阶怪物预估价值更高 -> '+lv1+' -> '+lv2);

  // 战利品记录
  const loot0 = (ST.Game.recentLoot||[]).length;
  G.pushRecentLoot('bones', 3);
  assert((ST.Game.recentLoot||[]).length > loot0, '战利品被记录 -> '+(ST.Game.recentLoot||[]).length);

  // 战斗计数：输出 / 承伤 / 回合
  ST.Game.gear.weapon = null; ST.Game.gear.bow = null; ST.Game.gear.arrow = null;
  ST.giveItem('bronze_sword',1,false); G.equipItem('bronze_sword');
  const dealt0 = ST.Game.stats.damageDealt||0;
  G.startCombat('goblin');
  assert(ST.Game.combat.dmgOut===0 && ST.Game.combat.round===0, '战斗从 0 计数开始');
  let g5=0; ST.Game.combat.playerHp = G.playerMaxHp();
  while(ST.Game.combat && g5<200){ G.combatTick(0.3); g5++; }
  assert((ST.Game.stats.damageDealt||0) > dealt0, '累计输出伤害增加 -> '+(ST.Game.stats.damageDealt||0));

  // 攻击动效钩子
  context.window.UI.attackFx && context.window.UI.attackFx('player');
  assert(true, '攻击动效钩子可调用');

  console.log('PASS: 战斗页美化（竞技场/威胁评估/战绩/战利品/动效钩子）通过');
}catch(e){
  console.error('FAIL: 战斗页美化: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 20. 活动类型一致性审计：每种配方类型都能真正执行 ----
try{
  // 20a. 配方里的所有 type 都必须在 performAction 的分支里有对应处理
  // 先给足所有原料，确保每种类型都能被实测（而不是因缺料被跳过）
  const matIds = [...new Set(ST.Recipes.flatMap(r=>r.cost.map(c=>c[0])))];
  matIds.forEach(id => ST.giveItem(id, 60, false));
  const recipeTypes = [...new Set(ST.Recipes.map(r=>r.type))];
  const missing = [];
  const untested = [];
  for (const t of recipeTypes){
    const rec = ST.Recipes.find(r=>r.type===t && G.canAfford(r.cost));
    if (!rec){ untested.push(t); continue; }
    const before = ST.totalOf(rec.out);
    G.performAction({ kind:t, recipe:rec });
    if (ST.totalOf(rec.out) <= before) missing.push(t);
  }
  assert(untested.length===0, '每种配方类型都有一条可实测的配方' + (untested.length?`，跳过: ${untested.join('、')}`:''));
  assert(missing.length===0, '每种配方类型都能被 performAction 真正执行' + (missing.length?`，失效: ${missing.join('、')}`:''));

  // 20b. 行动队列的行动类型与配方类型必须对齐（否则队列会选不到目标）
  const kinds = Object.keys(ST.ActionKinds||{});
  const noTarget = kinds.filter(k => ST.ActionKinds[k].mode==='recipe' && !ST.Recipes.some(r=>r.type===k));
  assert(noTarget.length===0, '队列中每个制作类行动都有对应配方' + (noTarget.length?`，空: ${noTarget.join('、')}`:''));
  const noGather = kinds.filter(k => ST.ActionKinds[k].mode==='gather' && G.actionTargets(k).length===0);
  assert(noGather.length===0, '队列中每个采集类行动都有可选目标' + (noGather.length?`，空: ${noGather.join('、')}`:''));

  // 20c. 活动标签能正确显示各类活动
  ST.giveItem('essense', 5, false);
  G.startRecipeActivity('runecrafting', ST.Recipes.find(r=>r.type==='runecrafting'));
  assert(G.currentActivityLabel().includes('符文'), '符文制作在状态栏正确显示 -> '+G.currentActivityLabel());
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('air_rune') > 0, '符文制作能实际产出符文 -> '+ST.totalOf('air_rune'));

  console.log('PASS: 活动类型一致性（配方类型全覆盖 / 队列目标对齐）通过');
}catch(e){
  console.error('FAIL: 活动类型一致性: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 21. 移动端适配审计 ----
try{
  const css = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
  // 21a. 所有网格的最小列宽必须用 min(px,100%) 兜底，否则窄屏会被撑破
  const bareMin = [...css.matchAll(/grid-template-columns:[^;]*minmax\((\d+)px,/g)].map(m=>m[0]);
  assert(bareMin.length===0, '所有网格最小列宽都带 min(px,100%) 兜底' + (bareMin.length?`，漏: ${bareMin.length} 处`:''));
  // 21b. 必须存在手机断点
  assert(/@media\s*\(max-width:720px\)/.test(css), '存在手机断点 (max-width:720px)');
  assert(/@media\s*\(max-width:400px\)/.test(css), '存在超小屏断点 (max-width:400px)');
  assert(/@media\s*\(max-width:1080px\)/.test(css), '存在平板断点 (max-width:1080px)');
  // 21c. 禁止横向滚动
  assert(/html,body\{[^}]*overflow-x:hidden/.test(css), '已禁止整页横向滚动');
  // 21d. 关键组件在手机断点内都有适配
  const mob = css.slice(css.indexOf('@media (max-width:720px)'), css.indexOf('@media (max-width:400px)'));
  ['#topbar','#tabs','#content','#statusbar','.skills-grid','.invgrid','.page-stats','.statgrid','.monsters','.plots','.arena','.qitem','.shop-layout','.gear-slots','#modalBox','.stylepick','.sell-toolbar'].forEach(sel=>{
    assert(mob.includes(sel), `手机断点已适配 ${sel}`);
  });
  // 21e. 表单控件在手机上 >=16px，避免 iOS 自动放大
  assert(/input,select,textarea\{[^}]*font-size:16px/.test(css), '手机端表单控件字号 16px（防止 iOS 聚焦缩放）');
  console.log('PASS: 移动端适配审计（网格兜底/断点覆盖/禁止横向滚动/表单字号）通过');
}catch(e){
  console.error('FAIL: 移动端适配审计: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 22. 钓竿工具链 + 装备槽位锁定 ----
try{
  // 22a. 钓竿数据：独立槽位 / 按钓鱼等级判定 / 商店门槛文案
  assert(!!ST.Items['bronze_rod'] && ST.Items['bronze_rod'].rodPower === 4, '钓竿物品存在并带威力值');
  assert(G.equipSlotOf(ST.Items['iron_rod']) === 'rod', '钓竿装备到独立钓竿槽位 -> '+G.equipSlotOf(ST.Items['iron_rod']));
  ST.Game.skills.fishing.level = 20;
  assert(G.relevantLevel(ST.Items['steel_rod']) === 20, '钓竿按钓鱼等级判定 -> '+G.relevantLevel(ST.Items['steel_rod']));
  assert(G.skillNameForShop('iron_rod') === '钓鱼', '商店把钓竿门槛标为钓鱼 -> '+G.skillNameForShop('iron_rod'));
  assert(G.levelOfForShop('iron_rod') === ST.levelOf('fishing'), '商店钓竿等级取钓鱼等级');

  // 22b. 初始背包带青铜钓竿，自动装备可穿上
  G.resetToDefault();
  ST.Game.auto_equip = true;
  ST.Game.skills.fishing.level = 20;
  G.maybeAutoEquip();
  assert(ST.Game.gear.rod && ST.Game.gear.rod.id === 'bronze_rod', '自动装备青铜钓竿 -> '+(ST.Game.gear.rod&&ST.Game.gear.rod.name));

  // 22c. 更好的钓竿能装备并缩短钓鱼间隔
  const beforeInt = G.fishingInterval();
  ST.giveItem('steel_rod', 1, false);
  G.equipItem('steel_rod');
  assert(ST.Game.gear.rod && ST.Game.gear.rod.id === 'steel_rod', '换上更强的钢钓竿 -> '+(ST.Game.gear.rod&&ST.Game.gear.rod.name));
  const afterInt = G.fishingInterval();
  assert(afterInt < beforeInt, '钓竿升级后钓鱼间隔缩短 -> '+beforeInt.toFixed(2)+'s → '+afterInt.toFixed(2)+'s');

  // 22d. 商店出售多档钓竿，且单价 ≥ 回收价（杜绝低买高卖）
  const rodShop = (ST.ShopStock||[]).filter(s=>ST.Items[s.itemId] && ST.Items[s.itemId].rodPower);
  assert(rodShop.length >= 3, '商店出售多个等级的钓竿 -> '+rodShop.length+' 件');
  const badRod = rodShop.filter(s=>Math.round(s.cost/s.qty) < (ST.Items[s.itemId].value||0));
  assert(badRod.length === 0, '钓竿定价不倒挂（单价 ≥ 回收价）');

  // 22e. 自动购买工具会购买并装备更好的钓竿
  G.resetToDefault();
  ST.Game.auto_buy_tools = true;
  ST.Game.auto_equip = false;
  ST.Game.coins = 700;
  ST.Game.skills.fishing.level = 20;
  G.autoBuyTools();
  assert(ST.Game.gear.rod && ST.Game.gear.rod.id === 'steel_rod', '自动购买并装备更好的钓竿 -> '+(ST.Game.gear.rod&&ST.Game.gear.rod.name));

  // 22f. 锁定槽位：自动装备 / 一键更优 / 自动购买都不替换，手动装备仍可用
  ST.Game.auto_equip = true;
  ST.Game.coins = 99999;
  ST.Game.skills.fishing.level = 60;
  ST.giveItem('runite_rod', 1, false);
  G.toggleSlotLock('rod');
  assert(ST.slotLocked('rod') === true, '槽位可锁定');
  G.maybeAutoEquip(); G.equipAllBetter(); G.autoBuyTools();
  assert(ST.Game.gear.rod.id === 'steel_rod', '锁定槽位不被自动更换 -> '+ST.Game.gear.rod.name);
  G.equipItem('runite_rod');
  assert(ST.Game.gear.rod.id === 'runite_rod', '手动装备仍可更换锁定槽位 -> '+ST.Game.gear.rod.name);
  G.toggleSlotLock('rod');
  assert(ST.slotLocked('rod') === false, '槽位可解锁');
  ST.Game.gear.rod = ST.Items['bronze_rod'];
  ST.giveItem('runite_rod', 1, false);
  G.maybeAutoEquip();
  assert(ST.Game.gear.rod.id === 'runite_rod', '解锁后自动装备恢复 -> '+ST.Game.gear.rod.name);

  // 22g. 装备页渲染钓竿槽位与锁定按钮，且锁定状态写入存档
  G.renderEquipment();
  const eqHtml = context.document.getElementById('content').innerHTML;
  assert(eqHtml.includes('钓竿') && eqHtml.includes('toggleSlotLock'), '装备页渲染钓竿槽位与锁定按钮');
  G.toggleSlotLock('axe');
  G.saveGame();
  const saveRaw = JSON.parse(context.localStorage.getItem('melvor_idle_save_v1'));
  assert(saveRaw && saveRaw.lockSlots && saveRaw.lockSlots.axe === true, '锁定状态写入存档');

  console.log('PASS: 钓竿工具链与装备槽位锁定（装备/提速/购买/锁定隔离/存档）通过');
}catch(e){
  console.error('FAIL: 钓竿工具链与装备槽位锁定: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 23. 后台节流 / 挂起不丢进度（稳定性回归） ----
try{
  const realNow = Date.now;
  let clock = realNow();
  Date.now = ()=>clock;                       // vm 上下文与宿主共享同一个 Date 对象
  try{
    G.resetToDefault();
    G.startActivity('chop','normal_log');

    // 23a. 后台标签页被限流到 1 秒一跳：游戏时间必须与真实流逝一致
    const t0 = ST.Game.stats.time;
    for (let i=0;i<10;i++){ clock += 1000; G.gameLoop(); }
    const adv = ST.Game.stats.time - t0;
    assert(adv === 10, '后台限流（1 秒一跳）不丢游戏时间 -> +'+adv+'s');

    // 23b. 长时间无 tick（冻结 / 最小化）后回来：按补算规则结算而不是丢弃
    const xp0 = ST.Game.skills.woodcutting.xp;
    clock += 10*60*1000;
    G.gameLoop();
    assert(ST.Game.skills.woodcutting.xp > xp0, '长时间挂起后回来补算进度 -> +'+(ST.Game.skills.woodcutting.xp-xp0)+'xp');
    assert(ST.Game.stats.lastOffline && ST.Game.stats.lastOffline.seconds >= 60, '空档写入补算摘要');

    // 23c. 同一段空档不会被重复结算，回来后按帧继续推进
    const sec = ST.Game.stats.lastOffline.seconds;
    const tA = ST.Game.stats.time;
    clock += 1000; G.gameLoop();
    assert(ST.Game.stats.lastOffline.seconds === sec, '同一段空档不会重复结算');
    assert(ST.Game.stats.time - tA === 1, '回到前台后按帧继续推进 -> +'+(ST.Game.stats.time-tA)+'s');

    // 23d. 正常帧率（250ms）下与实际时间保持一致
    const tB = ST.Game.stats.time;
    for (let i=0;i<8;i++){ clock += 250; G.gameLoop(); }
    assert(ST.Game.stats.time - tB === 2, '正常帧率下游戏时间与实际一致 -> +'+(ST.Game.stats.time-tB)+'s');

    // 23e. 极长空档：一次性结算且不阻塞主线程
    const w0 = realNow();
    clock += 72*3600*1000;
    G.gameLoop();
    const cost = realNow() - w0;
    assert(cost < 1000, '极长空档不会卡住主线程 -> '+cost+'ms');
    assert(ST.Game.stats.lastOffline.seconds === 8*3600, '补算时长上限 8 小时 -> '+ST.Game.stats.lastOffline.time);

    // 23f. 采集类活动的中等空档：回到前台后数帧内补齐，且不必打扰玩家
    const prevOffline = ST.Game.stats.lastOffline.seconds;
    const tC = ST.Game.stats.time;
    clock += 40000; G.gameLoop();                       // 空档 40 秒
    for (let i=0;i<4;i++){ clock += 250; G.gameLoop(); }
    assert(ST.Game.stats.time - tC === 41, '中等空档在返回后补齐（40s + 4×250ms）-> +'+(ST.Game.stats.time-tC)+'s');
    assert(ST.Game.stats.lastOffline.seconds === prevOffline, '未进入补算结算的空档不打扰玩家');
  } finally {
    Date.now = realNow;                       // 必须还原，否则后续用例时间冻结
  }
  console.log('PASS: 后台节流与挂起补算（不丢时间 / 不重复结算 / 不卡主线程）通过');
}catch(e){
  console.error('FAIL: 后台节流与挂起补算: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 24. 法杖与魔法战斗风格 ----
try{
  G.resetToDefault();
  // 24a. 法杖数据：独立槽位 + 按魔法等级判定
  assert(!!ST.Items['staff_apprentice'] && ST.Items['staff_apprentice'].magic, '法杖物品存在并标记为魔法武器');
  assert(G.equipSlotOf(ST.Items['staff_adept']) === 'magic', '法杖进入独立法杖槽位 -> '+G.equipSlotOf(ST.Items['staff_adept']));
  ST.Game.skills.magic.level = 15;
  assert(G.relevantLevel(ST.Items['staff_adept']) === 15, '法杖按魔法等级判定 -> '+G.relevantLevel(ST.Items['staff_adept']));
  assert(G.skillNameForShop('staff_mystic') === '魔法', '等级提示文案为魔法 -> '+G.skillNameForShop('staff_mystic'));

  // 24b. 法杖可被真正制作出来（配方类型接进 performAction）
  const stRecipe = ST.Recipes.find(r=>r.out==='staff_apprentice');
  ST.giveItem('normal_log', 4, false); ST.giveItem('essense', 4, false);
  ST.Game.skills.magic.level = 1; ST.Game.skills.fletching.level = 5;
  ST.Game.activity = { kind:'fletch', recipe:stRecipe, src:'test' };
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('staff_apprentice') >= 1, '制作产出学徒法杖 -> '+ST.totalOf('staff_apprentice'));
  ST.Game.activity = null;

  // 24c. 手动与自动装备
  G.equipItem('staff_apprentice');
  assert(ST.Game.gear.magic && ST.Game.gear.magic.id === 'staff_apprentice', '法杖可手动装备 -> '+(ST.Game.gear.magic&&ST.Game.gear.magic.name));
  assert(G.gearDeltaHtml(ST.Items['staff_apprentice']).includes('delta'), '法杖参与装备属性对比 Δ');
  ST.giveItem('staff_adept', 1, false);
  ST.Game.skills.magic.level = 15;
  G.maybeAutoEquip();
  assert(ST.Game.gear.magic.id === 'staff_adept', '满足条件时自动换上更强的法杖 -> '+ST.Game.gear.magic.name);

  // 24d. 战斗风格偏好：优先玩家选择，不可用时自动回落
  G.setCombatStyle('magic');
  assert(G.combatMode() === 'magic', '手动选择魔法风格生效 -> '+G.combatMode());
  const mdr = G.playerDamageRange();
  assert(mdr.lo > 0 && mdr.hi >= mdr.lo, '魔法风格能算出伤害区间 -> '+mdr.lo+'-'+mdr.hi);
  ST.Game.gear.magic = null;
  ST.Game.gear.bow = null; ST.Game.gear.weapon = null;
  assert(G.combatMode() === 'attack', '没有法杖时回落到近战 -> '+G.combatMode());
  ST.giveItem('shortbow', 1, false); G.equipItem('shortbow');
  ST.giveItem('arrow_bronze', 5, false); ST.Game.gear.arrow = ST.Items['arrow_bronze'];
  G.setCombatStyle('auto');
  assert(G.combatMode() === 'ranged', '未指定时按装备自动选择远程 -> '+G.combatMode());

  // 24e. 魔法开战：不消耗箭矢，并积累魔法经验
  ST.Game.gear.magic = ST.Items['staff_adept'];
  G.setCombatStyle('magic');
  ST.Game.skills.magic.xp = 0; ST.Game.skills.magic.level = 1;
  const arrows0 = ST.totalOf('arrow_bronze');
  G.startCombat('goblin');
  assert(ST.Game.combat && ST.Game.combat.style === 'magic', '魔法偏好在开战时生效 -> '+(ST.Game.combat&&ST.Game.combat.style));
  for (let i=0;i<40 && ST.Game.combat;i++) G.combatTick(0.3);
  assert(ST.totalOf('arrow_bronze') === arrows0, '魔法战斗不消耗箭矢 -> '+ST.totalOf('arrow_bronze'));
  assert(ST.Game.skills.magic.xp > 0, '魔法风格积累魔法经验 -> '+ST.Game.skills.magic.xp);

  // 24f. 风格偏好写入并可读回存档
  G.setCombatStyle('magic');
  G.saveGame();
  const raw2 = JSON.parse(context.localStorage.getItem('melvor_idle_save_v1'));
  assert(raw2 && raw2.stylePref === 'magic', '风格偏好写入存档 -> '+(raw2&&raw2.stylePref));
  context.localStorage.setItem('melvor_idle_save_v1', JSON.stringify(Object.assign({}, raw2, { stylePref:'ranged' })));
  G.loadGame();
  assert(ST.Game.stylePref === 'ranged', '读档恢复风格偏好 -> '+ST.Game.stylePref);

  // 24g. 页面渲染：战斗页风格切换 + 装备页法杖槽位
  G.setCombatStyle('auto');
  G.renderCombat();
  const cHtml = context.document.getElementById('content').innerHTML;
  assert(cHtml.includes('data-style') && cHtml.includes('魔法'), '战斗页渲染风格切换按钮（含魔法）');
  G.renderEquipment();
  const eHtml = context.document.getElementById('content').innerHTML;
  assert(eHtml.includes('法杖'), '装备页渲染法杖槽位');

  console.log('PASS: 法杖与魔法战斗风格（装备/制作/切换/不耗箭矢/经验/存档/渲染）通过');
}catch(e){
  console.error('FAIL: 法杖与魔法战斗风格: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 25. 批量操作：库存一键转存 / 农田一键补种 ----
try{
  G.resetToDefault();
  // 25a. 背包 → 仓库
  ST.giveItem('normal_log', 7, false); ST.giveItem('bones', 3, false);
  const movedKinds = G.moveAllTo('toBank');
  assert(movedKinds >= 2, '全部存入返回迁移的种类数 -> '+movedKinds);
  assert(Object.keys(ST.Game.inventory).length === 0, '存入后背包被清空');
  assert((ST.Game.banking['normal_log']||0) >= 7 && (ST.Game.banking['bones']||0) >= 3, '仓库收到全部数量');
  // 25b. 仓库 → 背包（数量不丢失）
  const totalBefore = ST.totalOf('normal_log');
  const backKinds = G.moveAllTo('toInv');
  assert(backKinds === movedKinds, '取回的种类数一致 -> '+backKinds);
  assert(Object.keys(ST.Game.banking).length === 0, '取回后仓库被清空');
  assert(ST.totalOf('normal_log') === totalBefore, '往返转存没有丢失物品 -> '+ST.totalOf('normal_log'));
  // 25c. 空集合调用安全
  ST.Game.inventory = {}; ST.Game.banking = {};
  assert(G.moveAllTo('toBank') === 0, '空背包调用安全');
  assert(G.moveAllTo('toInv') === 0, '空仓库调用安全');

  // 25d. 农田一键补种：填满空地，遵循等级与数量限制
  ST.Game.farms = {}; ST.Game.skills.farming.level = 20;
  ST.giveItem('seed_potato', 6, false);
  const n1 = G.plantAll('seed_potato');
  assert(n1 === 4, '一键补种填满 4 块地 -> '+n1);
  assert(Object.keys(ST.Game.farms).length === 4, '农田被全部占用');
  assert(ST.totalOf('seed_potato') === 2, '扣除对应种子 -> '+ST.totalOf('seed_potato'));
  assert(G.plantAll('seed_potato') === 0, '没有空地时不再种植');
  ST.Game.farms = {}; ST.Game.skills.farming.level = 1;
  ST.giveItem('seed_snapdragon', 2, false);
  assert(G.plantAll('seed_snapdragon') === 0, '农牧等级不足时拒绝批量种植');

  // 25e. 三个页面的批量入口都渲染出来
  ST.Game.farms = {}; ST.giveItem('seed_potato', 2, false);
  G.renderInventory();
  assert(context.document.getElementById('content').innerHTML.includes('data-moveall'), '背包页渲染一键存入按钮');
  G.renderBank();
  assert(context.document.getElementById('content').innerHTML.includes('data-moveall'), '仓库页渲染一键取回按钮');
  G.renderFarming();
  assert(context.document.getElementById('content').innerHTML.includes('data-seedall'), '农牧页渲染全部种植按钮');

  console.log('PASS: 批量操作（库存一键转存 / 农田一键补种 / 入口渲染）通过');
}catch(e){
  console.error('FAIL: 批量操作: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 26. 稀有度：数据推导审计 + 展示接线 ----
try{
  const ORDER = ['BROKEN','COMMON','UNCOMMON','RARE','LEGENDARY','MYTHIC','SPECIAL'];  // SPECIAL 为唯一来源，级别最高
  const rank = id => ORDER.indexOf(id);

  // 26a. 每个物品都能推出合法稀有度，且名称 / 色值可用
  const bad = [];
  Object.values(ST.Items).forEach(it=>{
    const id = ST.rarityId(it);
    if (!ST.RARITY[id]) bad.push(`${it.id}:${id}`);
    else if (!ST.rarityName(it) || !/^#/.test(ST.rarityColor(it))) bad.push(`${it.id}:缺色`);
  });
  assert(bad.length === 0, '所有物品都能推出合法稀有度（含名称与色值）' + (bad.length?`，异常: ${bad.slice(0,3).join('、')}`:''));

  // 26b. 单调性：回收价更高的物品，稀有度不应更低（显式指定 rarity 的物品不参与，它们有自己的设定）
  const valued = Object.values(ST.Items).filter(it=>(it.value||0) > 0 && !(it.rarity && ST.RARITY[it.rarity]));
  let inversion = '';
  for (const a of valued){
    for (const b of valued){
      if (a.id === b.id) continue;
      if (a.value > b.value && rank(ST.rarityId(a)) < rank(ST.rarityId(b))){
        inversion = `${a.id}(${a.value}/${ST.rarityId(a)}) vs ${b.id}(${b.value}/${ST.rarityId(b)})`;
        break;
      }
    }
    if (inversion) break;
  }
  assert(!inversion, '回收价与稀有度单调一致' + (inversion?`，反例: ${inversion}`:''));

  // 26c. 高层装备确实更稀有，新手工具是普通
  assert(rank(ST.rarityId(ST.Items['runite_sword'])) > rank(ST.rarityId(ST.Items['bronze_sword'])),
    '符文剑比青铜剑稀有 -> '+ST.rarityId(ST.Items['runite_sword'])+' > '+ST.rarityId(ST.Items['bronze_sword']));
  assert(ST.rarityId(ST.Items['bronze_axe']) === 'COMMON', '新手工具为普通 -> '+ST.rarityId(ST.Items['bronze_axe']));
  assert(ST.rarityId(ST.Items['ring_dragon']) === 'SPECIAL', '唯一来源的掉落被标为特殊 -> '+ST.rarityId(ST.Items['ring_dragon']));
  assert(rank(ST.rarityId(ST.Items['ring_dragon'])) > rank(ST.rarityId(ST.Items['ring_runite'])), '特殊高于普通推导的同类装备');

  // 26d. 图块渲染带上稀有度色条类（背包 / 商店 / 装备页）
  G.resetToDefault();
  ST.giveItem('runite_sword', 1, false);
  const rc = ST.rarityClass(ST.Items['runite_sword']);
  assert(/^r-[a-z]+$/.test(rc), '稀有度类名格式合法 -> '+rc);
  G.renderInventory();
  assert(context.document.getElementById('content').innerHTML.includes('class="invtile '+rc),
    '背包图块带上稀有度类名 -> '+rc);
  G.renderShop();
  assert(context.document.getElementById('content').innerHTML.includes('r-'), '商店图块标出稀有度');
  G.renderEquipment();
  assert(context.document.getElementById('content').innerHTML.includes('r-'), '装备页可装备列表标出稀有度');

  // 26e. 每个用到的稀有度都有对应色条样式（普通刻意无色，让颜色有信息量）
  const css2 = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
  const usedCls = Array.from(new Set(Object.values(ST.Items).map(it=>ST.rarityClass(it))));
  const missingCls = usedCls.filter(c=>c!=='r-common' && !css2.includes('.'+c));
  assert(missingCls.length === 0, '每个稀有度都有对应色条样式' + (missingCls.length?`，缺: ${missingCls.join(',')}`:''));

  console.log('PASS: 稀有度（合法推导 / 单调性 / 三类页面接线 / 样式齐全）通过');
}catch(e){
  console.error('FAIL: 稀有度: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 27. 战斗道具（迟缓药剂）与 Boss 专属技能 ----
try{
  G.resetToDefault();
  // 27a. 非战斗中使用应被拒绝且不消耗
  ST.Game.combat = null;
  ST.giveItem('slow_potion', 2, false);
  assert(G.useCombatItem('slow_potion') === false, '非战斗中不能使用迟缓药剂');
  assert(ST.totalOf('slow_potion') === 2, '被拒绝时不消耗道具 -> '+ST.totalOf('slow_potion'));

  // 27b. 战斗中使用：拉长怪物攻击间隔
  ST.Game.skills.combat.level = 40;
  G.startCombat('guard_titan');
  assert(!!ST.Game.combat, '达到等级门槛可挑战 Boss');
  const base = G.monsterInterval(ST.Monsters['guard_titan'], null);
  assert(G.useCombatItem('slow_potion') === true, '战斗中泼洒迟缓药剂成功');
  assert(ST.totalOf('slow_potion') === 1, '使用后消耗 1 瓶 -> '+ST.totalOf('slow_potion'));
  const slowed = G.monsterInterval(ST.Monsters['guard_titan'], ST.Game.combat);
  assert(slowed > base, '怪物攻击间隔变长 -> '+base.toFixed(2)+'s → '+slowed.toFixed(2)+'s');

  // 27c. 到点自动解除
  ST.Game.combat.slow.remaining = 0.1;
  G.combatTick(0.2);
  assert(!ST.Game.combat || !ST.Game.combat.slow, '迟缓效果到期自动结束');

  // 27d. Boss 专属技能：造成承伤，汲取类还会回血
  ST.Game.combat = null;
  ST.Game.autoEatThreshold = 0.01;                    // 排除自动进食干扰
  ST.Game.skills.combat.level = 70;
  G.startCombat('elder_lich');
  const lichMax = ST.Monsters['elder_lich'].hp;
  ST.Game.combat.monsterHp = Math.floor(lichMax*0.5);
  ST.Game.combat.playerHp = G.playerMaxHp();
  const hpBefore = ST.Game.combat.playerHp;
  G.doMonsterSpecial(ST.Game.combat, ST.Monsters['elder_lich']);
  assert(ST.Game.combat.playerHp < hpBefore, '专属技能造成承伤 -> '+(hpBefore - ST.Game.combat.playerHp));
  assert(ST.Game.combat.monsterHp > Math.floor(lichMax*0.5), '汲取生命会回复 Boss 血量 -> '+ST.Game.combat.monsterHp);

  // 27e. 只给 Boss 配专属技能，普通怪没有
  assert(!ST.Monsters['goblin'].special, '普通怪没有专属技能');
  const noSkill = Object.values(ST.Monsters).filter(m=>m.boss && !m.special).map(m=>m.id);
  assert(noSkill.length === 0, '每个 Boss 都有专属技能' + (noSkill.length?`，缺: ${noSkill.join('、')}`:''));
  const noName = Object.values(ST.Monsters).filter(m=>m.special && !m.special.name).map(m=>m.id);
  assert(noName.length === 0, '专属技能都有名字（用于提示文案）');

  // 27f. 背包页给出使用入口
  G.renderInventory();
  assert(context.document.getElementById('content').innerHTML.includes('data-use'), '背包页渲染战斗道具的入口');

  console.log('PASS: 战斗道具与 Boss 专属技能（延迟/消耗/到期/回血/入口）通过');
}catch(e){
  console.error('FAIL: 战斗道具与 Boss 专属技能: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 28. 存档导出 / 导入（文本备份，防清缓存丢档）----
try{
  G.resetToDefault();
  ST.Game.coins = 1234;
  ST.giveItem('normal_log', 3, false);            // 初始 5 + 新增 3
  G.saveGame();

  // 28a. 导出：拿到合法 JSON 文本
  const text = G.exportSaveText();
  assert(!!text && text.length > 0, '导出得到存档文本 -> '+(text?text.length:0)+' 字符');
  let parsed = null;
  try { parsed = JSON.parse(text); } catch(e){}
  assert(parsed && parsed.coins === 1234, '导出文本是合法 JSON 且含当前金币');
  assert(parsed && parsed.inventory && parsed.skills, '导出文本含 inventory / skills');

  // 28b. 往返：重置后导入能完整恢复
  G.resetToDefault();
  assert(ST.Game.coins !== 1234, '重置后金币回到初始值，便于验证导入');
  const res = G.importSaveText(text);
  assert(res.ok === true, '导入成功 -> '+res.reason);
  assert(ST.Game.coins === 1234, '导入后金币恢复 -> '+ST.Game.coins);
  assert(ST.totalOf('normal_log') === 8, '导入后物品恢复 -> '+ST.totalOf('normal_log'));

  // 28c. 非法输入被拒绝，且不破坏当前存档
  const coinsBefore = ST.Game.coins;
  const badCases = [['乱码', 'not json'], ['空内容', ''], ['缺字段', '{"coins":10}'], ['数组', '[1,2,3]'], ['null', 'null']];
  badCases.forEach(([label, raw])=>{
    assert(G.importSaveText(raw).ok === false, `拒绝${label}的存档文本`);
  });
  assert(ST.Game.coins === coinsBefore, '失败的导入不影响当前存档 -> '+ST.Game.coins);

  // 28d. 页面入口与弹窗
  G.renderStats();
  assert(context.document.getElementById('content').innerHTML.includes('openSaveIO'), '统计页渲染导出/导入入口');
  G.openSaveIO('export');
  const exportHtml = context.document.getElementById('modalBox').innerHTML;
  assert(exportHtml.includes('saveText') && exportHtml.includes('1234'), '导出弹窗给出可复制的存档文本');
  G.openSaveIO('import');
  assert(context.document.getElementById('modalBox').innerHTML.includes('btnImportSave'), '导入弹窗给出操作按钮');
  if (ST.UI && ST.UI.closeModal) ST.UI.closeModal();

  console.log('PASS: 存档导出/导入（合法 JSON / 往返恢复 / 非法拒绝 / 入口渲染）通过');
}catch(e){
  console.error('FAIL: 存档导出/导入: '+e.message); console.error(e.stack); process.exitCode=1;
}

// ---- 29. 打铁演出与动效强度 ----
try{
  G.resetToDefault();
  // 29a. 无 DOM 环境（无头测试）时安全降级：不抛错也不阻塞逻辑
  assert(ST.Game.fxLevel === 'full', '默认动效强度为完整 -> '+ST.Game.fxLevel);
  assert(ST.UI.forgeShow(ST.Items['bronze_sword'], { heavy:true, emoji:'🔨' }) === false, '无 DOM 环境时打铁演出安全降级');
  assert(ST.FX.forge(ST.Items['runite_sword']) === false, 'FX.forge 拿不到图层时返回 false');
  assert(ST.FX.sparks(null, '#fff', 3) === undefined, 'FX.sparks 在元素缺失时安全返回');

  // 29b. 三档强度：关闭 / 精简 / 完整
  ST.Game.fxLevel = 'off';
  assert(G.fxOff() === true && G.fxHeavy() === false, '关闭档判定正确');
  assert(ST.UI.forgeShow(ST.Items['bronze_sword']) === false, '关闭档不播放演出');
  ST.Game.fxLevel = 'light';
  assert(G.fxOff() === false && G.fxHeavy() === false, '精简档判定正确');
  assert(ST.UI.forgeShow(ST.Items['bronze_sword']) === false, '精简档不播放打铁演出（只飘字）');
  ST.Game.fxLevel = 'full';
  assert(G.fxHeavy() === true, '完整档判定正确');

  // 29c. 演出只是附加：锻造产出照常
  ST.Game.skills.smithing.level = 60;
  const swordRecipe = ST.Recipes.find(r=>r.out==='iron_sword');
  assert(swordRecipe && swordRecipe.type === 'smith', '剑类走 smith 配方 -> '+(swordRecipe&&swordRecipe.type));
  (swordRecipe.cost||[]).forEach(([id,n])=>ST.giveItem(id, (n||1)*4, false));   // 备足原料
  const swordBefore = ST.totalOf('iron_sword');
  ST.Game.activity = { kind:'smith', recipe:swordRecipe, src:'test' };
  G.performAction(ST.Game.activity);
  assert(ST.totalOf('iron_sword') > swordBefore, '锻造仍然产出（演出不干扰逻辑） -> '+ST.totalOf('iron_sword'));
  ST.Game.activity = null;

  // 29d. 档位写入存档并在读档后恢复
  ST.Game.fxLevel = 'light'; G.saveGame();
  const rawFx = JSON.parse(context.localStorage.getItem('melvor_idle_save_v1'));
  assert(rawFx.fxLevel === 'light', '动效档位写入存档 -> '+(rawFx&&rawFx.fxLevel));
  context.localStorage.setItem('melvor_idle_save_v1', JSON.stringify(Object.assign({}, rawFx, { fxLevel:'off' })));
  G.loadGame();
  assert(ST.Game.fxLevel === 'off', '读档恢复动效档位 -> '+ST.Game.fxLevel);
  ST.Game.fxLevel = 'full';

  // 29e. 演出所需样式齐全，且尊重系统「减少动态效果」
  const cssFx = fs.readFileSync(path.join(__dirname,'..','style.css'),'utf8');
  ['.forge-stage','.forge-hammer','.forge-out','.fx-spark','@keyframes hammerSwing','@keyframes sparkFly','@keyframes shakeHard']
    .forEach(sel=>assert(cssFx.includes(sel), `样式包含 ${sel}`));
  assert(cssFx.includes('prefers-reduced-motion: reduce'), '尊重系统的「减少动态效果」设置');

  // 29f. 设置里可切换
  ST.UI.openSettings();
  assert(context.document.getElementById('modalBox').innerHTML.includes('fxLevelSel'), '设置弹窗提供动效强度选项');

  console.log('PASS: 打铁演出与动效强度（降级安全 / 三档 / 不干扰产出 / 存档 / 样式）通过');
}catch(e){
  console.error('FAIL: 打铁演出与动效强度: '+e.message); console.error(e.stack); process.exitCode=1;
}

console.log('\n=== 引擎冒烟测试结束 ===');
