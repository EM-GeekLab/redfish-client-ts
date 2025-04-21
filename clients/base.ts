import type {
  Chassis, Collection,
  CPUInfo, Manager,
  Memory,
  MemoryCollection,
  MemoryInfo, NetworkAdapter, NetworkCardInfo, NetworkPort, NetworkPortInfo,
  PCIeDevice,
  PCIeInfo,
  Processor,
  ProcessorsCollection, RedfishError,
  RedfishRoot,
  RedfishSession,
  SystemInfo,
  Systems, Task, VirtualMedia, VirtualMediaCollection, VirtualMediaMember
} from "../types";
import {ResetType, RedfishMode, BootSourceOverrideTargets} from "../enums";
import {fetchWithoutSSL} from "../utils";

export class NotImplementError extends Error {
  constructor(methodName?: string) {
    const message = methodName
      ? `Method ${methodName} not implemented: 由于不同厂商的实现方式不同，该方法需要在各厂商的子类中实现`
      : `Not implemented: 由于不同厂商的实现方式不同，此处需要在各厂商的子类中实现`;
    super(message);
    this.name = 'NotImplementError';
  }
}

/**
 * Redfish 客户端基类
 */
export class RedfishClient {
  protected readonly baseUrl: string = '';
  private readonly userName: string = '';
  private readonly password: string = '';
  public readonly name: string = '';         // 客户端名称

  private sessionUri: string = '';             // 会话 URI
  private sessionToken: string | null = null;  // 会话令牌，通过 X-Auth-Token 传递
  private sessionId: string | null = null;     // 会话 ID，用于释放会话

  private systemIds: string[] = [];            // 可用的系统ID
  protected systemInfos: Record<string, SystemInfo> = {};  // 默认系统信息
  protected managerInfos: Record<string, Manager> = {};    // 默认管理器信息, Key 为系统ID
  protected chassisInfos: Record<string, Chassis> = {};    // 默认机箱信息, Key 为系统ID
  /**
   * 构造函数
   * @param ipAddress BMC IP地址
   * @param username BMC 用户名
   * @param password BMC 密码
   * @param redfishMode Redfish 模式，默认为 iBMC，根据不同厂商的实现可能会有差异
   */
  constructor(ipAddress: string, username: string, password: string, redfishMode: RedfishMode = RedfishMode.iBMC) {
    this.baseUrl = `https://${ipAddress}`;
    this.userName = username;
    this.password = password;

    this.name = this.constructor.name;
  }

