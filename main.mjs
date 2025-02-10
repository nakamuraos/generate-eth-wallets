/**
 * @since 2024/05/20
 * @author Nakamura <nakamuraos>
 * @description Generate wallets based on random mnemonic phrase with no hope.
 * @copyright (c) 2024 ThinhHV Platform
 */

import "dotenv/config";
import { randomBytes, Wallet, Mnemonic } from "ethers";
import fetch from "node-fetch";
import { Telegraf } from "telegraf";
import { message } from "telegraf/filters";
import { setDefaultResultOrder } from "node:dns";

setDefaultResultOrder("ipv6first");

//========================================
let i = 0;
const CONFIGS = {
  PARALLEL: +process.env.PARALLEL,
  USING_SCAN: Boolean(+process.env.USING_SCAN),
  ETHERSCAN: {
    API_KEY: process.env.ETHERSCAN_API_KEY,
  },
  BSCSCAN: {
    API_KEY: process.env.BSCSCAN_API_KEY,
  },
  TELEGRAM: {
    ENABLE: Boolean(+process.env.TELEGRAM_ENABLE),
    BOT_KEY: process.env.TELEGRAM_BOT_TOKEN,
    CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    SEND_INTERVAL: +(process.env.TELEGRAM_SEND_INTERVAL || 1000),
  },
};
//========================================
const bot = CONFIGS.TELEGRAM.ENABLE
  ? new Telegraf(CONFIGS.TELEGRAM.BOT_KEY)
  : null;

const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const generateWallet = () => {
  const wallet = Wallet.fromPhrase(Mnemonic.entropyToPhrase(randomBytes(16)));
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase,
  };
};

const getBalanceETHscan = async (address) => {
  const controller = new AbortController();
  const signal = controller.signal;
  setTimeout(() => {
    controller.abort();
  }, 3000);
  const res = await fetch(
    `https://api.etherscan.com/api?module=account&action=balance&address=${address}&apikey=${CONFIGS.ETHERSCAN.API_KEY}`,
    { signal }
  ).catch(() => {});
  const data = await res?.json();
  console.log("ETH", data);
  if (!data || data.status !== "1") {
    return 0;
  }
  return +data.result;
};

const getBalanceETH = async (address) => {
  const controller = new AbortController();
  const signal = controller.signal;
  setTimeout(() => {
    controller.abort();
  }, 3000);
  const res = await fetch(`https://rpc.ankr.com/eth`, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
      id: 1,
    }),
    signal,
  }).catch(() => {});
  const data = await res?.json();
  console.log("ETH", data);
  if (!data || !data.result) {
    return 0;
  }
  return Number(data.result);
};

const getBalanceBNBscan = async (address) => {
  const controller = new AbortController();
  const signal = controller.signal;
  setTimeout(() => {
    controller.abort();
  }, 3000);
  const res = await fetch(
    `https://api.bscscan.com/api?module=account&action=balance&address=${address}&apikey=${CONFIGS.BSCSCAN.API_KEY}`,
    { signal }
  ).catch(() => {});
  const data = await res?.json();
  console.log("BNB", data);
  if (!data || data.status !== "1") {
    return 0;
  }
  return +data.result;
};

const getBalanceBNB = async (address) => {
  const controller = new AbortController();
  const signal = controller.signal;
  setTimeout(() => {
    controller.abort();
  }, 3000);
  const res = await fetch(`https://bsc-dataseed1.binance.org/`, {
    method: "POST",
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getBalance",
      params: [address, "latest"],
      id: 1,
    }),
    signal,
  }).catch(() => {});
  const data = await res?.json();
  console.log("BNB", data);
  if (!data || !data.result) {
    return 0;
  }
  return Number(data.result);
};

const initBot = () => {
  bot.start((ctx) => ctx.reply("Welcome"));
  bot.help((ctx) => ctx.reply("Send me a sticker"));
  bot.on(message("text"), (ctx) =>
    ctx.telegram.sendMessage(
      ctx.message.chat.id,
      `[${ctx.message.chat.id}] Current index: ${i}`
    )
  );
  bot.hears("hi", (ctx) => ctx.reply("Hey there"));
  bot.launch(() => {
    console.log("BOT Launched!");
  });
};

const run = async () => {
  const wallet = generateWallet();
  console.log(wallet);
  const [eth, bnb] = await Promise.all(
    CONFIGS.USING_SCAN
      ? [getBalanceETHscan(wallet.address), getBalanceBNBscan(wallet.address)]
      : [getBalanceETH(wallet.address), getBalanceBNB(wallet.address)]
  );
  if (eth > 0 || bnb > 0) {
    console.log("+++++++++++++++++++++");
    console.log({ eth, bnb });
    console.log("+++++++++++++++++++++");
    if (CONFIGS.TELEGRAM.ENABLE) {
      bot.telegram.sendMessage(
        CONFIGS.TELEGRAM.CHAT_ID,
        "```\n" + JSON.stringify({ eth, bnb, wallet }, null, 2) + "```",
        {
          parse_mode: "MarkdownV2",
        }
      );
    }
  }
};

const main = async () => {
  if (CONFIGS.TELEGRAM.ENABLE) {
    initBot();
  }
  await Promise.all(
    Array(CONFIGS.PARALLEL)
      .fill()
      .map(async (_, index) => {
        while (true) {
          if (
            CONFIGS.TELEGRAM.ENABLE &&
            i % CONFIGS.TELEGRAM.SEND_INTERVAL === 0
          ) {
            bot.telegram.sendMessage(
              CONFIGS.TELEGRAM.CHAT_ID,
              `[${CONFIGS.TELEGRAM.CHAT_ID}] Tick-tock: ${i}`
            );
          }
          console.log("=======================================");
          console.log(`>>> ${index + 1}/${i}`);
          console.log("=======================================");
          await run();
          await sleep(800);
          i++;
        }
      })
  );
};

process.once("SIGINT", function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  // some other closing procedures go here
  bot.stop("SIGINT");
  process.exit(0);
});
process.once("SIGTERM", () => {
  bot.stop("SIGTERM");
  process.exit(0);
});

main();
