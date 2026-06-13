const codes = new Map(); 
const usedCodes = new Map(); 
const debts = new Map();
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs'); // Thêm thư viện File System
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

function formatMoney(num) {
  return Math.floor(num).toLocaleString("vi-VN");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = "wew";

// ADMIN
const allowedIDs = [
  "1302541945830375444",
  "1174672220065366049",
  "1314899740114026529",
];

const dataFile = './data.json'; 

// database
const money = new Map();
const cooldown = new Map();
const bankData = new Map();
// Thêm Map để lưu daily
const streakData = new Map();
const dailyCooldown = new Map();

// Hàm Tải Dữ Liệu từ data.json khi khởi động bot
function loadData() {
  if (fs.existsSync(dataFile)) {
    const rawData = fs.readFileSync(dataFile, 'utf-8');
    try {
      const parsedData = JSON.parse(rawData);
      for (const [userId, data] of Object.entries(parsedData)) {
  if (data && typeof data.cash === 'number') {
    money.set(userId, data.cash);
    streakData.set(userId, data.streak || 0);
    dailyCooldown.set(userId, data.nextDaily || 0);

    if (parsedData._codes) {
  for (let code in parsedData._codes) {
    codes.set(code, parsedData._codes[code]);
  }
}

if (parsedData._usedCodes) {
  for (let userId in parsedData._usedCodes) {
    usedCodes.set(userId, parsedData._usedCodes[userId]);
  }
}

    // LOAD NỢ
    if (data.debts) {
      for (let key in data.debts) {
      debts.set(key, data.debts[key]);
      }
    }
  }
      }
      console.log("✅ Đã tải thành công dữ liệu từ data.json!");
    } catch (err) {
      console.log("❌ Lỗi khi đọc file data.json, kiểm tra lại cú pháp JSON!");
    }
  }
}


function saveData() {
  let obj = {};

  for (const [userId, cash] of money.entries()) {
    obj[userId] = { 
      cash: cash,
      streak: streakData.get(userId) || 0,
      nextDaily: dailyCooldown.get(userId) || 0,
      debts: {}
    };
  }

  // LƯU NỢ
  for (const [key, value] of debts.entries()) {
    const [borrower] = key.split("_");

    if (!obj[borrower]) {
      obj[borrower] = {
        cash: 10000,
        streak: 0,
        nextDaily: 0,
        debts: {}
      };
    }

    obj[borrower].debts[key] = value;
  }

  obj["_codes"] = {};
  for (const [code, data] of codes.entries()) {
    obj["_codes"][code] = data;
  }

  obj["_usedCodes"] = {};
  for (const [userId, list] of usedCodes.entries()) {
    obj["_usedCodes"][userId] = list;
  }

  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf-8');
}

// Gọi hàm tải dữ liệu ngay khi chạy code
loadData();

// Tự động lưu mỗi 30 giây (phòng hờ)
setInterval(saveData, 30 * 1000);
// ==========================================

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const data = interaction.customId.split("_");

  // ✅ ĐỒNG Ý
  if (data[0] === "agree") {
    const targetId = data[1];   // người cho vay
    const borrowerId = data[2]; // người vay
    const amount = parseInt(data[3]);

    if (interaction.user.id !== targetId) {
      return interaction.reply({
        content: "Bạn không có quyền bấm nút này 🙂",
        ephemeral: true
      });
    }

    let lenderCash = money.get(targetId) || 10000;
    let borrowerCash = money.get(borrowerId) || 10000;

    if (amount > lenderCash) {
      return interaction.reply({
        content: "❌ Không đủ tiền để cho vay!",
        ephemeral: true
      });
    }

    // chuyển tiền
    money.set(targetId, lenderCash - amount);
    money.set(borrowerId, borrowerCash + amount);

  // GHI NỢ
    let debtKey = `${borrowerId}_${targetId}`;
    let oldDebt = debts.get(debtKey) || 0;
   debts.set(debtKey, oldDebt + amount);

    saveData();

    await interaction.update({
      content: `✅ Đã cho vay **${formatMoney(amount)} xu**`,
      embeds: [],
      components: []
    });
  }

  // ❌ TỪ CHỐI
  if (data[0] === "deny") {
    const targetId = data[1];

    if (interaction.user.id !== targetId) {
      return interaction.reply({
        content: "Không phải chuyện của mày 🙂",
        ephemeral: true
      });
    }

    await interaction.update({
      content: "❌ Đã từ chối cho vay",
      embeds: [],
      components: []
    });
  }
});

