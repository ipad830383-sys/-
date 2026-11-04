const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-me";

const START_CASH = 300000;
const FIRST_ROUND_SECONDS = 120;
const ROUND_SECONDS = 90;
const MAX_QUANTITY = 10000;

const initialPrices = {
  NOVA: 42000,
  GREEN: 31500,
  PIXEL: 18700,
  WAVE: 52900,
  MINT: 24100,
  ROBOT: 73400,
  SPACE: 45200,
  MEDI: 36800,
  ECO: 28500,
  FIN: 61000,
  MEDIA: 22300,
  HOME: 39600
};

const companyNames = {
  NOVA: "노바테크",
  GREEN: "그린바이오",
  PIXEL: "픽셀랩",
  WAVE: "웨이브모빌",
  MINT: "민트푸드",
  ROBOT: "로보웍스",
  SPACE: "스페이스원",
  MEDI: "메디큐어",
  ECO: "에코파워",
  FIN: "핀테크원",
  MEDIA: "미디어픽",
  HOME: "홈넥스트"
};

const economyNews = [
  {
    title: "소비 심리 회복 조짐",
    description: "소비자 지출이 늘어나며 내수 기업의 실적 개선 기대가 커지고 있습니다.",
    sentiment: 1
  },
  {
    title: "기준금리 인하 기대 확대",
    description: "시장에서는 금리 부담 완화가 기업 투자와 소비에 긍정적으로 작용할 것이라는 전망이 나옵니다.",
    sentiment: 1
  },
  {
    title: "수출 증가세 지속",
    description: "주요 산업의 수출 실적이 개선되며 국내 경기 회복에 대한 기대가 높아지고 있습니다.",
    sentiment: 1
  },
  {
    title: "물가 상승 압력 확대",
    description: "원자재와 생활필수품 가격이 오르면서 기업의 비용 부담이 커질 수 있다는 분석입니다.",
    sentiment: -1
  },
  {
    title: "금리 인상 가능성 부각",
    description: "금융시장에서는 금리 부담이 커질 경우 기업 투자와 소비가 위축될 수 있다는 우려가 나옵니다.",
    sentiment: -1
  },
  {
    title: "경기 둔화 우려 확산",
    description: "소비와 생산 지표가 약해지면서 기업들의 향후 실적에 대한 불확실성이 커지고 있습니다.",
    sentiment: -1
  },
  {
    title: "금융시장 안정세 유지",
    description: "주요 경제 지표가 시장 예상에 부합하면서 투자자들은 관망세를 보이고 있습니다.",
    sentiment: 0
  },
  {
    title: "정부, 산업 지원 정책 검토",
    description: "정부가 주요 산업의 경쟁력 강화를 위한 지원 방안을 검토하고 있습니다.",
    sentiment: 0
  }
];

const companyNews = [
  {
    title: "신제품 출시 기대감 확대",
    description: "신제품 개발 소식이 알려지면서 향후 매출 성장에 대한 기대가 높아지고 있습니다.",
    sentiment: 1
  },
  {
    title: "대형 공급 계약 체결",
    description: "새로운 공급 계약을 체결했다는 소식에 안정적인 매출 확보 전망이 나오고 있습니다.",
    sentiment: 1
  },
  {
    title: "분기 실적 개선",
    description: "최근 실적이 시장 기대를 웃돌면서 투자자들의 관심이 집중되고 있습니다.",
    sentiment: 1
  },
  {
    title: "해외 시장 진출 추진",
    description: "해외 시장 진출 계획이 공개되면서 새로운 성장 동력을 확보할 수 있을지 주목됩니다.",
    sentiment: 1
  },
  {
    title: "생산 비용 증가 우려",
    description: "원자재 가격과 운영 비용이 상승하면서 수익성 악화 가능성이 제기되고 있습니다.",
    sentiment: -1
  },
  {
    title: "주요 사업 일정 지연",
    description: "사업 일정이 예상보다 늦어지면서 향후 실적에 대한 우려가 커지고 있습니다.",
    sentiment: -1
  },
  {
    title: "분기 실적 예상치 하회",
    description: "매출과 영업이익이 시장 예상에 미치지 못하면서 투자 심리가 위축되고 있습니다.",
    sentiment: -1
  },
  {
    title: "경쟁 심화로 시장 점유율 부담",
    description: "경쟁 업체의 시장 진입이 늘어나면서 기존 사업의 수익성에 관심이 쏠리고 있습니다.",
    sentiment: -1
  },
  {
    title: "신규 협력 관계 발표",
    description: "사업 경쟁력 강화를 위한 협력 관계를 발표했으며 구체적인 성과는 추후 공개될 예정입니다.",
    sentiment: 0
  },
  {
    title: "신규 사업 계획 검토",
    description: "회사가 새로운 사업 기회를 검토하고 있다는 소식이 전해졌습니다.",
    sentiment: 0
  }
];

let prices = { ...initialPrices };
let previousPrices = { ...initialPrices };

let seconds = FIRST_ROUND_SECONDS;
let status = "waiting";

let news = [];
let newsSequence = 0;

let latestNewsImpact = {
  market: 0,
  stocks: {}
};

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
    holdings: { ...player.holdings },
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
    prices: { ...prices },
    previousPrices: { ...previousPrices },
    companyNames,
    seconds,
    status,
    leaderboard,
    playerCount: players.size,
    news: news.slice(0, 10)
  };
}

function broadcast() {
  io.emit("state", getState());
}

