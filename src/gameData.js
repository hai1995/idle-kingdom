// ===== 核心游戏数据定义 =====
// 所有资源、物品、技能、怪物、配方在此定义。

const RARITY = {
  BROKEN:    { name: '破损',    color: '#9e9e9e' },
  COMMON:    { name: '普通',    color: '#ffffff' },
  UNCOMMON:  { name: '罕见',    color: '#4cd964' },
  SPECIAL:   { name: '特殊',    color: '#00e5ff' },
  RARE:      { name: '稀有',    color: '#2979ff' },
  LEGENDARY: { name: '传说',    color: '#ff9100' },
  MYTHIC:    { name: '神话',    color: '#ff2d55' },
};

// ---------- 技能 ----------
const Skills = {
  woodcutting: { id: 'woodcutting', name: '伐木', domain: 'gathering', skill: 1.0, xpReq: 30 },
  mining:      { id: 'mining',   name: '挖矿', domain: 'gathering', skill: 1.0, xpReq: 30 },
  fishing:     { id: 'fishing',  name: '钓鱼', domain: 'gathering', skill: 1.0, xpReq: 30 },
  farming:     { id: 'farming',  name: '农牧', domain: 'gathering', skill: 1.0, xpReq: 30 },
  smithing:    { id: 'smithing', name: '锻造', domain: 'processing', skill: 1.0, xpReq: 30 },
  crafting:    { id: 'crafting', name: '制造', domain: 'processing', skill: 1.0, xpReq: 30 },
  fletching:   { id: 'fletching', name: '弓弩', domain: 'processing', skill: 1.0, xpReq: 30 },
  cooking:     { id: 'cooking',  name: '烹饪', domain: 'processing', skill: 1.0, xpReq: 30 },
  runecrafting:{ id: 'runecrafting', name: '符文', domain: 'processing', skill: 1.0, xpReq: 30 },
  herblore:    { id: 'herblore', name: '炼药', domain: 'processing', skill: 1.0, xpReq: 30 },
  combat:      { id: 'combat',   name: '战斗', domain: 'combat', skill: 1.0, xpReq: 40 },
  attack:      { id: 'attack',   name: '攻击', domain: 'combat', skill: 1.0, xpReq: 40 },
  strength:    { id: 'strength', name: '力量', domain: 'combat', skill: 1.0, xpReq: 40 },
  defence:     { id: 'defence',  name: '防御', domain: 'combat', skill: 1.0, xpReq: 40 },
  ranged:      { id: 'ranged',   name: '远程', domain: 'combat', skill: 1.0, xpReq: 40 },
  magic:       { id: 'magic',    name: '魔法', domain: 'combat', skill: 1.0, xpReq: 40 },
};

// 技能页面分组顺序
const SkillTreeOrder = {
  gathering: ['woodcutting', 'mining', 'fishing', 'farming'],
  processing: ['smithing', 'crafting', 'fletching', 'cooking', 'runecrafting'],
  combat: ['attack', 'strength', 'defence', 'ranged', 'magic', 'combat'],
};

// ---------- 物品 ----------
// item: { id, name, type, icon, desc?, value?, heal?, equip?, edible?, materials? }
// type: 'wood'|'ore'|'bar'|'fish'|'cooked'|'log'|'herb'|'seed'|'crop'|'leather'|'string'|'bow'|'arrow'|'weapon'|'armor'|'food'|'rune'|'essense'|'other'

function I(id, name, type, extra) { return Object.assign({ id, name, type, icon: '⬜' }, extra || {}); }

const Items = {};
function addItem(...defs) { defs.forEach(d => Items[d.id] = d); }

// ---- 伐木 / 木材 ----
addItem(
  I('normal_log', '普通原木', 'wood', { value: 2, xp: 12, tool: 'axe', lvl: 1, icon:'🪵', tree:'普通树木' }),
  I('oak_log', '橡树原木', 'wood', { value: 10, xp: 26, tool: 'axe', lvl: 10, icon:'🌳', tree:'橡树' }),
  I('willow_log', '柳木', 'wood', { value: 20, xp: 48, tool: 'axe', lvl: 20, icon:'🌲', tree:'柳树' }),
  I('maple_log', '枫木', 'wood', { value: 40, xp: 90, tool: 'axe', lvl: 30, icon:'🍁', tree:'枫树' }),
  I('yew_log', '紫杉木', 'wood', { value: 85, xp: 170, tool: 'axe', lvl: 40, icon:'🌲', tree:'紫杉' }),
  I('magic_log', '魔法木', 'wood', { value: 170, xp: 300, tool: 'axe', lvl: 50, icon:'✨', tree:'魔法树' }),
);