// NGÂN HÀNG
const banks = {
  "vpbank": {
    name: "VP Bank",
    aliases: ["vpbank", "vp bank", "vp"],
    interest: 0.07,
    duration: 3 * 24 * 60 * 60 * 1000
  },
  "vietcombank": {
    name: "VietComBank",
    aliases: ["vietcombank", "vietcom bank", "vcb", "vietcom"],
    interest: 0.05,
    duration: 2 * 24 * 60 * 60 * 1000
  }
};

// TÌM NGÂN HÀNG
function findBank(input) {
  input = input.toLowerCase();
  for (let key in banks) {
    let bank = banks[key];
    if (bank.aliases.includes(input)) {
      return key;
    }
  }
  return null;
}

// UPDATE LÃI
function updateBank(userId) {
  if (!bankData.has(userId)) return;

  let data = bankData.get(userId);
  let bank = banks[data.bank];

  if (!bank) return;

  let now = Date.now();
  let passed = now - data.lastUpdate;
  let cycles = Math.floor(passed / bank.duration);

  if (cycles > 0) {
    for (let i = 0; i < cycles; i++) {
      data.amount += data.amount * bank.interest;
    }
    data.lastUpdate += cycles * bank.duration;
    bankData.set(userId, data);
  }
}

client.once("ready", () => {
    console.log(`🤖 Bot đã online với tên ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  
  if (!message.content.toLowerCase().startsWith(PREFIX.toLowerCase())) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift()?.toLowerCase();
  const userId = message.author.id;

  if (!money.has(userId)) {
    money.set(userId, 10000);
    saveData(); 
  }

  // MENU
  if (cmd === "menu") {
    const embed = new EmbedBuilder()
      .setColor("#f5d400")
      .setTitle("🏛️ Các lệnh của WEW")
      .setDescription("Danh sách các lệnh của bot")
      .addFields({
        name: "💰 Lệnh bình thường",
        value:
          "🔹 `wew daily`: nhận phần thưởng mỗi ngày\n" +
          "🔹 `wew xu`: xem số xu có trong ví\n" +
          "🔹 `wew cf <số xu/all>`: cược xu 50/50\n" +
          "🔹 `wew givexu @user <số xu>`: tặng xu cho người khác\n" +
          "🔹 `wew gt <tên ngân hàng> <số xu>`: gửi xu vào ngân hàng\n" +
          "🔹 `wew rt <tên ngân hàng> <số xu>`: rút xu từ ngân hàng\n" +
          "🔹 `wew checknh`: kiểm tra số dư các ngân hàng\n" +
          "🔹 `wew vayxu @user <số xu>`: yêu cầu vay xu từ người khác\n" +
          "🔹 `wew trano @user`: trả nợ cho người vay\n" +
          "🔹 `wew nhapcode <tên code>`: nhập code để nhận xu\n" +
          "🔹 `wew topxu`: xem bảng xếp hạng đại gia trong server\n",
      })
      .addFields({
        name: "👑 ADMIN/OWNER",
        value:
          "🔹 `wew addxu <tên người> <số xu>`: thêm xu cho người khác\n" +
          "🔹 `wew thuxu <tên người> <số xu>`: thu xu từ người khác\n"+
          "🔹 `wew checkxu @user`: kiểm tra số xu của người khác\n" +
          "🔹 `wew addcode <tên code> <số xu> <số lần có thể nhạp>`: thêm code mới\n",
      })
      .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

// LỆNH DAILY 
  if (cmd === "daily") {
    const now = Date.now();
    const nextDailyTime = dailyCooldown.get(userId) || 0;

    // Tính toán thời gian đợi nếu chưa tới ngày mới
    if (now < nextDailyTime) {
      const timeLeft = nextDailyTime - now;
      let h = Math.floor(timeLeft / (1000 * 60 * 60));
      let m = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      let s = Math.floor((timeLeft % (1000 * 60)) / 1000);
      
      return message.reply(`⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`);
    }

    // Lấy thời gian hiện tại theo múi giờ Việt Nam
    const vnTime = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    
    // Đặt mốc thời gian là 0h sáng hôm sau ở VN
    const nextMidnightVn = new Date(vnTime);
    nextMidnightVn.setHours(24, 0, 0, 0); 
    
    // Khoảng thời gian từ hiện tại đến 0h sáng mai (tính bằng ms)
    const diffMs = nextMidnightVn.getTime() - vnTime.getTime();
    const newNextDaily = now + diffMs;

    // +1 chuỗi NGAY TỪ ĐẦU để lần đầu nhận sẽ là chuỗi 1
    let currentStreak = (streakData.get(userId) || 0) + 1;
    let reward = 0;

    // Tính toán phần thưởng theo chuỗi
    if (currentStreak <= 10) {
      reward = Math.floor(Math.random() * (600 - 300 + 1)) + 300;
    } else if (currentStreak <= 30) {
      reward = Math.floor(Math.random() * (900 - 700 + 1)) + 700;
    } else if (currentStreak <= 60) {
      reward = Math.floor(Math.random() * (2000 - 1000 + 1)) + 1000;
    } else { // Chuỗi 61 trở lên
      reward = Math.floor(Math.random() * (3500 - 2100 + 1)) + 2100;
    }

    // Cập nhật Database
    let currentCash = money.get(userId) || 10000;
    money.set(userId, currentCash + reward);
    streakData.set(userId, currentStreak); // Lưu thẳng currentStreak vì đã +1 ở trên
    dailyCooldown.set(userId, newNextDaily);
    saveData(); // Lưu ngay dữ liệu

    // Đổi DiffMs ra giờ, phút, giây để báo cáo cho người chơi
    let h = Math.floor(diffMs / (1000 * 60 * 60));
    let m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    let s = Math.floor((diffMs % (1000 * 60)) / 1000);

    return message.reply(
      `💰 ${message.author.username} đã nhận phần thưởng là ${formatMoney(reward)} xu 💵\n` +
      `🔥 chuỗi hôm nay là: ${currentStreak}\n` +
      `⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận phần thưởng tiếp theo`
    );
  }

// Lệnh Top xu
if (cmd === "topxu") {
  let guild = message.guild;

  if (!guild) return;

  // lấy member trong server
  let members = await guild.members.fetch();

  let list = [];

  members.forEach(member => {
    if (member.user.bot) return;

    let cash = money.get(member.id) || 10000;

    list.push({
      id: member.id,
      name: member.user.username,
      cash: cash
    });
  });

  // sort giảm dần
  list.sort((a, b) => b.cash - a.cash);

  let result = "";
  let rank = 0;
  let lastCash = null;
  let displayCount = 0;

  for (let i = 0; i < list.length; i++) {
    let user = list[i];

    // nếu tiền khác thì tăng rank
    if (user.cash !== lastCash) {
      rank = rank + 1;
    }

    // chỉ lấy top 10
    if (rank > 10) break;

    result += `🏅 Top ${rank}: ${user.name}: **${formatMoney(user.cash)} xu**\n`;

    lastCash = user.cash;
    displayCount++;
  }

  const embed = new EmbedBuilder()
    .setColor("#00e1ff")
    .setTitle("🏆 Bảng Top đại gia nhiều xu nhất:")
    .setDescription(result || "Không có dữ liệu");

  message.reply({ embeds: [embed] });
}

// LỆNH ADD CODE
if (cmd === "addcode") {
  if (!allowedIDs.includes(userId)) {
    return message.reply("❌ Không có quyền dùng lệnh này!");
  }

  let code = args[0];
  let reward = parseInt(args[1]);
  let maxUses = parseInt(args[2]);

  if (!code) return message.reply("⚠️ Thiếu tên code!");
  if (code.includes(" ")) return message.reply("Code không được có khoảng cách!");
  if (isNaN(reward) || reward <= 0) return message.reply("Số xu không hợp lệ!");
  if (isNaN(maxUses) || maxUses <= 0) return message.reply("Số lượt không hợp lệ!");

  if (codes.has(code)) {
    return message.reply("❌ Code này đã tồn tại!");
  }

  // ✅ FIX: bỏ usedCount
  codes.set(code, {
    reward: reward,
    maxUses: maxUses
  });

  saveData();

  const embed = new EmbedBuilder()
    .setColor("#00ff99")
    .setTitle("🎁 Đã thêm Code mới")
    .setDescription(
      `Code: \`${code}\`\n\n` +
      `Số lần nhập tối đa mỗi người: **${maxUses}**`
    );

  message.reply({ embeds: [embed] });
}

// LỆNH NHẬP CODE
if (cmd === "nhapcode") {
  let code = args[0];

  if (!code) return message.reply("⚠️ Nhập code đi má!");

  if (!codes.has(code)) {
    return message.reply("❌ Code không tồn tại!");
  }

  let data = codes.get(code);

  // lấy list code user đã nhập
  let userUsed = usedCodes.get(userId) || [];

  // đếm số lần nhập code này
  let usedCount = userUsed.filter(c => c === code).length;

  // ❌ quá số lần
  if (usedCount >= data.maxUses) {
    return message.reply(`❌ Bạn đã nhập code này tối đa ${data.maxUses} lần rồi!`);
  }

  // cộng tiền
  let cash = money.get(userId) || 10000;
  money.set(userId, cash + data.reward);

  // lưu lịch sử
  userUsed.push(code);
  usedCodes.set(userId, userUsed);

  saveData();

  return message.reply(`🎉 Bạn đã nhận được: **${formatMoney(data.reward)} xu**`);
}

// LỆNH VAY XU
if (cmd === "vayxu") {
  let target = message.mentions.users.first();
  let amount = parseInt(args[1]);

  if (!target) return message.reply("⚠️ Thiếu người cho vay!");
  if (target.id === userId) return message.reply("Tự vay luôn đi cho nhanh 😐");
  if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

  let targetCash = money.get(target.id) || 10000;

  if (amount > targetCash) {
    return message.reply(`❌ Người này không đủ xu! Hiện có: **${formatMoney(targetCash)} xu**`);
  }

  const embed = new EmbedBuilder()
    .setColor("#f5d400")
    .setTitle("📩 Yêu cầu vay xu")
    .setDescription(
      `👤 Người vay: ${message.author}\n` +
      `💰 Số tiền: **${formatMoney(amount)} xu**\n\n` +
      `👉 ${target} hãy bấm nút bên dưới để quyết định`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`agree_${target.id}_${userId}_${amount}`)
      .setLabel("Đồng ý")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${target.id}`)
      .setLabel("Từ chối")
      .setStyle(ButtonStyle.Danger)
  );

  message.reply({ embeds: [embed], components: [row] });
}

if (cmd === "trano") {
  let target = message.mentions.users.first();

  if (!target) return message.reply("⚠️ Thiếu người cần trả nợ!");

  let debtKey = `${userId}_${target.id}`;
  let debt = debts.get(debtKey) || 0;

  // ❌ CASE 1: KHÔNG NỢ
  if (debt <= 0) {
    return message.reply("📭 Bạn đang không nợ họ");
  }

  let cash = money.get(userId) || 0;

  // 💀 CASE 4: KHÔNG CÓ XU
  if (cash <= 0) {
    return message.reply("💀 Bro thậm chí còn không có nổi 1 xu để dùng chứ chi là trả nợ");
  }

  // ✅ CASE 2: TRẢ HẾT
  if (cash >= debt) {
    money.set(userId, cash - debt);
    money.set(target.id, (money.get(target.id) || 10000) + debt);

    debts.delete(debtKey);
    saveData();

    return message.reply(`✅ Bạn đã trả hết nợ cho ${target}`);
  }

  // ⚠️ CASE 3: TRẢ 1 PHẦN
  if (cash < debt) {
    let remaining = debt - cash;

    money.set(target.id, (money.get(target.id) || 10000) + cash);
    money.set(userId, 0);

    debts.set(debtKey, remaining);
    saveData();

    return message.reply(`⚠️ Bạn đã trả 1 phần nợ. Còn thiếu **${formatMoney(remaining)} xu**`);
  }
}

  // CHECK NGÂN HÀNG
  if (cmd === "checknh") {
    updateBank(userId);
    let username = message.author.username;
    let embed = new EmbedBuilder()
      .setColor("#00aaff")
      .setTitle(`🏦 SỔ TIẾT KIỆM TÍN DỤNG: **${username}**`);

    let desc = "";
    for (let key in banks) {
      let bank = banks[key];
      let amount = 0;
      if (bankData.has(userId)) {
        let data = bankData.get(userId);
        if (data.bank === key) {
          amount = data.amount;
        }
      }
      desc += `💵 ${bank.name}\n`;
      desc += `**${formatMoney(amount)} xu** (Lãi ${(bank.interest * 100).toFixed(0)}%/${bank.duration / 86400000} ngày)\n\n`;
    }

    embed.setDescription(desc);
    embed.setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // XEM TIỀN
  if (cmd === "xu") {
    let cash = money.get(userId);
    message.reply(`💰 Số xu trong ví của bạn là: **${formatMoney(cash)} xu**`);
  }

// GỬI NGÂN HÀNG
  if (cmd === "gt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);
    let cash = money.get(userId);

    // Xử lý nhập "all"
    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (amount > cash) {
      return message.reply(`Không đủ xu (${formatMoney(cash)})`);
    }

    updateBank(userId);
    let bank = banks[bankKey];

    if (!bankData.has(userId)) {
      bankData.set(userId, {
        bank: bankKey,
        amount: amount,
        lastUpdate: Date.now()
      });
    } else {
      let data = bankData.get(userId);
      if (data.bank !== bankKey) {
        data.bank = bankKey;
        data.amount = amount;
        data.lastUpdate = Date.now();
      } else {
        data.amount += amount;
      }
      bankData.set(userId, data);
    }

    money.set(userId, cash - amount);
    saveData(); 

    message.reply(
      `**ĐÃ GỬI THÀNH CÔNG:** Bạn đã gửi **${formatMoney(amount)} xu** vào ngân hàng **${bank.name}**`
    );
  }

// RÚT NGÂN HÀNG
  if (cmd === "rt") {
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng cần rút!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (!bankData.has(userId)) return message.reply("Bạn không có xu trong ngân hàng này!");

    updateBank(userId);
    let data = bankData.get(userId);

    if (data.bank !== bankKey) return message.reply("Bạn không có xu trong ngân hàng này!");

    // Xử lý nhập "all" lấy tối đa tiền trong thẻ
    let amountArg = args[args.length - 1]?.toLowerCase();
    let amount = amountArg === "all" ? data.amount : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > data.amount) return message.reply("Không đủ xu trong ngân hàng!");

    data.amount -= amount;

    if (data.amount <= 0) {
      bankData.delete(userId);
    } else {
      bankData.set(userId, data);
    }

    money.set(userId, money.get(userId) + amount);
    saveData(); 

    message.reply(`**ĐÃ RÚT THÀNH CÔNG:** Bạn đã rút **${formatMoney(amount)} xu** khỏi ngân hàng **${banks[bankKey].name}**`);
  }

  // ADD XU
  if (cmd === "addxu" || cmd === "add") {
    if (!allowedIDs.includes(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("⚠️ Thiếu người cần add!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (!money.has(target.id)) money.set(target.id, 10000);

    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Đã thêm **${formatMoney(amount)} xu** cho ${target}`);
  }

