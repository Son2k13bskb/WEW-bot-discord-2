const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

function formatMoney(num) {
  return Math.floor(num).toLocaleString("vi-VN");
}



const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

// ==========================================
// CẤU HÌNH LƯU DỮ LIỆU BẰNG VOLUME RAILWAY
// ==========================================
// Thay '/app/data' bằng Mount Path bạn đã cài đặt trong Volume trên Railway
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/data';
const moneyFile = path.join(DATA_DIR, 'money.json');
const bankDataFile = path.join(DATA_DIR, 'bankData.json');

const PREFIX = "wew";

// ADMIN
const allowedIDs = [
  "1302541945830375444",
  "1174672220065366049",
];

// database
const money = new Map();
const cooldown = new Map();
const bankData = new Map();

// ==========================================
// HÀM TẢI & LƯU DỮ LIỆU
// ==========================================
function loadData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  // Tải dữ liệu tiền trong ví
  if (fs.existsSync(moneyFile)) {
    const rawMoney = fs.readFileSync(moneyFile, 'utf-8');
    const parsedMoney = JSON.parse(rawMoney);
    for (const [key, value] of Object.entries(parsedMoney)) {
      money.set(key, value);
    }
  }

  // Tải dữ liệu ngân hàng
  if (fs.existsSync(bankDataFile)) {
    const rawBank = fs.readFileSync(bankDataFile, 'utf-8');
    const parsedBank = JSON.parse(rawBank);
    for (const [key, value] of Object.entries(parsedBank)) {
      bankData.set(key, value);
    }
  }
  console.log("✅ Đã tải xong dữ liệu từ Volume!");
}

function saveData() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  // Chuyển Map thành Object để lưu thành JSON
  fs.writeFileSync(moneyFile, JSON.stringify(Object.fromEntries(money), null, 2), 'utf-8');
  fs.writeFileSync(bankDataFile, JSON.stringify(Object.fromEntries(bankData), null, 2), 'utf-8');
}

// Gọi hàm tải dữ liệu ngay khi khởi chạy code
loadData();

