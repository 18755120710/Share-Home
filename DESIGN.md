---
name: Share Home
description: 局域网去中心化极速协作办公平台
colors:
  primary: "#3b82f6"
  primary-light: "#2563eb"
  neutral-bg: "#030303"
  neutral-bg-light: "#f4f4f5"
  neutral-card: "#09090b"
  neutral-text: "#f4f4f5"
  neutral-text-light: "#09090b"
  success: "#10b981"
  warning: "#f59e0b"
  error: "#ef4444"
typography:
  display:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
components:
  button-primary:
    backgroundColor: "#ffffff"
    textColor: "#000000"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "rgba(255, 255, 255, 0.04)"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  card:
    backgroundColor: "rgba(9, 9, 11, 0.6)"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: Share Home

## 1. Overview

**Creative North Star: "The Tactical Radar HUD" (战术超视距雷达视窗)**

Share Home 的视觉设计旨在打造一种冷峻、稳固、精准的物理级科技感协作界面。我们排斥传统消费级文件传输工具的臃肿感与塑料感，采用类似专业軍控 HUD 刻度、精密格栅网格、以及高精度物理微动效，来传递数据传输的绝对安全和超视距网络自愈合的稳定感。

界面支持全自动防闪烁的双色主题切换（亮/暗模式）。在深色模式下，界面展现为无垠星空般的 Zinc 中性极黑，辅以高纯度科技蓝的扫描流光；在亮色模式下，则为清澈利落的淡灰质感，提供高对比度的文字排版。

**Key Characteristics:**
- **硬科技几何感**：采用 32px 的精密网格网格、同心圆、方向刻度以及十字坐标。
- **极致的扁平零摩擦**：核心功能高度集成在单页工作台内，传输抽屉自由滑出，零阻碍弹窗。
- **精细微动效**：按钮具有向下的微位移（1-2px），雷达具有惯性 ease-out-expo 扫射光线。

## 2. Colors

我们采用极客深灰色作为大背景基底，蓝色作为极点，绿色作为信道成功指标。

### Primary
- **Tech Cyber Blue** (`#3b82f6` in Dark / `#2563eb` in Light): 用于焦点设备锁定、主要激活状态标识、流光波纹等。

### Neutral
- **Deep Void Background** (`#030303` in Dark): 极深背景，吸收一切杂色，还原最纯净的界面对比度。
- **Slate Sidebar** (`#09090b` in Dark / `#ffffff` in Light): 产生微弱的层次分级隔绝感。
- **Zinc Text** (`#f4f4f5` in Dark / `#09090b` in Light): 用于正文和主标题。
- **Muted Steel** (`#71717a` in both): 用于次要说明文字、网格线或非活动节点。

### Named Rules

**The Rarer Accent Rule.** 高能科技蓝作为强调色，在任何单一屏幕下的占比必须控制在 10% 以下。大面积使用蓝色会导致科技感的廉价化，蓝色的珍贵度才是强调的重点。

**The Consistent Contrast Rule.** 在亮色模式下，设备 Badge 及说明文的文字对比度必须严格超过 4.5:1。禁止使用纯白背景配淡蓝/淡灰文字。

## 3. Typography

**Display Font:** Inter, -apple-system, sans-serif
**Body Font:** Inter, -apple-system, sans-serif
**Label/Mono Font:** JetBrains Mono, monospace

**Character:**
将高度现代化的 Inter 无衬线体与高精度的 JetBrains Mono 强硬等宽体进行撞击。大字号 Display 极具压迫感地收缩字距，而 Label Mono 则大跨步拉开字符间距以实现精密的仪器报表观感。

### Hierarchy
- **Display** (800, `1.75rem`, `1.2`, `-0.02em`): 用于云文档大字标题、工作台大标题。
- **Headline** (700, `1.25rem`, `1.3`, `-0.025em`): 用于雷达协作台、共享空间主标题。
- **Title** (600, `0.95rem`, `1.4`): 用于卡片标题、设备昵称、目录项。
- **Body** (400, `0.875rem`, `1.7`): 默认正文描述，最长物理长度限制在 70ch 以内。
- **Label** (600, `0.75rem`, `1.2`, `0.04em`): 用于军工级状态码、RTT延迟指标、网络标识。

## 4. Elevation

本系统不使用过深的扩散性重度投影，而是通过高透的磨砂材质叠加极窄细边框来营造海拔，使层次感贴合扁平的 HUD 主题。

### Shadow Vocabulary
- **Tactile Lift** (`var(--shadow-sm)` / `0 1px 2px rgba(0,0,0,0.05)`): 用于静态卡片与按钮。
- **Hover Focus Lift** (`var(--shadow-md)` / `0 4px 6px rgba(0,0,0,0.1)`): 卡片或按钮 hover 时产生的微小阴影膨胀。
- **Radar Pod Glow** (`var(--shadow-glow)` / `0 0 16px rgba(59, 130, 246, 0.15)`): 主动连接或传输时的外发光呼吸效果。

### Named Rules

**The Border-First Depth Rule.** 层次的建立首先依赖 1px 的超细边框（深色下为 `rgba(255,255,255,0.04)`，亮色下为 `#e4e4e7`），只有在产生悬浮、聚焦或拖拽时才通过提升投影高度来激活 Depth。

## 5. Components

### Buttons
- **Shape:** 6px 微圆角。
- **Primary:** 深色下为纯白底黑字（亮色下为深黑底白字），高对比度，padding 为 `10px 18px`。
- **Hover:** 悬浮时，按钮微缩 scale (0.98) 产生按下弹性手感，而不是突兀放大。

### Cards / Containers
- **Corner Style:** 12px 圆角（`var(--radius-lg)`）。
- **Background:** `rgba(9, 9, 11, 0.6)` 高透深灰，配有 `blur(16px)` 的毛玻璃落水。
- **Border:** 1px 的微亮隔离线，防止容器在纯黑背景下消失。

### Inputs / Fields
- **Style:** 极窄灰色暗底，带 1px 边框，6px 圆角。
- **Focus:** 激活时，边框颜色直接转为科技蓝，并带有科技蓝的极淡微光阴影环。

### Navigation (Sidebar)
- **Style:** 宽度固定为 260px，右侧 1px 边框。
- **Active state:** 主选中项带有 `1px solid var(--border-color-hover)` 及极淡灰色背景（`rgba(128,128,128,0.08)`），文字高亮，图标转为科技蓝。

## 6. Do's and Don'ts

### Do:
- **Do** 对所有的 clickable 交互元素增加 `cursor: pointer` 样式。
- **Do** 所有的悬浮或状态转变，过渡时长统一控制在 150-250ms 内，并使用 `cubic-bezier(0.4, 0, 0.2, 1)`（Ease-in-out 标准贝塞尔）。
- **Do** 在亮色模式下，对不同性质的设备（Windows/macOS/Android/Linux）使用加深的高可见度专属 Badge，避免亮色背景下文字无法辨识。

### Don't:
- **Don't** 使用大于 1px 的左侧/右侧单边粗竖条作为卡片或 Callout 的装饰。
- **Don't** 使用任何文字渐变或彩虹渐变。文字必须为纯色，字重对比才具有技术严肃感。
- **Don't** 直接弹出阻断式 Modal。文件接收、昵称修改等优先通过就地 input 或右侧轻便的滑动抽屉（Drawer）进行。
- **Don't** 使用 Emoji 作为组件功能的指示图标，全部统一为 **Lucide-React** 几何线性图标集。
