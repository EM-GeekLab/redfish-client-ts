export enum DeviceType {
  SingleFunction = "SingleFunction", // 单功能PCIe设备
  MultiFunction = "MultiFunction",   // 多功能PCIe设备
  Simulated = "Simulated"            // 模拟的PCIe设备（物理不存在）
}

export enum ResetType {
  On = "On",                              // 开机
  ForceOff = "ForceOff",                  // 强制关机
  ForceRestart = "ForceRestart",          // 强制重启
  GracefulShutdown = "GracefulShutdown",  // 优雅关机
  PushPowerButton = "PushPowerButton",    // 按电源键
  Nmi = "Nmi",                            // NMI
}


export enum BootSourceOverrideEnabledType {
  Continuous = "Continuous", // 连续
  Once = "Once",             // 一次
  None = "None"              // 无
}


export enum RedfishMode {
  iBMC = "iBMC",             // iBMC，主要用于华为服务器
  iDRAC = "iDRAC",           // iDRAC，主要用于戴尔服务器
  XClarity = "XClarity",     // XClarity，主要用于联想服务器

  iLO = "iLO",               // iLO，主要用于惠普服务器
  Supermicro = "Supermicro", // Supermicro，主要用于超微主板的服务器
  OpenBMC = "OpenBMC",       // OpenBMC，主要用于开源BMC
}

export enum BootSourceOverrideTargets {
  None = "None",             // 无
  Pxe = "Pxe",               // PXE
  Hdd = "Hdd",               // 硬盘
  Cd = "Cd",                 // 光驱
  BiosSetup = "BiosSetup",   // BIOS设置
  Floppy = "Floppy",         // 软盘
  // 下方为不同厂商支持不同的设备
  UefiShell = "UefiShell",   // UEFI Shell
  SDCard = "SDCard",         // SD卡
}
