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
];

// ==========================================
// CẤU HÌNH LƯU FILE DATA.JSON
// ==========================================
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
          // Tải thêm dữ liệu daily
          streakData.set(userId, data.streak || 0);
          dailyCooldown.set(userId, data.nextDaily || 0);
        }
      }
      console.log("✅ Đã tải thành công dữ liệu từ data.json!");
    } catch (err) {
      console.log("❌ Lỗi khi đọc file data.json, kiểm tra lại cú pháp JSON!");
    }
  }
}

// Hàm Lưu Dữ Liệu vào data.json
function saveData() {
  let obj = {};
  for (const [userId, cash] of money.entries()) {
    obj[userId] = { 
      cash: cash,
      streak: streakData.get(userId) || 0,
      nextDaily: dailyCooldown.get(userId) || 0
    };
  }
  fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf-8');
}

// Gọi hàm tải dữ liệu ngay khi chạy code
loadData();

// Tự động lưu mỗi 30 giây (phòng hờ)
setInterval(saveData, 30 * 1000);
// ==========================================


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
          "🔹 `wew checknh`: kiểm tra số dư các ngân hàng\n" ,
      })
      .addFields({
        name: "👑 ADMIN/OWNER",
        value:
          "🔹 `wew addxu <tên người> <số xu>`: thêm xu cho người khác\n" +
          "🔹 `wew thuxu <tên người> <số xu>`: thu xu từ người khác\n"+
          "🔹 `wew checkxu @user`: kiểm tra số xu của người khác\n",
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
      
      return message.reply(`⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận tiếp chuỗi`);
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
      `⏱️ Cần đợi ${h}H ${m}M ${s}S để nhận tiếp phần thưởng`
    );
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
    let amount = parseInt(args[args.length - 1]);
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let cash = money.get(userId);
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
      `**ĐÃ GỬI THÀNH CÔNG:** Bạn đã gửi **${formatMoney(amount)} xu** vào ngân hàng **${bank.name}**`);
  }

  // RÚT NGÂN HÀNG
  if (cmd === "rt") {
    let amount = parseInt(args[args.length - 1]);
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("⚠️ Thiếu tên ngân hàng cần rút!");
    if (!bankKey) return message.reply("Ngân hàng không tồn tại!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");
    if (!bankData.has(userId)) return message.reply("Bạn không có xu trong ngân hàng này!");

    updateBank(userId);
    let data = bankData.get(userId);

    if (data.bank !== bankKey) return message.reply("Bạn không có xu trong ngân hàng này!");
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
    let amount = parseInt(args[1]);

    if (!target) return message.reply("⚠️ Thiếu người cần thu!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let current = money.get(target.id) || 10000;
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
    let amount = parseInt(args[1]);

    if (!target) return message.reply("⚠️ Thiếu tên người cần chuyển!");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính bản thân!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let cash = money.get(userId);
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