// Tự động lưu dữ liệu sau mỗi 30 giây
setInterval(() => {
  saveData();
}, 30 * 1000); 

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
    duration: 3 * 24 * 60 * 60 * 1000
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
    
    // Lưu ngay khi cập nhật lãi suất
    saveData();
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
    saveData(); // Lưu ngay khi tạo acc mới
  }

  // MENU

  if (cmd === "menu") {
    const embed = new EmbedBuilder()
      .setColor("#f5d400")
      .setTitle("🏛️ Các lệnh của WEW")
      .setDescription("Danh sách các lệnh hiện có của bot")

      .addFields({
        name: "💰 Lệnh bình thường",
        value:
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
          "🔹 `wew thuxu <tên người> <số xu>`: thu xu từ người khác\n",
      })

      .setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // CHECK NGÂN HÀNG
  if (cmd === "checknh") {
    updateBank(userId);

    let username = message.author.username;
    let embed = new EmbedBuilder()
      .setColor("#00ff26")
      .setTitle(`🏦 SỔ TIẾT KIỆM TÍN DỤNG: ${username}`);

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

      desc += `🏦 ${bank.name}\n`;
      desc += `${formatMoney(amount)} Xu (Lãi ${(bank.interest * 100).toFixed(0)}%/${bank.duration / 86400000} ngày)\n\n`;
    }

    embed.setDescription(desc);
    embed.setFooter({ text: "WEW BOT ● MADE BY CAUBEVOTRI" });

    return message.reply({ embeds: [embed] });
  }

  // XEM TIỀN (Đã bỏ thông tin ngân hàng như bạn yêu cầu ở tin nhắn trước)
  if (cmd === "xu") {

    let cash = money.get(userId);

    message.reply(`💰 Số xu trong ví của bạn là: ${formatMoney(cash)} xu`);
  }


  // GỬI NGÂN HÀNG

  if (cmd === "gt") {
    let amount = parseInt(args[args.length - 1]);
    let bankInput = args.slice(0, -1).join(" ");

    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("Thiếu tên ngân hàng!");
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
    saveData(); // LƯU DỮ LIỆU LẬP TỨC

    message.reply(
      `**ĐÃ GỬI THÀNH CÔNG** Bạn đã gửi ${formatMoney(amount)} vào ${bank.name}\n📈 ${(bank.interest * 100).toFixed(0)}% / ${bank.duration / 86400000} ngày`
    );
  }

  // RÚT NGÂN HÀNG
  if (cmd === "rt") {
    let amount = parseInt(args[args.length - 1]);
    let bankInput = args.slice(0, -1).join(" ");
    let bankKey = findBank(bankInput);

    if (!bankInput) return message.reply("Thiếu tên ngân hàng cần rút!");
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
    saveData(); // LƯU DỮ LIỆU LẬP TỨC

    message.reply(`**ĐÃ RÚT THÀNH CÔNG** Bạn đã rút ${formatMoney(amount)} xu từ ${banks[bankKey].name}`);
  }

  // ADD XU

  if (cmd === "addxu" || cmd === "add") {
    if (!allowedIDs.includes(userId)) {
      return message.reply("Không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu người cần add!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(target.id, money.get(target.id) + amount);
    saveData(); // LƯU DỮ LIỆU LẬP TỨC

    message.reply(`Đã thêm ${formatMoney(amount)} xu cho ${target}`);
  }


  // THU XU

  if (cmd === "thuxu" || cmd === "thu") {
    if (!allowedIDs.includes(userId)) {
      return message.reply("Không có quyền sử dụng lệnh này!");
    }

    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu người cần thu!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let current = money.get(target.id) || 10000;

    if (amount > current) return message.reply("Không đủ xu để thu!");

    money.set(target.id, current - amount);
    saveData(); // LƯU DỮ LIỆU LẬP TỨC

    message.reply(`Đã thu ${formatMoney(amount)} xu từ ${target}`);
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
      let warningMsg = await message.reply(`⏱ Cần đợi <t:${t}:R> để cược tiếp!`);

      
      setTimeout(() => {

        warningMsg.delete().catch(() => {}); 
      }, timeLeft);


      return; 
    }

    let bet = betArg === "all" ? cash : parseInt(betArg);

    if (!betArg) return message.reply("Thiếu số xu muốn cược!");
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

    let win = Math.random() < 0.6; // 60% cơ hội thắng

    if (win) {
      money.set(userId, cash + bet);
      saveData();
      return msg.edit(`🎉 Chúc mừng thắng lớn, bạn đã nhận thêm ${formatMoney(bet)} xu!`);
    } else {
      money.set(userId, cash - bet);
      saveData();
      return msg.edit(`❌ Bạn đã cược ${formatMoney(bet)} xu và mất tất cả`);
    }
  }


  // GIVE

  if (cmd === "givexu" || cmd === "give") {
    let target = message.mentions.users.first();
    let amount = parseInt(args[1]);

    if (!target) return message.reply("Thiếu tên người cần chuyển!");
    if (target.id === userId) return message.reply("Không thể chuyển cho chính bản thân!");
    if (isNaN(amount) || amount <= 0) return message.reply("Số xu không hợp lệ!");

    let cash = money.get(userId);

    if (amount > cash) {
      return message.reply(`Bạn chỉ có ${formatMoney(cash)} xu`);
    }

    if (!money.has(target.id)) {
      money.set(target.id, 10000);
    }

    money.set(userId, cash - amount);
    money.set(target.id, money.get(target.id) + amount);
    saveData(); // LƯU DỮ LIỆU LẬP TỨC

    message.reply(`Bạn đã gửi ${formatMoney(amount)} xu cho ${target}`);
  }

});

client.login(process.env.TOKEN);