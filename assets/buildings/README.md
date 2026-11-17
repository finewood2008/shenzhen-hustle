# 地标楼模型（Tripo 生成）

每个区一栋标志楼。文件放在这个文件夹里，在 `index.json` 里登记后，游戏会自动用它替换代码拼的地标；没登记或加载失败就继续用原来的。

## 生成步骤

1. 打开 Tripo Studio，选「文本生成 3D」（或者先用它的图像生成出一张图，满意了再「图片转 3D」，风格更容易统一）。
2. 把下面每栋楼的提示词整段粘进去。**统一风格那一段每次都要带上**，10 栋楼才像一套。
3. 生成选项：
   - 网格：选「智能网格 / Smart Mesh」，面数 **5,000～10,000**（手机上要跑，别超过 15,000）
   - 贴图：**1K**，最多 2K；不要 4K/8K
   - 不要绑定骨骼
4. 导出 **GLB**，文件名用下面表格里的英文名，比如 `huaqiangbei.glb`，放进这个文件夹。
5. 在 `index.json` 里登记（只登记已经放进来的）：

```json
{
  "huaqiangbei": { "file": "huaqiangbei.glb" },
  "futian": { "file": "futian.glb", "rotY": 90 }
}
```

- `rotY`：模型正面没朝向街道时，绕竖轴转多少度（90、180、-90）。放进游戏后我来看、来调。
- 模型会自动缩放到占地约 14 × 10 米、贴地、居中，不用在 Tripo 里调大小。

> 授权提醒：Tripo 免费版生成的模型是公开的，且仅限非商业用途；游戏以后如果要商用，需要用专业版生成。

## 统一风格（每次都附在提示词后面）

```
stylized low poly game asset, isometric city-builder style, clean simple shapes, flat bright colors with soft shading, cute toy-like proportions, single building only, standing on a small flat square base, no people, no cars, no readable text, no logos
```

## 10 栋楼

| 文件名 | 区 | 地标 | 提示词（再接上统一风格） |
|---|---|---|---|
| `huaqiangbei.glb` | 华强北 | 电子大厦 | A 1990s Chinese electronics market tower, 12 floors, beige tiles and blue glass, the lower floors covered with colorful vertical shop signs and neon light boxes, a big LED screen on the facade, rooftop antenna mast |
| `futian.glb` | 福田 CBD | 金融塔 | A sleek supertall financial skyscraper, tapering glass tower with silver vertical fins, a pointed spire on top, a wide glass lobby podium at the base |
| `luohu.glb` | 罗湖 | 口岸联检楼 | A large modern border crossing checkpoint building in a Chinese city, wide 3-story white and grey terminal with a long glass facade, a huge flat cantilevered roof canopy over the entrance plaza, big red Chinese-style roof sign frame (blank), rows of entrance doors, flagpoles in front, a covered pedestrian walkway, wide horizontal composition |
| `dongmen.glb` | 东门老街 | 老街牌坊 | A traditional Chinese memorial archway gate with red pillars and green glazed tile roofs, flanked by two-story old Lingnan-style shophouses with arcade columns and red lanterns |
| `keji.glb` | 南山科技园 | 双子总部 | Two modern tech company headquarters towers connected by a sky bridge, white frames and teal glass, rooftop gardens, a big plaza at the base |
| `shekou.glb` | 蛇口 | 海上邮轮 | A retired white cruise ship permanently docked as a waterfront mall, two decks of windows, a red-and-blue funnel, string lights along the deck, on a small pier base |
| `baoan.glb` | 宝安西乡 | 西乡工厂 | A Chinese factory compound, three-story white tiled workshop with blue window strips, a sawtooth roof shed beside it, a tall red-and-white chimney, a loading dock with a roll-up door |
| `longhua.glb` | 龙华 | 握手楼 | A cluster of Chinese urban village "handshake buildings", four narrow 8-floor apartment blocks packed so close they almost touch, colorful tiles, balconies with metal security cages, air conditioners, laundry hanging, rooftop water tanks |
| `dafen.glb` | 大芬村 | 画家村 | An art village gallery building, three-story colorful painted house with big arched windows, oil paintings on easels and hanging on the outside walls, a small courtyard with an art-shop awning |
| `yantian.glb` | 盐田港 | 集装箱码头 | A container port scene: a big blue ship-to-shore gantry crane over stacks of colorful shipping containers, on a concrete quay base |
