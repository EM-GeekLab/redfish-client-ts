import {BootSourceOverrideEnabledType, DeviceType} from './enums';

/**
 * Redfish API 的返回数据结构
 */
type UUID = string;
export type Action = { target: string };

export interface RedfishRoot {
  Id: string;              // 根资源的唯一标识符
  Name: string;            // 根资源的友好名称
  Description?: string;     // 根资源的描述，注意华为等厂商可能没有此属性

  RedfishVersion: string;  // Redfish版本
  UUID?: UUID;             // 根资源的 UUID，注意 Dell 等厂商可能没有此属性
  Product?: string;        // 产品名称，华为等厂商可能没有此属性
  ProductName?: string;    // 产品名称，Dell 等厂商可能没有此属性

  Links: {                 // 根资源的关联资源链接
    Sessions: { '@odata.id': string; }; // 指向会话资源的引用
  };
  Oem?: Record<string, object>;
}

export interface RedfishSession {
  Id: string;
}

export interface Systems {
  Members: Array<{ '@odata.id': string }>;
  "Members@odata.count": number;
  Name: string;
}

export interface SystemInfo {
  "@odata.id": string;
  Id: string;
  Name: string;
  Model: string;
  Manufacturer: string;
  SerialNumber: string;
  HostName: string;
  Memory: { '@odata.id': string };
  MemorySummary: {
    TotalSystemMemoryGiB: number;
    Status: {
      State: string;
      Health: string;
      HealthRollup: string;
    }
  };
  UUID?: string;
  PowerState: 'On' | 'Off';
  PCIeDevices?: Array<{ '@odata.id': string }>;
  Processors: { '@odata.id': string };
  Actions: Record<string, Action>;

  Boot: {
    BootOptions?: {
      "@odata.id": string;
    };
    BootOrder?: Array<string>;
    BootSourceOverrideTarget: string;
    BootSourceOverrideEnabled: BootSourceOverrideEnabledType;
    BootSourceOverrideMode: string;
    'BootSourceOverrideTarget@Redfish.AllowableValues': Array<string>;
  };
  Links: {
    ManagedBy?: Array<{ '@odata.id': string }>;
    Managers?: Array<{ '@odata.id': string }>;
    Chassis: Array<{ '@odata.id': string }>;
  }
  VirtualMedia?: { '@odata.id': string };

  Etag?: string; // ETag 属性，iBMC 中使用
}

export interface Manager {
  Id: string;
  ManagerType: string;
  PowerState: string;
  Actions: Record<string, Action> & { Oem?: Record<string, Action> };
  VirtualMedia: { '@odata.id': string };
}

export interface ProcessorsCollection {
  Members: Array<{ "@odata.id": string; }>;
  "Members@odata.count": number;
}

export interface Processor {
  Id: string;
  InstructionSet: string;
  Manufacturer: string;
  MaxSpeedMHz: number;
  Model: string;
  ProcessorArchitecture: string;
  ProcessorType: string;
  Socket: string;
  Status: {
    State: string;
    Health: string;
  };
  TotalCores: number;
  TotalThreads: number;
}

interface PCIeDeviceStatus {
  State?: string;        // 资源的状态
  Health?: string;       // 资源的健康状态
  HealthRollup?: string; // 所有下级资源的聚合健康状态
}

export interface PCIeDevice {
  // 基本资源属性
  Id: string;
  Name: string;
  Description?: string;

  // PCIe设备制造信息
  Manufacturer?: string;   // 制造商名称
  Model?: string;          // 型号
  SKU?: string;            // 库存单位编号
  SerialNumber?: string;   // 序列号
  PartNumber?: string;     // 部件号
  AssetTag?: string;       // 用户分配的资产标签（可读写）

  // 设备特性
  DeviceType: DeviceType;   // 设备类型（单功能/多功能/模拟）
  FirmwareVersion?: string; // 固件版本

  // 状态和链接
  Status: PCIeDeviceStatus; // 设备状态
  Links: {
    // 包含该PCIe设备的机箱数组
    Chassis: Array<{ '@odata.id': string; }>;        // 指向Chassis资源的引用
    'Chassis@odata.count'?: number;                // Chassis集合计数（可选）

    // 该设备公开的PCIe功能数组
    PCIeFunctions: Array<{ '@odata.id': string; }>; // 指向PCIeFunction资源的引用
    'PCIeFunctions@odata.count'?: number;          // PCIeFunctions集合计数（可选）

    // 允许的OEM特定链接
    Oem?: any;
  };             // 关联资源链接

