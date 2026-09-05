# 历史版本归档

当前维护版本位于 `main`：React / Three.js 星界工坊，包含战术关卡、顶部通知、持久生图额度，以及第13关「鹿原加油 / 必胜」彩蛋。合并前已上线的游戏源码快照为 `b1dc419`。

旧版本以签名 Git 标签保存完整源码和历史，不复制或移动仍被当前游戏依赖的目录。

| 版本 | 归档标签 | 提交 |
| --- | --- | --- |
| 原主分支 · Canvas 2D 旧版 | [archive/legacy-20260905](https://github.com/luyao618/breakout-maker/tree/archive/legacy-20260905) | `326db4c` |
| 首次 React / Three.js 重建 | [archive/first-3d-20260905](https://github.com/luyao618/breakout-maker/tree/archive/first-3d-20260905) | `ea8e531` |
| 音效、超新星与首次上线 | [archive/arcade-20260905](https://github.com/luyao618/breakout-maker/tree/archive/arcade-20260905) | `38c2730` |
| 生图额度与个人密钥 | [archive/quota-20260905](https://github.com/luyao618/breakout-maker/tree/archive/quota-20260905) | `20801da` |
| 全关卡开放与星图重做 | [archive/open-campaign-20260905](https://github.com/luyao618/breakout-maker/tree/archive/open-campaign-20260905) | `0b8f2c7` |
| 顶部通知版本 | [archive/top-hud-20260905](https://github.com/luyao618/breakout-maker/tree/archive/top-hud-20260905) | `cc136d6` |
| 战术关卡与道具平衡版本 | [archive/tactical-20260905](https://github.com/luyao618/breakout-maker/tree/archive/tactical-20260905) | `8855109` |

## 查看旧版

```sh
git fetch origin --tags
git switch --detach archive/legacy-20260905
```

查看完后用 `git switch main` 返回当前版本。标签是历史源码快照，服务器仍使用当前已验证的部署；版本化部署与回滚说明见 [COHOST.md](../deploy/COHOST.md)。

`src/` 仍是现代版游戏的共享运行逻辑，`levels/` 仍是构建输入，不能作为旧版文件移走。第13关原始彩蛋资源独立保存在 `levels/preserved/lu-yuan-easter-egg.json`，后续关卡重做必须保留。
