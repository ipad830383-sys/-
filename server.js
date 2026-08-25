const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

const START_CASH = 1000000;
const ROUND_SECONDS = 180;

const initialPrices = {
  NOVA: 42000,
  GREEN: 31500,
  PIXEL: 18700,
  WAVE: 52900,
  MINT: 24100
};

const companyNames = {
  NOVA: "노바테크",
  GREEN: "그린바이오",
  PIXEL: "픽셀랩",
  WAVE: "웨이브모빌",
  MINT: "민트푸드"
};

let prices = { ...initialPrices };
let seconds = ROUND_SECONDS;
let status = "waiting";

const players = new Map();
const admins = new Set();

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

function getPlayerView(player) {
  let stockValue = 0;

  for (const id of Object.keys(player.holdings)) {
    stockValue +=
      (player.holdings[id] || 0) * (prices[id] || 0);
  }

  const assets = player.cash + stockValue;

  return {
    id: player.id,
    name: player.name,
    cash: Math.round(player.cash),
    holdings: player.holdings,
    stockValue: Math.round(stockValue),
    assets: Math.round(assets),
    returnRate: ((assets / START_CASH) - 1) * 100
  };
}

function getState() {
  const leaderboard = [...players.values()]
    .map(getPlayerView)
    .sort((a, b) => b.assets - a.assets)
    .map((player, index) => ({
      rank: index + 1,
      ...player
    }));

  return {
    prices,
    companyNames,
    seconds,
    status,
    leaderboard,
    playerCount: players.size
  };
}

function broadcast() {
  io.emit("state", getState());
}

function resetGame() {
  prices = { ...initialPrices };
  seconds = ROUND_SECONDS;
  status = "waiting";
  players.clear();
}

function changePrices() {
  for (const id of Object.keys(prices)) {
    const change = Math.random() * 0.16 - 0.08;

    prices[id] = Math.max(
      1000,
      Math.round(
        prices[id] * (1 + change) / 100
      ) * 100
    );
  }
}

function makeCSV() {
  const rows = [
    [
      "순위",
      "닉네임",
      "현금",
      "보유주식 평가액",
      "총자산",
      "수익률"
    ]
  ];

  getState().leaderboard.forEach(player => {
    rows.push([
      player.rank,
      player.name,
      player.cash,
      player.stockValue,
      player.assets,
      player.returnRate.toFixed(2) + "%"
    ]);
  });

  return (
    "\uFEFF" +
    rows
      .map(row =>
        row
          .map(value =>
            `"${String(value).replaceAll('"', '""')}"`
          )
          .join(",")
      )
      .join("\n")
  );
}

app.get("/api/results.csv", (req, res) => {
  const socketId = req.query.socketId;

  if (!admins.has(socketId)) {
    return res
      .status(403)
      .send("관리자 권한이 필요합니다.");
  }

  res.setHeader(
    "Content-Type",
    "text/csv; charset=utf-8"
  );

  res.setHeader(
    "Content-Disposition",
    'attachment; filename="kkumteul-final-results.csv"'
  );

  res.send(makeCSV());
});

setInterval(() => {
  if (status !== "running") return;

  seconds--;

  if (seconds <= 0) {
    changePrices();
    seconds = ROUND_SECONDS;
  }

  broadcast();
}, 1000);

io.on("connection", socket => {

  socket.emit("state", getState());

  // 참가
  socket.on("join", rawName => {
    const name = String(rawName || "")
      .trim()
      .slice(0, 20);

    if (!name) {
      return socket.emit(
        "errorMsg",
        "닉네임을 입력해 주세요."
      );
    }

    if (status === "finished") {
      return socket.emit(
        "errorMsg",
        "게임이 종료되었습니다."
      );
    }

    if (players.has(socket.id)) {
      return socket.emit(
        "errorMsg",
        "이미 참가 중입니다."
      );
    }

    players.set(socket.id, {
      id: socket.id,
      name,
      cash: START_CASH,
      holdings: {}
    });

    socket.emit("joined");
    broadcast();
  });

  // 관리자 로그인
  socket.on("adminLogin", password => {

    if (String(password || "") !== ADMIN_PASSWORD) {
      return socket.emit(
        "errorMsg",
        "관리자 비밀번호가 올바르지 않습니다."
      );
    }

    admins.add(socket.id);

    socket.emit("adminAuth");
  });

  // 게임 시작
  socket.on("adminStart", () => {

    if (!admins.has(socket.id)) {
      return socket.emit(
        "errorMsg",
        "관리자 권한이 필요합니다."
      );
    }

    if (status === "finished") {
      return socket.emit(
        "errorMsg",
        "게임 종료 후에는 초기화해야 합니다."
      );
    }

    status = "running";
    seconds = ROUND_SECONDS;

    broadcast();
  });

  // 게임 종료
  socket.on("adminStop", () => {

    if (!admins.has(socket.id)) {
      return socket.emit(
        "errorMsg",
        "관리자 권한이 필요합니다."
      );
    }

    status = "finished";

    broadcast();
  });

  // 전체 초기화
  socket.on("adminReset", () => {

    if (!admins.has(socket.id)) {
      return socket.emit(
        "errorMsg",
        "관리자 권한이 필요합니다."
      );
    }

    resetGame();

    broadcast();
  });

  // 매수 / 매도
  socket.on("trade", data => {

    const player = players.get(socket.id);

    if (!player) {
      return socket.emit(
        "errorMsg",
        "먼저 참가해 주세요."
      );
    }

    if (status !== "running") {
      return socket.emit(
        "errorMsg",
        "게임이 시작된 뒤 거래할 수 있습니다."
      );
    }

    const id = String(data?.id || "");
    const side = data?.side;
    const quantity = Number(data?.qty);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return socket.emit(
        "errorMsg",
        "수량을 확인해 주세요."
      );
    }

    if (
      !prices[id] ||
      !["buy", "sell"].includes(side)
    ) {
      return;
    }

    const total = prices[id] * quantity;

    // 매수
    if (side === "buy") {

      if (total > player.cash) {
        return socket.emit(
          "errorMsg",
          "현금이 부족합니다."
        );
      }

      player.cash -= total;

      player.holdings[id] =
        (player.holdings[id] || 0) + quantity;
    }

    // 매도
    if (side === "sell") {

      const owned =
        player.holdings[id] || 0;

      if (owned < quantity) {
        return socket.emit(
          "errorMsg",
          "보유 수량이 부족합니다."
        );
      }

      player.cash += total;

      player.holdings[id] =
        owned - quantity;
    }

    broadcast();
  });

  socket.on("disconnect", () => {
    admins.delete(socket.id);
    players.delete(socket.id);

    broadcast();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Mock stock server running on port ${PORT}`
  );
});