// ---- 矿 / 锭 ----
addItem(
  I('copper_ore', '铜矿石', 'ore', { value: 3, xp: 8, tool:'pickaxe', lvl: 1, icon: '🪨' }),
  I('tin_ore', '锡矿石', 'ore', { value: 3, xp: 8, tool:'pickaxe', lvl: 1, icon: '🪨' }),
  I('iron_ore', '铁矿石', 'ore', { value: 12, xp: 18, tool:'pickaxe', lvl: 15, icon: '🪨' }),
  I('coal_ore', '煤矿石', 'ore', { value: 8, xp: 20, tool:'pickaxe', lvl: 10, icon: '⬛' }),
  I('mithril_ore','秘银矿', 'ore', { value: 60, xp: 45, tool:'pickaxe', lvl: 30, icon: '🪨' }),
  I('adamantite_ore','精金矿', 'ore', { value: 130, xp: 80, tool:'pickaxe', lvl: 40, icon: '🪨' }),
  I('runite_ore','符文矿', 'ore', { value: 260, xp: 140, tool:'pickaxe', lvl: 50, icon: '🪨' }),
  I('copper_bar','铜锭', 'bar', { value: 5, xp: 14, icon: '🟠', lvl: 1 }),
  I('bronze_bar','青铜锭', 'bar', { value: 8, xp: 17, icon: '🟤', lvl: 1 }),
  I('iron_bar','铁锭', 'bar', { value: 16, xp: 24, icon: '⚙️', lvl: 15 }),
  I('steel_bar','钢锭', 'bar', { value: 28, xp: 40, icon: '🗡️', lvl: 20 }),
  I('mithril_bar','秘银锭', 'bar', { value: 70, xp: 60, icon: '🔩', lvl: 30 }),
  I('adamantite_bar','精金锭', 'bar', { value: 150, xp: 100, icon: '🔱', lvl: 40 }),
  I('runite_bar','符文锭', 'bar', { value: 300, xp: 160, icon: '🌀', lvl: 50 }),
);

// ---- 钓鱼 / 食材 ----
addItem(
  I('raw_shrimp','生小虾','fish', { value: 3, xp: 10, heal: 30, lvl: 1, icon:'🦐' }),
  I('raw_trout','生鳟鱼','fish', { value: 12, xp: 22, heal: 80, lvl: 10, icon:'🐟' }),
  I('raw_salmon','生鲑鱼','fish', { value: 25, xp: 45, heal: 150, lvl: 20, icon:'🐠' }),
  I('raw_shark','生鲨鱼','fish', { value: 60, xp: 90, heal: 260, lvl: 30, icon:'🦈' }),
  I('raw_great_shark','生巨型鲨','fish', { value: 140, xp: 170, heal: 420, lvl: 40, icon:'🦈' }),
);
// 熟食共享 heal，烹饪后食用
addItem(
  I('shrimp','熟小虾','cooked', { value: 6, xp: 14, heal: 60, lvl: 1, icon:'🍤' }),
  I('trout','烤鳟鱼','cooked', { value: 20, xp: 30, heal: 140, lvl: 10, icon:'🍣' }),
  I('salmon','烤鲑鱼','cooked', { value: 40, xp: 58, heal: 260, lvl: 20, icon:'🍣' }),
  I('shark','烤鲨鱼','cooked', { value: 90, xp: 110, heal: 440, lvl: 30, icon:'🍖' }),
  I('great_shark','烤巨鲨','cooked', { value: 200, xp: 200, heal: 720, lvl: 40, icon:'🍖' }),
);

// ---- 农牧 ----
addItem(
  I('seed_potato','土豆种子','seed', { value: 2, lvl: 1, icon:'🥔', grow: 8, crop:'crop_potato' }),
  I('seed_wheat','小麦种子','seed', { value: 5, lvl: 10, icon:'🌾', grow: 12, crop:'crop_wheat' }),
  I('seed_onion','洋葱种子','seed', { value: 12, lvl: 20, icon:'🧅', grow: 16, crop:'crop_onion' }),
  I('seed_berry','浆果种子','seed', { value: 30, lvl: 30, icon:'🫐', grow: 20, crop:'crop_berry' }),
  I('crop_potato','土豆','crop', { value: 5, lvl: 1, icon:'🥔', xp: 15 }),
  I('crop_wheat','小麦','crop', { value: 12, lvl: 10, icon:'🌾', xp: 30 }),
  I('crop_onion','洋葱','crop', { value: 25, lvl: 20, icon:'🧅', xp: 55 }),
  I('crop_berry','浆果','crop', { value: 50, lvl: 30, icon:'🫐', xp: 110, heal: 120, edible: true }),
  I('leather','皮革','leather', { value: 10, lvl: 1, icon:'🟫' }),
);

// ---- 打怪掉落 ----
addItem(
  I('bones','骨头','other', { value: 2, icon:'🦴' }),
  I('goblin_ear','地精耳朵','other', { value: 10, icon:'👂' }),
  I('wolf_pelt','狼皮','leather', { value: 15, icon:'🐺' }),
  I('eye_of_newt','新特之眼','other', { value: 25, icon:'👁️' }),
  I('slow_potion','迟缓药剂','other', { value: 40, icon:'🧪' }),
  I('dragon_scale','龙鳞','other', { value: 200, icon:'🐉' }),
  I('essense','法力精华','essense', { value: 5, icon:'🟣' }),
);

addItem(
  I('amulet','守护护符','other', { value: 40, equip:true, slot:'amulet', def:1, icon:'📿' }),
);

