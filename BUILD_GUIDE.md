# Music Player 打包指南

## 问题说明

由于 Trae IDE 的沙箱限制，electron-builder 在打包时无法访问系统缓存目录，导致打包失败。

## 解决方案

### 方法 1：使用新 PowerShell 窗口打包（推荐）

我已经为你启动了一个新的 PowerShell 窗口，它会自动运行打包命令。

如果窗口没有自动运行，请手动执行以下步骤：

1. **打开新的 PowerShell 窗口**（不要使用 Trae IDE 内置终端）

2. **进入项目目录**：
   ```powershell
   cd "d:\Trae CN\project\Music_Player\MusicPlayer-Electron"
   ```

3. **设置环境变量并运行打包**：
   ```powershell
   $env:CSC_IDENTITY_AUTO_DISCOVERY="false"
   npm run build:win
   ```

   或者一行命令：
   ```powershell
   $env:CSC_IDENTITY_AUTO_DISCOVERY="false"; npm run build:win
   ```

### 方法 2：使用批处理脚本打包

创建一个批处理文件 `build.bat` 在项目根目录：

```batch
@echo off
set CSC_IDENTITY_AUTO_DISCOVERY=false
npm run build:win
pause
```

然后双击运行 `build.bat` 即可。

## 打包输出

打包完成后，安装包会在以下目录生成：

```
d:\Trae CN\project\Music_Player\MusicPlayer-Electron\dist\
```

生成的安装包文件名格式：
```
Music Player Setup 1.0.0.exe
```

## 可用的打包命令

- `npm run build:win` - 打包 Windows 版本
- `npm run build:mac` - 打包 macOS 版本
- `npm run build:linux` - 打包 Linux 版本
- `npm run build` - 打包当前平台版本

## 配置说明

已在 `package.json` 中配置了以下打包选项：

- **应用名称**: Music Player
- **应用 ID**: com.musicplayer.app
- **安装包类型**: NSIS 安装程序
- **架构**: x64
- **安装选项**: 
  - 允许用户选择安装目录
  - 创建桌面快捷方式
  - 创建开始菜单快捷方式

## 图标

已使用 lx-music-desktop 项目的图标文件 `icons.ico`。

如需更换图标，请准备一个 `.ico` 格式的图标文件，替换项目根目录的 `icons.ico` 文件即可。

## 常见问题

### 问题：打包时卡在某个进度

**解决方法**：
1. 检查网络连接
2. 使用国内镜像源：
   ```powershell
   npm config set registry https://registry.npmmirror.com
   ```

### 问题：提示权限不足

**解决方法**：
1. 以管理员身份运行 PowerShell
2. 清理缓存目录：
   ```powershell
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache"
   ```

### 问题：打包后的程序无法启动

**解决方法**：
1. 检查是否有杀毒软件拦截
2. 尝试以管理员身份运行
3. 查看 `dist\win-unpacked` 目录下的未打包版本是否能正常运行

## 下一步

打包完成后，你可以：

1. 将生成的 `.exe` 安装包分发给用户
2. 用户双击安装包即可安装 Music Player
3. 安装完成后可以在桌面或开始菜单找到快捷方式
