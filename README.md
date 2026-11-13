# 深圳浮生记

一个原创的 3D 网页倒卖模拟游戏：三十天，在深圳各区之间低买高卖、还清欠款。

在线试玩：https://finewood2008.github.io/shenzhen-hustle/

- 街区默认是斜 45 度俯视，按 V 切换第一人称；点地面走动，或用 WASD，手机上有虚拟摇杆
- 走近档口交易，每个档口每天能砍一次价；去地铁站换区，每次移动耗时一天
- 有人会找你下送货订单；路人可以搭话，有的带行情消息，有的有事相求
- 剧情用对话推进，你的选择影响人情，人情影响砍价、借款和结局
- 主题、布局、主角形象都可以在设置里自定义，进度自动存档

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

- `src/content.js` 数值、地点、商品、档口
- `src/logic.js` 纯玩法逻辑（交易、订单、砍价、借款）
- `src/story.js` 剧情、随机事件、路人对话
- `src/portraits.js` 对话头像
- `src/settings.js` 玩家的自定义设置
- `src/scene.js` 城市沙盘
- `src/street.js`、`src/streetscape.js`、`src/landmarks.js` 可行走街区和各区街景
- `src/main.js` 界面与交互
- `src/audio.js` 合成的音乐和音效
- `src/net.js`、`api/` 自动账号和天梯排行榜（Vercel 函数 + Upstash Redis）
- `vendor/` Three.js r160（MIT）