// ---- 制造原料 ----
addItem(
  I('string','细绳','string', { value: 4, lvl: 1, icon:'🧵' }),
  I('arrow_shaft','箭杆','other', { value: 3, lvl: 1, icon:'🥢' }),
  I('shortbow','短弓','bow', { value: 20, lvl: 1, icon:'🏹', equip:true, weapon:true, dmg: 4, ranged: true }),
  I('longbow','长弓','bow', { value: 45, lvl: 10, icon:'🏹', equip:true, weapon:true, dmg: 8, ranged: true }),
  I('oak_bow','橡木弓','bow', { value: 90, lvl: 20, icon:'🏹', equip:true, weapon:true, dmg: 13, ranged: true }),
  I('willow_bow','柳木弓','bow', { value: 160, lvl: 30, icon:'🏹', equip:true, weapon:true, dmg: 19, ranged: true }),
  I('magic_bow','魔法弓','bow', { value: 340, lvl: 45, icon:'🏹', equip:true, weapon:true, dmg: 30, ranged: true }),
  I('arrow_bronze','青铜箭','arrow', { value: 5, dmg: 2, equip:true, icon:'➶' }),
  I('arrow_iron','铁箭','arrow', { value: 10, dmg: 3, equip:true, icon:'➶' }),
  I('arrow_steel','钢箭','arrow', { value: 18, dmg: 4, equip:true, icon:'➶' }),
  I('arrow_mithril','秘银箭','arrow', { value: 55, dmg: 6, equip:true, icon:'➶' }),
);

// ---- 法杖（魔法战斗使用；伤害走 damageRange，额外受魔法等级加成）----
addItem(
  I('staff_apprentice','学徒法杖','staff', { equip:true, weapon:true, magic:true, dmg:5,  lvl:1,  value:60,  icon:'🪄' }),
  I('staff_adept','术士法杖','staff',  { equip:true, weapon:true, magic:true, dmg:13, lvl:15, value:150, icon:'🪄' }),
  I('staff_mystic','秘法法杖','staff', { equip:true, weapon:true, magic:true, dmg:22, lvl:25, value:340, icon:'⚡' }),
  I('staff_archmage','大法师法杖','staff',{ equip:true, weapon:true, magic:true, dmg:35, lvl:35, value:760, icon:'⚡' }),
);

// ---- 武器 / 防具 ----
const weapons = {
  bronze_sword:  { base: '青铜剑',  dmg: 5,  lvl: 1,  mat_lvl: 1 },
  iron_sword:    { base: '铁剑',    dmg: 9,  lvl: 15, mat_lvl: 15 },
  steel_sword:   { base: '钢剑',    dmg: 14, lvl: 20, mat_lvl: 20 },
  mithril_sword: { base: '秘银剑',  dmg: 22, lvl: 30, mat_lvl: 30 },
  adamant_sword: { base: '精金剑',  dmg: 31, lvl: 40, mat_lvl: 40 },
  runite_sword:  { base: '符文剑',  dmg: 42, lvl: 50, mat_lvl: 50 },
};
for (const key in weapons) {
  const w = weapons[key];
  addItem(I(key, w.base, 'weapon', { value: w.dmg * 14, lvl: w.lvl, equip: true, weapon: true, dmg: w.dmg, smith: key, icon: '🗡️' }));
}
const armors = {
  bronze: { base:'青铜', def: 2, lvl:1, mat_lvl:1 },
  iron:   { base:'铁',   def: 4, lvl:15, mat_lvl:15 },
  steel:  { base:'钢',   def: 7, lvl:20, mat_lvl:20 },
  mithril:{ base:'秘银', def: 12, lvl:30, mat_lvl:30 },
  adamant:{ base:'精金', def: 17, lvl:40, mat_lvl:40 },
  runite: { base:'符文', def: 23, lvl:50, mat_lvl:50 },
};
for (const key in armors) {
  const a = armors[key];
  for (const part of ['helm','body','legs','boots']) {
    const names = { helm:'头盔', body:'胸甲', legs:'腿甲', boots:'战靴' };
    addItem(I(`${key}_${part}`, `${a.base}${names[part]}`, 'armor', {
      value: a.def * 10, lvl: a.lvl, equip: true, armor: true, slot: part, def: a.def, smith: key, icon:'🛡️'
    }));
  }
}

// ---- 符文 ----
addItem(
  I('air_rune','气符文','rune', { value: 4, lvl: 1, icon:'💨', sp: 'Air', place: 6 }),
  I('water_rune','水符文','rune', { value: 4, lvl: 5, icon:'💧', sp: 'Water', place: 6 }),
  I('earth_rune','土符文','rune', { value: 4, lvl: 9, icon:'🟤', sp: 'Earth', place: 6 }),
  I('fire_rune','火符文','rune', { value: 4, lvl: 13, icon:'🔥', sp: 'Fire', place: 9 }),
  I('mind_rune','精神符文','rune', { value: 6, lvl: 17, icon:'🧠', sp: 'Mind', place: 4 }),
  I('chaos_rune','混沌符文','rune', { value: 25, lvl: 30, icon:'🌀', sp: 'Chaos', place: 4 }),
  I('death_rune','死亡符文','rune', { value: 60, lvl: 40, icon:'💀', sp: 'Death', place: 4 }),
  I('nature_rune','自然符文','rune', { value: 8, lvl: 22, icon:'🌿', sp: 'Nature', place: 4 }),
  I('blood_rune','血符文','rune', { value: 120, lvl: 50, icon:'🩸', sp: 'Blood', place: 4 }),
);