// THU XU
  if (cmd === "thuxu" || cmd === "thu") {
    if (!allowedIDs.includes(userId)) return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");

    let target = message.mentions.users.first();
    
    if (!target) return message.reply("⚠️ Thiếu người cần thu!");

    let current = money.get(target.id) || 10000;

    // Xử lý nhập "all" để tịch thu toàn bộ
    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? current : parseInt(amountArg);

    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (amount > current) return message.reply("Không đủ xu để thu!");

    money.set(target.id, current - amount);
    saveData(); 

    message.reply(`Đã thu **${formatMoney(amount)} xu** từ ${target}`);
  }
  
  // CHECK XU NGƯỜI KHÁC
  if (cmd === "checkxu") {
    if (!allowedIDs.includes(userId)) {
      return message.reply("❌ Bạn không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();

    if (!target) {
      return message.reply("⚠️ Thiếu tên người cần check!");
    }

    let targetCash = money.get(target.id);
    if (targetCash === undefined) {
      targetCash = 10000;
    }

    message.reply(`🔍 Số xu hiện tại của **${target.username}** là: **${formatMoney(targetCash)} xu**`);
  }

  // CƯỢC
  else if (cmd === "cf") {
    let betArg = args[0];
    let cash = money.get(userId);
    let now = Date.now();
    let cd = cooldown.get(userId) || 0;

    if (now < cd) {
      let t = Math.floor(cd / 1000);
      let timeLeft = cd - now;
      let warningMsg = await message.reply(`⏱ Cần đợi thêm <t:${t}:R> để cược tiếp!`);
      setTimeout(() => {
        warningMsg.delete().catch(() => {}); 
      }, timeLeft);
      return; 
    }

    let bet = betArg === "all" ? cash : parseInt(betArg);

    if (!betArg) return message.reply("⚠️ Thiếu số xu muốn cược!");
    if (isNaN(bet) || bet <= 0) return message.reply("Số xu không hợp lệ!");
    if (bet > cash) return message.reply("Không đủ xu để cược!");

    cooldown.set(userId, now + 10000);

    let msg = await message.reply("🎲 Kết quả cược của bạn là.");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là..");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là...");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là.");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là..");
    await new Promise(r => setTimeout(r, 500));
    await msg.edit("🎲 kết quả cược của bạn là...");
    await new Promise(r => setTimeout(r, 500));

    let win = Math.random() < 0.6; 

    if (win) {
      money.set(userId, cash + bet);
      saveData(); 
      return msg.edit(`🎉 Chúc mừng thắng lớn, đã nhận về **${formatMoney(bet * 2)} xu**!`);
    } else {
      money.set(userId, cash - bet);
      saveData(); 
      return msg.edit(`❌ Đã cược **${formatMoney(bet)} xu** và mất tất cả`);
    }
  }

// GIVE
  if (cmd === "givexu" || cmd === "give") {
    let target = message.mentions.users.first();
    let cash = money.get(userId);

    // Xử lý nhập "all"
    let amountArg = args[1]?.toLowerCase();
    let amount = amountArg === "all" ? cash : parseInt(amountArg);

    if (!target) return message.reply("⚠️ Thiếu tên người cần chuyển!");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính bản thân!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (amount > cash) {
      return message.reply(`Số xu của bạn không đủ! Bạn có **${formatMoney(cash)} xu**`);
    }

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(userId, cash - amount);
    money.set(target.id, money.get(target.id) + amount);
    saveData(); 

    message.reply(`Bạn đã chuyển **${formatMoney(amount)} xu** cho ${target}`);
  }

});

client.login(process.env.TOKEN);