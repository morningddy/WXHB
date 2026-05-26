# Infinite-Canvas

一个基于 Web 的无限画布 AI 创作工具，支持文生图、图生图、视频生成、LLM 对话、ComfyUI 工作流等多种 AI 能力，所有功能以节点方式可视化编排。

## 功能特性

- 🎨 **AI 图像生成** — 支持 ComfyUI / ModelScope / 多种 API 后端
- 🎬 **视频生成** — 支持 Seedance2、Veo3 等视频模型，支持首帧/尾帧参考
- 💬 **LLM 节点** — 支持 OpenAI 协议、Gemini、Claude 等大模型
- 🔄 **循环/并发** — 节点可循环执行 N 次，支持批量生成
- 🖼️ **ComfyUI 自定义工作流** — 可自定义输入输出和参数
- 🌏 **中英文切换**
- 📝 **画笔编辑**

## 快速开始

1. 安装依赖：运行 `安装依赖.bat`（Windows）或 `pip install -r requirements.txt`
2. 启动：运行 `run.bat` 或 `python app.py`
3. 打开浏览器访问 `http://localhost:5000`

## API 配置

在网页内直接进入设置页面配置 API Key，支持：
- OpenAI 协议（GPT、Claude、Gemini 等）
- ModelScope（通义万象等）
- 自定义 API 地址

## 稳定 API 推荐

https://apimart.ai/register?aff=1uyAbb

## 教程视频

https://youtu.be/1y9ShTvgC_w

## 目录结构

```
static/         — 前端 HTML/JS/CSS
app.py          — Flask 后端主入口
requirements.txt — Python 依赖
comfy_workflows/ — ComfyUI 工作流 JSON
```