// ---------- 配方 ----------
// recipe: { id, type:'smith'|'craft'|'fletch'|'cook'|'rune', out, qty, xp, lvl, cost:[[itemId,qty]], ]
const Recipes = [];
function R(type, out, qty, xp, lvl, cost) {
  Recipes.push({ type, out, qty, xp, lvl, cost });
}
// 锻造
R('smith', 'bronze_bar', 1, 16, 1, [['copper_ore',1],['tin_ore',1]]);
R('smith', 'iron_bar', 1, 24, 15, [['iron_ore',1],['coal_ore',1]]);
R('smith', 'steel_bar', 1, 40, 20, [['iron_ore',1],['coal_ore',2]]);
R('smith', 'mithril_bar', 1, 60, 30, [['mithril_ore',1],['coal_ore',2]]);
R('smith', 'adamantite_bar', 1, 100, 40, [['adamantite_ore',1],['coal_ore',3]]);
R('smith', 'runite_bar', 1, 160, 50, [['runite_ore',1],['coal_ore',4]]);
// 武器 / 防具
const smithParts = ['bronze','iron','steel','mithril','adamant','runite'];
const barMap = { bronze:'bronze_bar', iron:'iron_bar', steel:'steel_bar', mithril:'mithril_bar', adamant:'adamantite_bar', runite:'runite_bar' };
smithParts.forEach(m => {
  const lvl = armors[m].mat_lvl;
  R('smith', `${m}_sword`, 1, Items[`${m}_sword`].dmg * 4 + 30, lvl, [[barMap[m], 1]]);
  R('smith', `${m}_helm`, 1, armors[m].def * 4 + 15, lvl, [[barMap[m], 1]]);
  R('smith', `${m}_body`, 1, armors[m].def * 5 + 25, lvl, [[barMap[m], 2]]);
  R('smith', `${m}_legs`, 1, armors[m].def * 5 + 20, lvl, [[barMap[m], 2]]);
  R('smith', `${m}_boots`, 1, armors[m].def * 3 + 10, lvl, [[barMap[m], 1]]);
});
// 制造
// 皮革 -> 装具（披风等留简单）
// 细绳（用树叶/亚麻）——简化：用羊毛？这里直接用木材
R('craft', 'string', 2, 8, 1, [['normal_log', 1]]);
// ---- 弓弩
R('fletch', 'arrow_shaft', 5, 6, 1, [['normal_log', 1]]);
R('fletch', 'arrow_bronze', 2, 8, 1, [['arrow_shaft',1],['bronze_bar',1]]);
R('fletch', 'arrow_iron', 2, 12, 15, [['arrow_shaft',1],['iron_bar',1]]);
R('fletch', 'arrow_steel', 2, 18, 20, [['arrow_shaft',1],['steel_bar',1]]);
R('fletch', 'arrow_mithril', 2, 30, 30, [['arrow_shaft',1],['mithril_bar',1]]);
R('fletch', 'shortbow', 1, 10, 1, [['normal_log',1],['string',1]]);
R('fletch', 'longbow', 1, 18, 10, [['oak_log',1],['string',2]]);
R('fletch', 'oak_bow', 1, 30, 20, [['willow_log',1],['string',2]]);
R('fletch', 'willow_bow', 1, 55, 30, [['maple_log',1],['string',3]]);
R('fletch', 'magic_bow', 1, 120, 45, [['magic_log',1],['string',4]]);
// ---- 法杖（木料 + 符文 / 精华；魔法系的替代武器）
R('fletch', 'staff_apprentice', 1, 25, 1,  [['normal_log',2],['essense',2]]);
R('fletch', 'staff_adept',      1, 70, 15, [['oak_log',1],['water_rune',2],['string',1]]);
// ---- 烹饪
R('cook', 'shrimp', 1, 14, 1, [['raw_shrimp',1]]);
R('cook', 'trout', 1, 30, 10, [['raw_trout',1]]);
R('cook', 'salmon', 1, 58, 20, [['raw_salmon',1]]);
R('cook', 'shark', 1, 110, 30, [['raw_shark',1]]);
R('cook', 'great_shark', 1, 200, 40, [['raw_great_shark',1]]);
// ---- 符文
R('runecrafting', 'air_rune', 2, 7, 1, [['essense',1]]);
R('runecrafting', 'water_rune', 2, 9, 5, [['essense',1],['air_rune',1]]);
R('runecrafting', 'earth_rune', 2, 10, 9, [['essense',1],['air_rune',1]]);
R('runecrafting', 'fire_rune', 2, 14, 13, [['essense',1],['air_rune',2]]);
R('runecrafting', 'mind_rune', 2, 16, 17, [['essense',1],['air_rune',1]]);
R('runecrafting', 'nature_rune', 2, 22, 22, [['essense',2],['fire_rune',1]]);
R('runecrafting', 'chaos_rune', 1, 60, 30, [['essense',2],['nature_rune',1]]);
R('runecrafting', 'death_rune', 1, 110, 40, [['essense',3],['chaos_rune',1]]);
R('runecrafting', 'blood_rune', 1, 160, 50, [['essense',3],['death_rune',2]]);

