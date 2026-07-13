# 小鹤双拼练习

Local practice app for [Xiaohe Shuangpin](https://flypy.cc/) Chinese typing, inspired by [ulpb.app](https://ulpb.app/).

## Run locally

```bash
cd "/Users/adelaidewang/Documents/Vibe Coding Prototypes/xiaohe-shuangpin"
npm install
npm run dev
```

Open **http://127.0.0.1:5179/**

## Modes

- **单字练习** — random common characters (default)
- **句子练习** — short sentences
- **文章练习** — longer passages

Your last mode is saved in `localStorage` and restored on the next visit.

## Controls

| Key | Action |
|-----|--------|
| Letter keys | Type the 2-key Xiaohe code |
| `Space` | Speak current character |
| `Esc` | Clear current input |
| `Backspace` | Delete last key in buffer |