  // 允许OEM扩展
  Oem?: any;
}

export interface MemoryCollection {
  Members: Array<{ '@odata.id': string }>;
  "Members@odata.count": number;
}

export interface Memory {
  Id: string;
  Name: string;
  Manufacturer: string;
  PartNumber: string;

  CapacityMiB: number;
  OperatingSpeedMhz: number;
  MemoryDeviceType: string;
  Status: {
    State: string;
    Health: string;
  };
}

export interface RedfishError {
  error?: {
    '@Message.ExtendedInfo': Array<{
      Message: string;
      MessageId: string;
      Resolution: string;
      Severity: string;
    }>
  };
  code?: number;
}

export interface VirtualMediaCollection {
  Members: Array<{ '@odata.id': string }>;
}

export interface VirtualMediaMember {
  '@odata.id': string
}

export interface VirtualMedia {
  '@odata.id': string
  MediaTypes: Array<string>
  Inserted: boolean;
  Image: string;
  ImageName: string;
  Actions?: Record<string, Action>;
  Oem?: Record<string, any>;
}

export interface Message {
  Message: string;
  MessageID?: string;
  Severity?: string;
  MessageArgs?: any[];
  "MessageArgs@odata.count"?: number;
  MessageId?: string;
}

export interface Task {
  "@odata.id": string;
  Description: string;
  EndTime: Date;
  Id: string;
  Messages: Message[];
  "Messages@odata.count": number;
  Name: string;
  PercentComplete: number;
  StartTime: Date;
  TaskState: string;
  TaskStatus: string;
}

export interface Chassis {
  Id: string;
  Name: string;
  ChassisType: string;
  SerialNumber: string;
  PartNumber: string;
  AssetTag: string;
  IndicatorLED: string;
  PowerState: string;
  Status: {
    State: string;
    Health: string;
    HealthRollup: string;
  };
  Power: { '@odata.id': string };
  PCIeDevices: { '@odata.id': string };
  Thermal: { '@odata.id': string };
  NetworkAdapters: { '@odata.id': string };
  PCIeSlots: { '@odata.id': string };
  Sensors: { '@odata.id': string };
  Memory: { '@odata.id': string };
}

export interface Collection {
  Members: Array<{ '@odata.id': string }>;
  "Members@odata.count"?: number;
}

export interface NetworkAdapter {
  Id: string;
  Name: string;
  Manufacturer: string;
  Model: string;
  NetworkPorts: { '@odata.id': string };
  Status: {
    State: string;
    Health: string;
    HealthRollup: string;
  };
}

export interface NetworkPort {
  Id: string;
  AssociatedNetworkAddresses: string[];
  LinkStatus: "Down" | "Up" | "Starting" | "Training";
  CurrentLinkSpeedMbps?: number;
}

/**
 * Redfish Client 的返回数据结构
 */
export interface CPUInfo {
  id: string;                // 处理器ID
  manufacturer: string;      // 制造商
  model: string;             // 型号
  architecture: string;      // 处理器架构
  cores: number;             // 核心数
  threads: number;           // 线程数
  speedMHz: number;          // 最大频率（MHz）
  socket: string;            // 插槽
  status: string;            // 状态
}

export interface PCIeInfo {  // 返回的 PCIe 设备信息
  id: string;                // 设备ID
  manufacturer: string;      // 制造商
  model: string;             // 型号
  type: DeviceType;          // 设备类型
  health: string;            // 健康状态
}

export interface MemoryInfo {
  id: string;
  manufacturer: string;
  model: string;
  capacityMiB: number;
  speedMHz: number;
  type: string;
  status: string;
}

export interface NetworkPortInfo {
  macAddress: string; // MAC 地址
  linkStatus: "Down" | "Up" | "Starting" | "Training"; // 连接状态
  speedMbps: number; // 链路速度（Mbps），若未获取到返回 -1
  speedDisplay: string; // 链路速度显示，在 iBMC 中使用，返回的值为字符串
}

export interface NetworkCardInfo {
  id: string; // 网络适配器ID
  manufacturer: string; // 制造商
  model: string; // 型号
  ports: NetworkPortInfo[]; // 网络端口信息
  status: string; // 健康状态
}

export interface InsertMediaRequest {
  Image: string;
  Inserted?: boolean;
  WriteProtected?: boolean;
  TransferProtocolType?: 'CIFS' | 'FTP' | 'SFTP' | 'HTTP' | 'HTTPS' | 'NFS' | 'OEM' | 'TFTP';
  TransferMethod?: 'Stream' | 'Upload';
}