// ===== 扩充内容：草本/炼药、Boss、珠宝、高阶装备、里程碑 =====

// ---- 草本（农牧作物产出，用于炼药）----
addItem(
  I('seed_guam','瓜姆草籽','seed', { value: 3, lvl: 1, icon:'🌱', grow: 14, crop:'herb_guam' }),
  I('seed_marrentill','马伦草籽','seed', { value: 12, lvl: 10, icon:'🌱', grow: 20, crop:'herb_marrentill' }),
  I('seed_tarromin','塔罗草籽','seed', { value: 30, lvl: 20, icon:'🌱', grow: 26, crop:'herb_tarromin' }),
  I('seed_ranarr','瑞纳尔籽','seed', { value: 70, lvl: 30, icon:'🌱', grow: 32, crop:'herb_ranarr' }),
  I('seed_snapdragon','龙兰草籽','seed', { value: 160, lvl: 40, icon:'🌱', grow: 40, crop:'herb_snapdragon' }),
  I('herb_guam','瓜姆草','herb', { value: 6, lvl: 1, icon:'🌿', xp: 20 }),
  I('herb_marrentill','马伦草','herb', { value: 15, lvl: 10, icon:'🌿', xp: 35 }),
  I('herb_tarromin','塔罗草','herb', { value: 35, lvl: 20, icon:'🌿', xp: 60 }),
  I('herb_ranarr','瑞纳尔','herb', { value: 80, lvl: 30, icon:'🌿', xp: 120 }),
  I('herb_snapdragon','龙兰草','herb', { value: 180, lvl: 40, icon:'🌿', xp: 200 }),
  I('vial_water','清水瓶','other', { value: 2, icon:'🧪' }),
);

// ---- 药水（炼药产物；buff 效果在 Potions 表中定义）----
addItem(
  I('potion_attack','攻击药剂','potion_boost', { value: 60, consumable:true, drinkable:true, buff:'attack', lvl: 15, icon:'🍷' }),
  I('potion_strength','力量药剂','potion_boost', { value: 80, consumable:true, drinkable:true, buff:'strength', lvl: 25, icon:'🍷' }),
  I('potion_dex','敏捷药剂','potion_boost', { value: 90, consumable:true, drinkable:true, buff:'dexterity', lvl: 35, icon:'🥂' }),
  I('potion_ward','护体药剂','potion_boost', { value: 120, consumable:true, drinkable:true, buff:'defence', lvl: 45, icon:'🫖' }),
  I('potion_flame','烈焰药剂','potion_boost', { value: 170, consumable:true, drinkable:true, buff:'magic', lvl: 50, icon:'♨️' }),
);

// 药水 buff 效果定义（dmg/gather/def 为数值化加成，desc 为展示文本）
const Potions = {
  'potion_attack': { name:'攻击药剂', dur:180, kind:'dmg', dmg:0.40, desc:'伤害 +40%  180s' },
  'potion_strength': { name:'力量药剂', dur:240, kind:'dmg', dmg:0.70, desc:'伤害 +70%  240s' },
  'potion_dex': { name:'敏捷药剂', dur:300, kind:'gather', gather:0.35, desc:'采集速度 +35%  300s' },
  'potion_ward': { name:'护体药剂', dur:240, kind:'def', def:12, desc:'防御 +12  240s' },
  'potion_flame': { name:'烈焰药剂', dur:200, kind:'magic', dmg:1.20, desc:'魔法伤害 +120%  200s' },
};
window.Potions = Potions;

// 炼药配方（type 'herblore'）
R('herblore', 'potion_attack', 1, 40, 15, [['herb_guam',1],['eye_of_newt',1],['vial_water',1]]);
R('herblore', 'potion_strength', 1, 80, 25, [['herb_marrentill',1],['essense',2],['vial_water',1]]);
R('herblore', 'potion_dex', 1, 140, 35, [['herb_tarromin',1],['bones',2],['vial_water',1]]);
R('herblore', 'potion_ward', 1, 200, 45, [['herb_ranarr',1],['essense',3],['vial_water',1]]);
R('herblore', 'potion_flame', 1, 260, 50, [['herb_snapdragon',1],['essense',4],['vial_water',1]]);

// Debuff 物品（沿用已有减速药剂作为可战斗施放的负面药水，略）

