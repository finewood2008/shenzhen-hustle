# 深圳搞钱记

一个原创的 3D 网页倒卖模拟游戏：三十天，在深圳各区之间低买高卖、还清欠款。

- 在街区里走动（WASD / 方向键 / 点击地面），靠近档口按 E 交易
- 去地铁站打开城市沙盘，选择下一个区，每次移动耗时一天
- 留意小道消息：红色要涨，绿色要跌

## 运行

```bash
python3 -m http.server 8123
```

然后打开 http://localhost:8123 。无需构建。

## 测试

```bash
node test/sim.mjs
```

## 结构

- `src/content.js` 数值、地点、商品、事件、档口
- `src/logic.js` 纯玩法逻辑
- `src/scene.js` 城市沙盘
- `src/street.js` 可行走街区
- `src/main.js` 界面与交互
- `vendor/` Three.js r160（MIT）