  /**
   * 创建自定义fetch请求（处理SSL证书验证和身份验证）
   * @param url 请求地址
   * @param options 请求选项
   * @param withSessionToken 是否携带会话令牌
   */
  protected async customFetch<T>(
    url: string,
    options: RequestInit = {},
    withSessionToken: boolean = true
  ): Promise<{ data: T; headers: Headers }> {
    // 获取和缓存会话令牌的逻辑可以优化
    const sessionToken = withSessionToken ? (this.sessionToken || await this.getSessionToken()) : undefined;

    const fetchOptions: RequestInit = {
      method: 'GET',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? {'X-Auth-Token': sessionToken} : {}),
        ...(options.headers)
      },
    };
    let response: Response;

    try {
      response = await fetchWithoutSSL(url, fetchOptions);
    } catch (error) {
      console.error(`请求失败: ${url}`, error);
      throw error;
    }
    // 处理空响应
    if (response.status === 204 || response.headers.get('content-length') === '0') {
      console.warn(`空响应: ${url}，状态码: ${response.status}`);
      return {data: {} as T, headers: response.headers};
    }
    // 检查响应状态码
    if (!response.ok) {
      throw new Error(`HTTP error! Request: ${url} Status: ${response.status} - ${await response.text()}`);
    }
    // 解析响应JSON
    const data = await response.json().catch(() => {
      throw new Error(`无法解析JSON响应: ${url}`);
    });
    // 检查成功响应中的Redfish错误
    if (data && 'error' in data) {
      const redfishError = data as RedfishError;
      if (redfishError.error && redfishError.error['@Message.ExtendedInfo']) {
        // 适配华为 iBMC 在部分情况下执行成功但返回 MessageId 为 "Base.1.0.Success" 的错误的情况
        if (redfishError.error['@Message.ExtendedInfo'][0].MessageId === 'Base.1.0.Success') {
          return {data: {} as T, headers: response.headers};
        }
        const errorMessages = redfishError.error['@Message.ExtendedInfo']
          .map(info => info.Message)
          .join(', ');
        throw new Error(`Redfish错误: ${errorMessages}`);
      }
    }
    return {data: data as T, headers: response.headers};
  }


  //region [Redfish 登录鉴权与会话管理]
  /**
   * 获取 Redfish 登录地址
   * @returns Redfish 登录地址
   */
  async getRedfishSessionUri(): Promise<string> {
    try {
      const {data} = await this.customFetch<RedfishRoot>(`${this.baseUrl}/redfish/v1`, {method: 'GET'}, false);
      // 正确返回会话URI
      if (data.Links && data.Links.Sessions && data.Links.Sessions['@odata.id']) {
        this.sessionUri = data.Links.Sessions['@odata.id'];
        return data.Links.Sessions['@odata.id'];
      }
      throw new Error('无法获取 Sessions URI');
    } catch (error) {
      console.error(`获取 Sessions URI 失败`, error);
      throw error;
    }
  }

  /**
   * 获取会话令牌
   */
  async getSessionToken(): Promise<string> {
    if (this.sessionToken) {
      return this.sessionToken;
    }
    try {
      const sessionUri = this.sessionUri ? this.sessionUri : await this.getRedfishSessionUri();
      if (!this.userName || !this.password) {
        throw new Error('BMC 用户名或密码未设置，请检查配置');
      }
      const sessionData = {
        UserName: this.userName,
        Password: this.password
      }
      const {data, headers} = await this.customFetch<RedfishSession>(
        `${this.baseUrl}${sessionUri}`,
        {
          method: 'POST',
          body: JSON.stringify(sessionData)
        },
        false
      );
      this.sessionToken = headers.get('x-auth-token') || null;
      this.sessionId = data.Id || null;

      if (!this.sessionToken || !this.sessionId) {
        throw new Error('无法获取会话令牌或会话ID');
      }
      return this.sessionToken;
    } catch (error) {
      console.error(`获取会话令牌失败`, error);
      throw error;
    }
  }

  /**
   * 释放会话
   */
  async closeSession(): Promise<void> {
    if (!this.sessionToken || !this.sessionId) {
      throw new Error('会话令牌或会话ID未设置，请检查配置');
    }
    try {
      await this.customFetch<void>(`${this.baseUrl}${this.sessionUri}/${this.sessionId}`, {method: 'DELETE'});
      this.sessionToken = null;
      this.sessionId = null;
    } catch (error) {
      console.error(`释放会话失败`, error);
      throw error;
    }
  }

  /**
   * 检查 Redfish 是否可访问
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getSessionToken()
      return true;
    } catch (error) {
      console.error('Redfish 不可访问', error);
      return false;
    }
  }

  //endregion

  //region [默认公用接口，获取 System/Manager/Chassis 信息]
  /**
   * 获取可用的系统ID
   * @returns 系统ID数组
   */
  async getAvailableSystemIds(): Promise<string[]> {
    try {
      const {data} = await this.customFetch<Systems>(`${this.baseUrl}/redfish/v1/Systems`);
      if (!data.Members || data.Members.length === 0) {
        throw new Error('未找到任何系统');
      }
      this.systemIds = data.Members.map((member: { [x: string]: string; }) => {
        const parts = member['@odata.id'].split('/');
        return parts[parts.length - 1];
      });
      return this.systemIds;
    } catch (error) {
      console.error('获取系统ID失败', error);
      throw error;
    }
  }

  /**
   * 获取默认首个系统 ID
   */
  async getDefaultSystemId(): Promise<string> {
    if (this.systemIds.length === 0) {
      await this.getAvailableSystemIds();
    }
    return this.systemIds[0];
  }

  /**
   * 获取系统基本信息
   * @param systemId 系统ID
   * @param refresh 是否强制刷新
   * @returns 系统基本信息
   */
  async getSystemInfo(systemId?: string, refresh: boolean = false): Promise<SystemInfo> {
    const sysId = systemId || await this.getDefaultSystemId();
    if (!sysId || sysId === '') {
      throw new Error('未找到系统ID');
    }

    // 如果指定了刷新，则清除缓存并获取最新信息，否则直接返回缓存信息
    if (!refresh && this.systemInfos && this.systemInfos[sysId]) {
      return this.systemInfos[sysId];
    }
    try {
      const {data, headers} = await this.customFetch<SystemInfo>(`${this.baseUrl}/redfish/v1/Systems/${sysId}`);
      data.Etag = headers.get("etag") || '';
      this.systemInfos[sysId] = data;
      return data;
    } catch (error) {
      console.error(`获取系统 ${sysId} 信息失败`, error);
      throw error;
    }
  }

  /**
   * 获取指定系统的管理器 ID
   * @param systemId 系统ID
   * @returns 系统管理器 odata ID
   */
  async getSystemManagerId(systemId?: string): Promise<string> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    // Check if Links exists and if either ManagedBy or Managers exists
    if (!systemInfo.Links) {
      throw new Error('未找到系统链接信息');
    }
    const managers = systemInfo.Links.ManagedBy || systemInfo.Links.Managers;
    if (!managers || managers.length === 0) {
      throw new Error('未找到任何管理器信息');
    }
    return managers[0]['@odata.id'];
  }

  /**
   * 获取管理器信息
   * @param systemId 系统ID
   * @returns 管理器信息
   */
  async getManagerInfo(systemId?: string): Promise<Manager> {
    const sysId = systemId || await this.getDefaultSystemId();
    if (this.managerInfos && this.managerInfos[sysId]) {
      return this.managerInfos[sysId];
    }

    const managerId = await this.getSystemManagerId(systemId);
    try {
      const {data} = await this.customFetch<Manager>(this.baseUrl + managerId);
      this.managerInfos[sysId] = data;
      return data;
    } catch (error) {
      console.error(`获取管理器信息失败(${managerId}):`, error);
      throw error;
    }
  }

  /**
   * 获取机箱信息
   * @param systemId 系统ID
   * @returns 机箱信息
   */
  async getChassisInfo(systemId?: string): Promise<Chassis> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo.Links.Chassis || systemInfo.Links.Chassis.length === 0) {
      throw new Error('未找到机箱信息');
    }
    try {
      const {data} = await this.customFetch<Chassis>(this.baseUrl + systemInfo.Links.Chassis[0]['@odata.id']);
      this.chassisInfos[sysId] = data;
      return data;
    } catch (error) {
      console.error(`获取机箱信息失败(${sysId}):`, error);
      throw error;
    }
  }

  //endregion

  //region [获取硬件信息]
  /**
   * 获取单个CPU信息
   * @param odataId
   */
  async getSingleCPUInfo(odataId: string): Promise<CPUInfo | null> {
    const {data: cpuData} = await this.customFetch<Processor>(this.baseUrl + odataId);
    if (!cpuData) {
      throw new Error('未找到处理器信息');
    }
    if (cpuData.ProcessorType !== 'CPU' || !cpuData.ProcessorArchitecture) {
      console.warn(`${cpuData.Id} 不是CPU处理器或缺少处理器架构信息`);
      return null
    }

    return {
      id: cpuData.Id,
      manufacturer: cpuData.Manufacturer || 'Unknown',
      model: cpuData.Model || 'Unknown',

      architecture: cpuData.ProcessorArchitecture || 'Unknown',
      cores: cpuData.TotalCores || 0,
      threads: cpuData.TotalThreads || 0,
      speedMHz: cpuData.MaxSpeedMHz || 0,
      socket: cpuData.Socket || 'Unknown',

      status: cpuData.Status.State || 'Unknown',
    };
  }

  /**
   * 获取CPU信息
   * @param systemId 系统ID
   * @returns CPU信息
   */
  async getCPUInfo(systemId?: string): Promise<CPUInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);

    try {
      // 获取处理器集合
      const {data: processorsData} = await this.customFetch<ProcessorsCollection>(this.baseUrl + systemInfo.Processors['@odata.id']);
      const processorMembers = processorsData.Members || [];
      if (processorMembers.length === 0) {
        throw new Error('未找到任何处理器');
      }
      // 并行获取所有处理器信息
      const cpuInfoPromises = processorMembers.map(processor =>
        this.getSingleCPUInfo(processor['@odata.id'])
      );
      const results = await Promise.all(cpuInfoPromises);
      return results.filter((cpuInfo): cpuInfo is CPUInfo => cpuInfo !== null) as CPUInfo[];
    } catch (error) {
      console.error(`获取CPU信息失败(${sysId}):`, error);
      throw error;
    }
  }

  /**
   * 获取指定 PCIe 设备信息
   * @param odataId PCIe 设备的 OData ID
   */
  async getSinglePCIeDeviceInfo(odataId: string): Promise<PCIeInfo | null> {
    const {data} = await this.customFetch<PCIeDevice>(this.baseUrl + odataId);
    if (!data || !data.Id) {
      throw new Error('未找到 PCIe 设备信息或缺少设备 ID');
    }
    return {
      id: data.Id,
      manufacturer: data.Manufacturer || 'Unknown',
      model: data.Model || data.Name || 'Unknown',
      type: data.DeviceType || 'Unknown',
      health: data.Status.Health || 'Unknown',
    };
  }

  /**
   * 从 System 中获取PCIe设备信息
   * @param systemId 系统ID
   * @returns PCIe设备信息
   */
  private async getPCIeDevicesInfoFromSystem(systemId?: string): Promise<PCIeInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);

    try {
      if (!systemInfo.PCIeDevices || systemInfo.PCIeDevices.length === 0) {
        console.warn(`系统 ${sysId} 中未找到 PCIe 设备信息`);
        return [] as PCIeInfo[];
      }
      // 获取PCIe设备集合
      const pcieInfoPromises = systemInfo.PCIeDevices.map(pcieDevice =>
        this.getSinglePCIeDeviceInfo(pcieDevice['@odata.id'])
      );
      const results = await Promise.all(pcieInfoPromises);
      return results.filter((pcieInfo): pcieInfo is PCIeInfo => pcieInfo !== null) as PCIeInfo[];
    } catch (error) {
      console.error(`获取PCIe设备信息失败(${sysId}):`, error);
      throw error;
    }
  }

  /**
   * 从 Chassis 中获取PCIe设备信息
   */
  private async getPCIeDevicesInfoFromChassis(systemId?: string): Promise<PCIeInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    const chassisInfo = this.chassisInfos[sysId] || await this.getChassisInfo(sysId);
    try {
      if (!chassisInfo.PCIeDevices) {
        console.warn(`系统 ${sysId}, 机箱 ${chassisInfo.Id} 中未找到 PCIe 设备信息`);
        return [] as PCIeInfo[];
      }
      const pcieUri = chassisInfo.PCIeDevices["@odata.id"];
      const {data} = await this.customFetch<Collection>(this.baseUrl + pcieUri);

      // 获取PCIe设备集合
      const pcieInfoPromises = data.Members.map(pcieDevice =>
        this.getSinglePCIeDeviceInfo(pcieDevice['@odata.id'])
      );
      const results = await Promise.all(pcieInfoPromises);
      return results.filter((pcieInfo): pcieInfo is PCIeInfo => pcieInfo !== null) as PCIeInfo[];
    } catch (error) {
      console.error(`获取PCIe设备信息失败(${sysId}):`, error);
      throw error;
    }
  }

  /**
   * 获取PCIe设备信息
   * @param systemId 系统ID
   * @returns PCIe设备信息
   */
  async getPCIeDevicesInfo(systemId?: string): Promise<PCIeInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    let results: PCIeInfo[] = [];
    try {
      // 优先从系统中获取PCIe设备信息
      results = await this.getPCIeDevicesInfoFromSystem(sysId);
      if (results.length === 0) {
        // 如果系统中未找到，则从机箱中获取
        results = await this.getPCIeDevicesInfoFromChassis(sysId);
      }
      if (results.length === 0) {
        console.warn(`系统 ${sysId} 中未找到 PCIe 设备信息`);
      }
      return results;
    } catch (error) {
      console.error(`获取PCIe设备信息失败(${sysId}):`, error);
      throw error;
    }
  }

  /**
   * 获取指定内存信息
   */
  async getSingleMemoryInfo(odataId: string): Promise<MemoryInfo | null> {
    const {data} = await this.customFetch<Memory>(this.baseUrl + odataId);
    if (!data || !data.Id) {
      throw new Error('未找到内存信息或缺少内存 ID');
    }
    return {
      id: data.Id,
      manufacturer: data.Manufacturer || 'Unknown',
      model: data.PartNumber || data.Name || 'Unknown',
      capacityMiB: data.CapacityMiB,
      speedMHz: data.OperatingSpeedMhz,
      type: data.MemoryDeviceType,
      status: data.Status.State,
    };
  }

  /**
   * 获取内存信息
   * @param systemId 系统ID
   * @returns 内存信息
   */
  async getMemoryInfo(systemId?: string): Promise<MemoryInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);

    try {
      const {data} = await this.customFetch<MemoryCollection>(this.baseUrl + systemInfo.Memory['@odata.id']);
      if (!data.Members || data.Members.length === 0) {
        throw new Error('未找到任何内存信息');
      }
      // 并行获取所有内存信息
      const memoryInfoPromises = data.Members.map(memory =>
        this.getSingleMemoryInfo(memory['@odata.id'])
      );
      const results = await Promise.all(memoryInfoPromises);
      return results.filter((memoryInfo): memoryInfo is MemoryInfo => memoryInfo !== null) as MemoryInfo[];
    } catch (error) {
      console.error(`获取内存信息失败(${sysId}):`, error);
      throw error;
    }
  }

  /**
   * 获取单个网卡端口信息
   */
  async getSingleNetworkPortInfo(odataId: string): Promise<NetworkPortInfo> {
    const {data} = await this.customFetch<NetworkPort>(this.baseUrl + odataId);
    if (!data || !data.Id) {
      throw new Error('未找到网卡端口信息或缺少端口 ID');
    }
    return {
      macAddress: data.AssociatedNetworkAddresses[0] || 'Unknown',
      linkStatus: data.LinkStatus,
      speedMbps: data.CurrentLinkSpeedMbps ? data.CurrentLinkSpeedMbps : -1,
      speedDisplay: data.CurrentLinkSpeedMbps ? `${data.CurrentLinkSpeedMbps}Mbps` : 'Unknown',
    };
  }

  /**
   * 获取单个网卡信息
   */
  async getSingleNetworkCardInfo(odataId: string): Promise<NetworkCardInfo | null> {
    const {data} = await this.customFetch<NetworkAdapter>(this.baseUrl + odataId);
    if (!data || !data.Id) {
      throw new Error('未找到网卡信息或缺少网卡 ID');
    }
    const portCollectionUri = data.NetworkPorts['@odata.id'];
    const {data: portData} = await this.customFetch<Collection>(this.baseUrl + portCollectionUri);
    if (!portData.Members || portData.Members.length === 0) {
      console.warn(`${data.Id} 缺少网卡端口信息`);
      return null;
    }
    // 获取网卡端口集合
    const networkPortPromises = portData.Members.map(networkPort =>
      this.getSingleNetworkPortInfo(networkPort['@odata.id'])
    );
    const networkPorts = await Promise.all(networkPortPromises);
    const ports = networkPorts.filter((networkPort): networkPort is NetworkPortInfo => networkPort !== null) as NetworkPortInfo[];
    return {
      id: data.Id,
      manufacturer: data.Manufacturer || 'Unknown',
      model: data.Model || data.Name || 'Unknown',
      status: data.Status.State || 'Unknown',
      ports: ports
    };
  }

  /**
   * 获取网卡信息
   * @param systemId 系统ID
   * @returns 网卡信息
   */
  async getNetworkInterfaceInfo(systemId?: string): Promise<NetworkCardInfo[]> {
    const sysId = systemId || await this.getDefaultSystemId();
    const chassisInfo = this.chassisInfos[sysId] || await this.getChassisInfo(sysId);
    // 获取网卡 URI
    const networkAdaptersUri = chassisInfo.NetworkAdapters['@odata.id'];
    if (!networkAdaptersUri) {
      console.warn(`系统 ${sysId} 中未找到网卡信息`);
      return [] as NetworkCardInfo[];
    }
    try {
      const {data} = await this.customFetch<Collection>(this.baseUrl + networkAdaptersUri);
      if (!data.Members || data.Members.length === 0) {
        console.warn(`系统 ${sysId} 中未找到网卡信息`);
        return [] as NetworkCardInfo[];
      }
      // 获取网卡集合
      const networkInfoPromises = data.Members.map(networkAdapter =>
        this.getSingleNetworkCardInfo(networkAdapter['@odata.id'])
      );
      const results = await Promise.all(networkInfoPromises);
      if (results.length === 0) {
        console.warn(`系统 ${sysId} 中未找到网卡信息`);
        return [] as NetworkCardInfo[];
      }
      return results.filter((networkInfo): networkInfo is NetworkCardInfo => networkInfo !== null) as NetworkCardInfo[];
    } catch (error) {
      console.error(`获取网卡信息失败(${sysId}):`, error);
      throw error;
    }
  }

  //endregion

  //region [电源管理相关接口]
  /**
   * 获取系统电源状态
   */
  async getSystemPowerState(systemId?: string): Promise<string> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo.PowerState) {
      throw new Error('未找到系统电源状态信息');
    }
    return systemInfo.PowerState;
  }

  /**
   * 设置系统重启电源选项
   * @param systemId 系统ID
   * @param action 重启类型
   */
  private async setSystemPowerState(action: ResetType, systemId?: string,): Promise<boolean> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo) {
      throw new Error('未找到系统信息');
    }
    if (!systemInfo.Actions || !systemInfo.Actions['#ComputerSystem.Reset']) {
      throw new Error('系统不支持电源管理操作');
    }
    const resetUri = systemInfo.Actions['#ComputerSystem.Reset']['target'];
    const resetData = {
      ResetType: action
    };
    try {
      await this.customFetch<void>(this.baseUrl + resetUri, {
        method: 'POST',
        body: JSON.stringify(resetData)
      });
      return true;
    } catch (error) {
      console.error(`设置系统 ${sysId} 电源状态失败`, error);
      throw error;
    }
  }

  /**
   * 电源管理 - 开机
   * @param systemId 系统ID
   */
  async powerOnSystem(systemId?: string): Promise<boolean> {
    return await this.setSystemPowerState(ResetType.On, systemId);
  }

  /**
   * 电源管理 - 关机
   * @param systemId 系统ID
   */
  async shutdownSystem(systemId?: string): Promise<boolean> {
    return await this.setSystemPowerState(ResetType.GracefulShutdown, systemId);
  }

  /**
   * 电源管理 - 强制关机
   * @param systemId 系统ID
   */
  async forceOffSystem(systemId?: string): Promise<boolean> {
    return await this.setSystemPowerState(ResetType.ForceOff, systemId);
  }

  /**
   * 电源管理 - 强制重启
   * @param systemId 系统ID
   */
  async forceRestartSystem(systemId?: string): Promise<boolean> {
    return await this.setSystemPowerState(ResetType.ForceRestart, systemId);
  }

  //endregion

  /**
   * 等待任务完成
   * @param taskId
   * @returns 是否任务执行成功
   */
  async waitForTaskCompletion(taskId: string): Promise<boolean> {
    const startTime = new Date();
    const timeoutMs = 600000; // 最大等待时间 10 分钟

    while (true) {
      try {
        const {data} = await this.customFetch<Task>(this.baseUrl + taskId, {method: 'GET'});
        console.log(JSON.stringify(data));
        // 超过最大等待时间则抛出异常
        const currentTime = new Date();
        if (currentTime.getTime() - startTime.getTime() >= timeoutMs) {
          throw new Error('Timeout of 1 minute has been reached waiting for task completion');
        }
        if (data.TaskState === 'Completed') {
          return data.TaskStatus === 'OK';
        }
        // 等待任务完成
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (error) {
        console.error(`Error checking task status: ${error}`);
        throw error;
      }
    }
  }

  //region [挂载虚拟媒体并设置虚拟媒体为下一个一次性启动设备]
  /**
   * 设置临时下一次启动设备
   * @param systemId 系统ID
   * @param bootDeviceName 启动设备名称
   * @param once 是否一次性启动
   * @returns 是否设置成功
   */
  async setNextBootDevice(
    systemId?: string,
    bootDeviceName: BootSourceOverrideTargets = BootSourceOverrideTargets.Cd,
    once: boolean = true
  ): Promise<boolean> {
    if (this.name === 'iDRACRedfishClient') {
      console.warn("iDRAC Redfish 设置的下一次启动设备为物理设备，不支持设置虚拟媒体");
    }
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo) {
      throw new Error('未找到系统信息');
    }
    if (!systemInfo.Boot || !systemInfo.Boot.BootSourceOverrideEnabled) {
      throw new Error('系统不支持设置下一次启动设备');
    }
    if (systemInfo.Boot["BootSourceOverrideTarget@Redfish.AllowableValues"]) {
      if (!systemInfo.Boot["BootSourceOverrideTarget@Redfish.AllowableValues"].includes(bootDeviceName)) {
        throw new Error(`系统不支持设置指定的启动设备，支持列表：${JSON.stringify(systemInfo.Boot["BootSourceOverrideTarget@Redfish.AllowableValues"])}，当前选择：${bootDeviceName}`);
      }
    }
    const setBootUri = systemInfo['@odata.id'];
    const bootData = {
      Boot: {
        BootSourceOverrideEnabled: once ? 'Once' : 'Continuous',
        BootSourceOverrideTarget: bootDeviceName,
        BootSourceOverrideMode: "UEFI"
      }
    };
    try {
      await this.customFetch<void>(this.baseUrl + setBootUri, {
        method: 'PATCH',
        body: JSON.stringify(bootData),
        headers: systemInfo.Etag ? {'If-Match': systemInfo.Etag} : {}
      });
      return true;
    } catch (error) {
      console.error(`设置系统 ${sysId} 下一次启动设备失败`, error);
      throw error;
    }
  }

  /**
   * 判断当前选择的 VirtualMedia 类型是否支持指定的目标类型
   */
  async getVirtualMedia(odataId: string): Promise<VirtualMedia> {
    const {data} = await this.customFetch<VirtualMedia>(this.baseUrl + odataId);
    if (!data || !data.MediaTypes) {
      throw new Error('未找到虚拟媒体类型信息');
    }
    return data;
  }

  /**
   * 装载虚拟媒体
   * @param imageUri 镜像URI
   * @param matchingMedia 匹配的虚拟媒体设备
   * @returns 是否装载成功
   */
  async mountVirtualMedia(imageUri: string, matchingMedia: VirtualMediaMember): Promise<boolean> {
    throw new NotImplementError('mountVirtualMedia');
  }

  /**
   * 卸载虚拟媒体
   */
  async unmountVirtualMedia(matchingMedia: VirtualMediaMember): Promise<boolean> {
    throw new NotImplementError('unmountVirtualMedia');
  }

  /**
   * 设置虚拟媒体为下一个一次性启动设备 - iDRAC 模式
   * @param mediaType 虚拟媒体类型
   * @param systemId 系统ID
   */
  async setVirtualMediaAsNextBootDevice(mediaType: string = 'CD', systemId?: string): Promise<boolean> {
    throw new NotImplementError('setVirtualMediaAsNextBootDevice');
  }

  /**
   * 装载虚拟媒体并启动
   */
  async bootVirtualMedia(imageUri: string, systemId?: string): Promise<{
    status: boolean,
    matchingMedia: VirtualMediaMember
  }> {
    const sysId = systemId || await this.getDefaultSystemId();
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo) {
      throw new Error('未找到系统信息');
    }

    // 在部分 Redfish 实现中，VirtualMedia 信息可能不在 Manager 信息中，而是在 System 信息中，所以需要做兼容处理
    let virtualMediaUri: string;
    if (systemInfo.VirtualMedia) {
      virtualMediaUri = systemInfo.VirtualMedia['@odata.id'];
    } else {
      const managerInfo = this.managerInfos[sysId] || await this.getManagerInfo(sysId);
      if (!managerInfo.VirtualMedia || !managerInfo.VirtualMedia['@odata.id']) {
        throw new Error('未找到虚拟媒体信息');
      }
      virtualMediaUri = managerInfo.VirtualMedia['@odata.id'];
    }

    // 获取虚拟媒体设备
    const {data: virtualMediaData} = await this.customFetch<VirtualMediaCollection>(this.baseUrl + virtualMediaUri);
    if (!virtualMediaData.Members || virtualMediaData.Members.length === 0) {
      throw new Error('未找到虚拟媒体设备');
    }

    // 判断镜像类型
    const imageType = imageUri.endsWith('.iso') ? 'iso' : imageUri.endsWith('.img') ? 'img' : null;
    if (!imageType) {
      throw new Error('不支持的镜像格式，仅支持 .iso 或 .img 格式');
    }
    const virtualMediaType = imageType === 'iso' ? 'CD' : 'USBStick';

    // 查找支持镜像类型的虚拟媒体设备，选中首个支持的设备
    const virtualMediaPromises = virtualMediaData.Members.map(value => this.getVirtualMedia(value['@odata.id']));
    const virtualMediaList = await Promise.all(virtualMediaPromises);
    const matchingMedia = virtualMediaList.find(media => media.MediaTypes.includes(virtualMediaType) || media.MediaTypes.length === 0);
    if (!matchingMedia) {
      throw new Error(`未找到支持${virtualMediaType}类型的虚拟媒体设备`);
    }

    // 判断虚拟媒体是否已插入，如果已插入则先卸载
    if (matchingMedia.Inserted) {
      const isUnmounted = await this.unmountVirtualMedia(matchingMedia);
      if (!isUnmounted) {
        throw new Error('卸载虚拟媒体失败');
      }
    }
    // 装载虚拟媒体
    const isMounted = await this.mountVirtualMedia(imageUri, matchingMedia);
    if (!isMounted) {
      throw new Error('装载虚拟媒体失败');
    }

    // 设置虚拟媒体为下一个一次性启动设备
    const isSetBoot = await this.setVirtualMediaAsNextBootDevice(virtualMediaType, sysId);
    if (!isSetBoot) {
      throw new Error('设置虚拟媒体为下一个一次性启动设备失败');
    }

    // 刷新系统信息，用于判断是否需要重启
    const latestSystemInfo = await this.getSystemInfo(sysId, true);
    if (latestSystemInfo.PowerState === 'On') {
      // 重启系统
      const isRebooted = await this.forceRestartSystem(sysId);
      if (!isRebooted) {
        throw new Error('重启系统失败');
      }
    } else if (latestSystemInfo.PowerState === 'Off') {
      // 开机
      const isPoweredOn = await this.powerOnSystem(sysId);
      if (!isPoweredOn) {
        throw new Error('开机失败');
      }
    }
    return {status: true, matchingMedia};
  }

  //endregion

  async getKVMUrl(systemId?: string): Promise<string> {
    throw new NotImplementError('getKVMKey');
  }
}