// ---- 制造（珠宝）----
addItem(
  I('ring_bronze','青铜指环','ring', { value: 40, equip:true, slot:'ring', dmg:1, lvl:10, icon:'💍' }),
  I('ring_steel','钢指环','ring', { value: 110, equip:true, slot:'ring', dmg:3, lvl:25, icon:'💍' }),
  I('ring_mythril','秘银指环','ring', { value: 220, equip:true, slot:'ring', dmg:5, lvl:35, icon:'💍' }),
  I('ring_runite','符文指环','ring', { value: 420, equip:true, slot:'ring', dmg:8, lvl:50, icon:'💍' }),
  I('ring_dragon','龙之指环','ring', { value: 900, equip:true, slot:'ring', dmg:14, lvl:60, icon:'💍' }),
  I('amulet_topaz','黄玉护符','ring', { value: 80, equip:true, slot:'amulet', def:3, xpBonus:0.04, lvl:20, icon:'📿' }),
  I('amulet_emerald','祖母绿护符','ring', { value: 180, equip:true, slot:'amulet', def:6, xpBonus:0.06, lvl:35, icon:'💚' }),
  I('amulet_ruby','红宝石护符','ring', { value: 380, equip:true, slot:'amulet', def:10, xpBonus:0.10, lvl:50, icon:'❤️' }),
);
R('craft', 'ring_bronze', 1, 60, 10, [['bronze_bar',1],['essense',1]]);
R('craft', 'ring_steel', 1, 120, 25, [['steel_bar',1],['essense',2]]);
R('craft', 'ring_mythril', 1, 220, 35, [['mithril_bar',1],['essense',2]]);
R('craft', 'ring_runite', 1, 340, 50, [['runite_bar',1],['essense',3]]);
R('craft', 'amulet_topaz', 1, 140, 20, [['gold_bar',1],['essense',1]]);
R('craft', 'amulet_emerald', 1, 260, 35, [['gold_bar',1],['essense',2]]);
R('craft', 'amulet_ruby', 1, 400, 50, [['gold_bar',1],['essense',3]]);
// 补充金锭/金矿石（挖矿可采，锻造可炼）
addItem( I('gold_bar','金锭','bar', { value: 60, icon:'🟨', lvl: 20 }) );
addItem( I('gold_ore','金矿石','ore', { value: 40, xp: 60, tool:'pickaxe', lvl: 20, icon:'🪙' }) );
R('smith', 'gold_bar', 1, 55, 20, [['gold_ore',1],['coal_ore',1]]);

// ---- 里程碑（成就被动加成，xp/dmg/gather 为数值化字段）----
const Milestones = [
  { id:'kills_10', name:'猎手之路', desc:'累计击杀 10', check:()=>Game.stats.kills>=10, bonus:'经验 +1%', xp:0.01 },
  { id:'kills_50', name:'屠戮者', desc:'累计击杀 50', check:()=>Game.stats.kills>=50, bonus:'经验 +2%', xp:0.02 },
  { id:'kills_200', name:'百战余生', desc:'累计击杀 200', check:()=>Game.stats.kills>=200, bonus:'经验 +3%', xp:0.03 },
  { id:'boss_1', name:'征服者', desc:'击杀 1 个 Boss', check:()=>Game.stats.bossKills>=1, bonus:'伤害 +5%', dmg:0.05 },
  { id:'skills_20', name:'多面手', desc:'任一技能达 20 级', check:()=>maxSkillLevel()>=20, bonus:'经验 +2%', xp:0.02 },
  { id:'skills_40', name:'资深通才', desc:'任一技能达 40 级', check:()=>maxSkillLevel()>=40, bonus:'经验 +3%', xp:0.03 },
  { id:'money_5000', name:'富甲一方', desc:'历史累计赚取 5000 金币', check:()=>Game.stats.totalEarned>=5000, bonus:'采集 +5%', gather:0.05 },
];
window.Milestones = Milestones;


// 升级路径树：可选目标
const WoodcuttingTrees = ['normal_log','oak_log','willow_log','maple_log','yew_log','magic_log'];
const MiningOres = ['copper_ore','tin_ore','iron_ore','coal_ore','gold_ore','mithril_ore','adamantite_ore','runite_ore'];
const FishingSpots = ['raw_shrimp','raw_trout','raw_salmon','raw_shark','raw_great_shark'];
const FishBait = { raw_trout: ['normal_log'], raw_salmon:['oak_log'], raw_shark:['willow_log'], raw_great_shark:['maple_log'] };

// ---------- 怪物 ----------
// { id, name, hp, atk, def, xp, loot:[[itemId,chance,qty]], source:'combat', requires:null }
const Monsters = {};
function addMonster(m){ Monsters[m.id]=m; }
addMonster({ id:'goblin', name:'地精', hp:12, atk:3, def:1, xp:20, loot:[['goblin_ear',0.5,1],['bones',0.6,1]] });
addMonster({ id:'rock_crab', name:'岩蟹', hp:25, atk:5, def:3, xp:40, loot:[['bones',0.5,1],['copper_ore',0.5,1],['eye_of_newt',0.3,1],['essense',0.3,1]] });
addMonster({ id:'wolf', name:'恶狼', hp:40, atk:7, def:4, xp:70, loot:[['wolf_pelt',0.5,1],['bones',0.7,1],['eye_of_newt',0.2,1]] });
addMonster({ id:'bandit', name:'强盗', hp:55, atk:9, def:5, xp:95, loot:[['bones',0.4,1],['goblin_ear',0.3,1],['essense',0.4,1],['amulet',0.05,1]] });
addMonster({ id:'skeleton', name:'骷髅', hp:90, atk:14, def:8, xp:170, loot:[['bones',0.9,2],['essense',0.6,1],['slow_potion',0.3,1]] });
addMonster({ id:'ogre', name:'食人魔', hp:160, atk:20, def:12, xp:300, loot:[['goblin_ear',0.4,1],['eye_of_newt',0.5,1],['essense',0.8,1]] });
addMonster({ id:'dragon', name:'红龙', hp:300, atk:32, def:18, xp:520, loot:[['dragon_scale',0.5,1],['bones',0.8,2],['essense',1.0,2],['runite_ore',0.2,1]] });

