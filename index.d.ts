

/**
 * 启动选项资源报告有关系统中包含的单个启动选项的信息
 */
export interface BootOption {
  /**
   * 在 BootOrder 中引用的唯一启动选项字符串
   * 对于UEFI系统，此字符串应与UEFI启动选项变量名称匹配（例如Boot####）
   */
  BootOptionReference: string;

  /**
   * 启动选项的用户可读显示字符串
   * 描述此启动选项在用户界面的启动顺序列表中的显示方式
   */
  DisplayName?: string;

  /**
   * 显示启动选项是否启用的标志
   * 如果此属性设置为false，则会跳过计算机系统上找到的Boot Order数组中引用的启动选项
   * 在UEFI上下文中，此属性应影响启动选项的Load Option Active标志
   */
  BootOptionEnabled?: boolean;

  /**
   * 用于访问此UEFI启动选项的UEFI设备路径
   * 包含用于识别和定位此UEFI启动选项的特定设备的UEFI设备路径，由UEFI规范定义
   */
  UefiDevicePath?: string;

  /**
   * 在Computersystem资源的BootSourceOverrideTarget属性中描述时，此启动源的别名
   */
  Alias?: BootSource;

  /**
   * 与此启动选项关联的资源ID
   * 一个指针数组，其中包含与用于此启动选项的资源一致的JSON指针语法
   */
  RelatedItem?: ResourceItem[];

  /**
   * 此资源的可用操作
   */
  Actions: Actions;

  /**
   * 资源标识符
   */
  '@odata.id'?: string;

  /**
   * 资源类型
   */
  '@odata.type'?: string;

  /**
   * 资源名称
   */
  Name?: string;

  /**
   * 资源描述
   */
  Description?: string;

  /**
   * OData上下文
   */
  '@odata.context'?: string;

  /**
   * OEM特定属性
   */
  Oem?: Record<string, any>;
}

/**
 * Redfish Client 的返回数据结构
 */
export interface PCIeInfo {  // 返回的 PCIe 设备信息
  id: string;                // 设备ID
  manufacturer: string;      // 制造商
  model: string;             // 型号
  type: DeviceType;          // 设备类型
  health: string;            // 健康状态
}

export interface MemoryInfo {

}

export interface CPUInfo {

}