function resetGame() {
  prices = { ...initialPrices };
  previousPrices = { ...initialPrices };
  seconds = FIRST_ROUND_SECONDS;
  status = "waiting";

  news = [];
  newsSequence = 0;

  latestNewsImpact = {
    market: 0,
    stocks: {}
  };

  players.clear();
}

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function generateNews() {
  const isEconomyNews = Math.random() < 0.35;

  let item;
  let category;
  let target = null;
  let title;
  let description;

  if (isEconomyNews) {
    item = randomItem(economyNews);
    category = "경제";

    title = item.title;
    description = item.description;

    latestNewsImpact.market = item.sentiment * 0.015;
  } else {
    const id = randomItem(Object.keys(companyNames));
    item = randomItem(companyNews);

    category = "기업";
    target = id;

    title = `${companyNames[id]}, ${item.title}`;
    description = item.description;

    latestNewsImpact.stocks[id] =
      item.sentiment * 0.045;
  }

  const createdAt = new Date().toLocaleTimeString(
    "ko-KR",
    {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    }
  );

  news.unshift({
    id: ++newsSequence,
    category,
    target,
    title,
    description,
    sentiment: item.sentiment,
    time: createdAt
  });

  if (news.length > 20) {
    news.length = 20;
  }
}

function changePrices() {
  previousPrices = { ...prices };

  for (const id of Object.keys(prices)) {
    const randomChange = Math.random() * 0.40 - 0.20;

    const newsImpact =
      latestNewsImpact.market +
      (latestNewsImpact.stocks[id] || 0);

    const totalChange = Math.max(
      -0.22,
      Math.min(0.22, randomChange + newsImpact)
    );

    prices[id] = Math.max(
      1000,
      Math.round(
        prices[id] * (1 + totalChange) / 100
      ) * 100
    );
  }

  latestNewsImpact = {
    market: 0,
    stocks: {}
  };
}

function makeCSV() {
  const rows = [
    ["순위", "닉네임", "현금", "보유주식 평가액", "총자산", "수익률"]
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
    return res.status(403).send("관리자 권한이 필요합니다.");
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
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
    generateNews();
    seconds = ROUND_SECONDS;
  }

  broadcast();
}, 1000);

io.on("connection", socket => {
  socket.emit("state", getState());

  socket.on("join", rawName => {
    const name = String(rawName || "").trim().slice(0, 20);

    if (!name) {
      return socket.emit("errorMsg", "닉네임을 입력해 주세요.");
    }

    if (status === "finished") {
      return socket.emit("errorMsg", "게임이 종료되었습니다.");
    }

    if (players.has(socket.id)) {
      return socket.emit("errorMsg", "이미 참가 중입니다.");
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

  socket.on("adminStart", () => {
    if (!admins.has(socket.id)) {
      return socket.emit("errorMsg", "관리자 권한이 필요합니다.");
    }

    if (status === "finished") {
      return socket.emit(
        "errorMsg",
        "게임 종료 후에는 초기화해야 합니다."
      );
    }

    status = "running";
    seconds = FIRST_ROUND_SECONDS;

    // 게임 시작 즉시 첫 뉴스 생성
    if (news.length === 0) {
      generateNews();
    }

    broadcast();
  });

  socket.on("adminStop", () => {
    if (!admins.has(socket.id)) {
      return socket.emit("errorMsg", "관리자 권한이 필요합니다.");
    }

    status = "finished";
    broadcast();
  });

  socket.on("adminReset", () => {
    if (!admins.has(socket.id)) {
      return socket.emit("errorMsg", "관리자 권한이 필요합니다.");
    }

    resetGame();
    broadcast();
  });

  socket.on("trade", data => {
    const player = players.get(socket.id);

    if (!player) {
      return socket.emit("errorMsg", "먼저 참가해 주세요.");
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

    if (!Object.prototype.hasOwnProperty.call(prices, id)) {
      return socket.emit("errorMsg", "종목을 확인해 주세요.");
    }

    if (side !== "buy" && side !== "sell") {
      return socket.emit("errorMsg", "거래 종류를 확인해 주세요.");
    }

    if (
      !Number.isSafeInteger(quantity) ||
      quantity <= 0 ||
      quantity > MAX_QUANTITY
    ) {
      return socket.emit(
        "errorMsg",
        `수량은 1주부터 ${MAX_QUANTITY.toLocaleString()}주까지 입력할 수 있습니다.`
      );
    }

    const total = prices[id] * quantity;

    if (side === "buy") {
      if (total > player.cash) {
        return socket.emit("errorMsg", "현금이 부족합니다.");
      }

      player.cash -= total;
      player.holdings[id] =
        (player.holdings[id] || 0) + quantity;
    } else {
      const owned = player.holdings[id] || 0;

      if (owned < quantity) {
        return socket.emit("errorMsg", "보유 수량이 부족합니다.");
      }

      player.cash += total;
      player.holdings[id] = owned - quantity;
    }

    socket.emit(
      "tradeSuccess",
      side === "buy"
        ? `${companyNames[id]} ${quantity}주 매수 완료`
        : `${companyNames[id]} ${quantity}주 매도 완료`
    );

    broadcast();
  });

  socket.on("disconnect", () => {
    admins.delete(socket.id);
    players.delete(socket.id);
    broadcast();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mock stock server running on port ${PORT}`);
});


      if (owned < quantity) {
        return socket.emit("errorMsg", "보유 수량이 부족합니다.");
      }

      player.cash += total;
      player.holdings[id] = owned - quantity;
    }

    socket.emit(
      "tradeSuccess",
      side === "buy"
        ? `${companyNames[id]} ${quantity}주 매수 완료`
        : `${companyNames[id]} ${quantity}주 매도 완료`
    );

    broadcast();
  });

  socket.on("disconnect", () => {
    admins.delete(socket.id);
    players.delete(socket.id);
    broadcast();
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Mock stock server running on port ${PORT}`);
});