// ---- Boss 敌人（需战斗等级门槛，击败获得大量金币与稀有装备）----
// { boss:true, needLvl, loot, coins, firstReward }
addMonster({ id:'guard_titan', name:'守护巨灵', boss:true, hp:900, atk:45, def:25, xp:2000, needLvl:30,
  loot:[['ring_bronze',0.25,1],['gold_bar',0.5,1],['essense',0.6,2],['bones',0.7,2]], coins:150, firstReward:{coins:500, ring:'ring_bronze'} });
addMonster({ id:'dragon_queen', name:'巨龙女王', boss:true, hp:2200, atk:72, def:40, xp:6500, needLvl:45,
  loot:[['amulet_emerald',0.2,1],['dragon_scale',0.6,2],['runite_ore',0.4,1],['essense',0.8,3]], coins:400, firstReward:{coins:1600, ring:'ring_mythril'} });
addMonster({ id:'elder_lich', name:'远古巫妖', boss:true, hp:5200, atk:115, def:70, xp:16000, needLvl:62,
  loot:[['amulet_ruby',0.25,1],['ring_dragon',0.15,1],['blood_rune',0.4,1],['runite_ore',0.5,2],['bones',0.9,3]], coins:1200, firstReward:{coins:4000, ring:'ring_dragon'} });

// ---------- 商店 ----------
// 商店分类（渲染时按此顺序分组）
const SHOP_CATS = [
  { id:'tool',     icon:'🪓', name:'工具',   desc:'斧与镐，提升采集速度；等级越高替换越好' },
  { id:'ammo',     icon:'➶', name:'弹药',   desc:'箭矢，远程战斗每次攻击消耗 1 支' },
  { id:'food',     icon:'🍖', name:'食物',   desc:'战斗中自动进食，回复生命' },
  { id:'potion',   icon:'🧪', name:'药剂',   desc:'成品药剂，饮用后获得限时增益' },
  { id:'material', icon:'🧬', name:'材料',   desc:'法力精华 / 清水瓶 / 绳索 / 皮革等制作原料' },
  { id:'seed',     icon:'🌱', name:'种子',   desc:'农田种子与炼药草本种子' },
];
// 商店条目：{ itemId, qty, cost, lvl, cat, note }
// 定价规则：cost / qty（单价）必须 ≥ 该物品的回收价 Items[itemId].value，杜绝低买高卖套利
const ShopStock = [
  // 工具
  { itemId:'iron_axe',   qty:1, cost:220,  lvl:15, cat:'tool', note:'伐木加速' },
  { itemId:'steel_axe',  qty:1, cost:560,  lvl:20, cat:'tool' },
  { itemId:'mithril_axe',qty:1, cost:1300, lvl:30, cat:'tool' },
  { itemId:'adamant_axe',qty:1, cost:2800, lvl:40, cat:'tool' },
  { itemId:'runite_axe', qty:1, cost:6400, lvl:50, cat:'tool' },
  { itemId:'iron_pick',  qty:1, cost:220,  lvl:15, cat:'tool', note:'挖矿加速' },
  { itemId:'steel_pick', qty:1, cost:560,  lvl:20, cat:'tool' },
  { itemId:'mithril_pick',qty:1, cost:1300, lvl:30, cat:'tool' },
  { itemId:'adamant_pick',qty:1, cost:2800, lvl:40, cat:'tool' },
  { itemId:'runite_pick', qty:1, cost:6400, lvl:50, cat:'tool' },
  { itemId:'iron_rod',   qty:1, cost:220,  lvl:15, cat:'tool', note:'钓鱼加速' },
  { itemId:'steel_rod',  qty:1, cost:560,  lvl:20, cat:'tool' },
  { itemId:'mithril_rod',qty:1, cost:1300, lvl:30, cat:'tool' },
  { itemId:'adamant_rod',qty:1, cost:2800, lvl:40, cat:'tool' },
  { itemId:'runite_rod', qty:1, cost:6400, lvl:50, cat:'tool' },
  // 弹药
  { itemId:'arrow_bronze',  qty:25, cost:160,  lvl:1,  cat:'ammo' },
  { itemId:'arrow_iron',    qty:25, cost:300,  lvl:15, cat:'ammo' },
  { itemId:'arrow_steel',   qty:25, cost:540,  lvl:20, cat:'ammo' },
  { itemId:'arrow_mithril', qty:25, cost:1550, lvl:30, cat:'ammo' },
  // 食物
  { itemId:'shrimp',  qty:5, cost:40,  lvl:1,  cat:'food', note:'回复 60 生命' },
  { itemId:'trout',   qty:5, cost:120, lvl:10, cat:'food', note:'回复 140 生命' },
  { itemId:'salmon',  qty:5, cost:240, lvl:20, cat:'food', note:'回复 260 生命' },
  { itemId:'shark',   qty:3, cost:330, lvl:30, cat:'food', note:'回复 440 生命' },
  // 药剂
  { itemId:'health_pot',      qty:3, cost:150, lvl:1,  cat:'potion', note:'回复 150 生命' },
  { itemId:'potion_attack',   qty:3, cost:210, lvl:15, cat:'potion', note:'伤害 +40%' },
  { itemId:'potion_strength', qty:3, cost:285, lvl:25, cat:'potion', note:'伤害 +70%' },
  { itemId:'potion_dex',      qty:2, cost:200, lvl:35, cat:'potion', note:'采集 +35%' },
  // 材料
  { itemId:'essense',   qty:10, cost:70,  lvl:1,  cat:'material', note:'符文与珠宝原料' },
  { itemId:'vial_water',qty:10, cost:30,  lvl:1,  cat:'material', note:'炼药必需' },
  { itemId:'string',    qty:20, cost:100, lvl:1,  cat:'material', note:'制弓必需' },
  { itemId:'leather',   qty:10, cost:130, lvl:1,  cat:'material' },
  // 种子
  { itemId:'seed_potato',    qty:3, cost:8,   lvl:1,  cat:'seed' },
  { itemId:'seed_wheat',     qty:3, cost:20,  lvl:10, cat:'seed' },
  { itemId:'seed_onion',     qty:3, cost:42,  lvl:20, cat:'seed' },
  { itemId:'seed_berry',     qty:2, cost:70,  lvl:30, cat:'seed' },
  { itemId:'seed_guam',      qty:3, cost:12,  lvl:1,  cat:'seed', note:'炼药草本' },
  { itemId:'seed_marrentill',qty:3, cost:45,  lvl:10, cat:'seed', note:'炼药草本' },
  { itemId:'seed_tarromin',  qty:3, cost:105, lvl:20, cat:'seed', note:'炼药草本' },
  { itemId:'seed_ranarr',    qty:2, cost:180, lvl:30, cat:'seed', note:'炼药草本' },
  { itemId:'seed_snapdragon',qty:1, cost:220, lvl:40, cat:'seed', note:'炼药草本' },
];
// 工具也用物品表示，便于装备
addItem(
  I('bronze_axe','青铜斧','tool', { equip:true, size:3, axePower:4, lvl:1, icon:'🪓' }),
  I('iron_axe','铁斧','tool', { equip:true, size:3, axePower:8, lvl:15, icon:'🪓', value:200 }),
  I('steel_axe','钢斧','tool', { equip:true, size:3, axePower:15, lvl:20, icon:'🪓', value:500 }),
  I('mithril_axe','秘银斧','tool', { equip:true, size:3, axePower:22, lvl:30, icon:'🪓', value:1200 }),
  I('adamant_axe','精金斧','tool', { equip:true, size:3, axePower:30, lvl:40, icon:'🪓', value:2600 }),
  I('runite_axe','符文斧','tool', { equip:true, size:3, axePower:40, lvl:50, icon:'🪓', value:6000 }),
  I('bronze_pick','青铜镐','tool', { equip:true, size:3, pickPower:4, lvl:1, icon:'⛏️' }),
  I('iron_pick','铁镐','tool', { equip:true, size:3, pickPower:8, lvl:15, icon:'⛏️', value:200 }),
  I('steel_pick','钢镐','tool', { equip:true, size:3, pickPower:15, lvl:20, icon:'⛏️', value:500 }),
  I('mithril_pick','秘银镐','tool', { equip:true, size:3, pickPower:22, lvl:30, icon:'⛏️', value:1200 }),
  I('adamant_pick','精金镐','tool', { equip:true, size:3, pickPower:30, lvl:40, icon:'⛏️', value:2600 }),
  I('runite_pick','符文镐','tool', { equip:true, size:3, pickPower:40, lvl:50, icon:'⛏️', value:6000 }),
  I('bronze_rod','青铜钓竿','tool', { equip:true, size:3, rodPower:4, lvl:1, slot:'rod', icon:'🎣' }),
  I('iron_rod','铁钓竿','tool', { equip:true, size:3, rodPower:8, lvl:15, slot:'rod', icon:'🎣', value:200 }),
  I('steel_rod','钢钓竿','tool', { equip:true, size:3, rodPower:15, lvl:20, slot:'rod', icon:'🎣', value:500 }),
  I('mithril_rod','秘银钓竿','tool', { equip:true, size:3, rodPower:22, lvl:30, slot:'rod', icon:'🎣', value:1200 }),
  I('adamant_rod','精金钓竿','tool', { equip:true, size:3, rodPower:30, lvl:40, slot:'rod', icon:'🎣', value:2600 }),
  I('runite_rod','符文钓竿','tool', { equip:true, size:3, rodPower:40, lvl:50, slot:'rod', icon:'🎣', value:6000 }),
  I('health_pot','治疗药水','potion', { heal:150, value:40, consumable:true, equip:true, icon:'🧴' }),
);
