import type {NetworkPortInfo, Task, VirtualMedia} from "../types";
import type {HuaweiManager, HuaweiNetworkPort, HuaweiVirtualMedia, KvmService, VmmControlPayload} from "./ibmcType";
import {RedfishClient} from "./base";
import {BootSourceOverrideTargets} from "../enums";

function generateRandomHexString(length: number): string {
  let result = '';
  const characters = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function decimalToPaddedHex(decimal: number, padding: number): string {
  return decimal.toString(16).padStart(padding, '0');
}

export class iBMCRedfishClient extends RedfishClient {
  public readonly name: string = 'iBMCRedfishClient';
  /**
   * 获取单个网卡端口信息 - iBMC 模式
   */
  async getSingleNetworkPortInfo(odataId: string): Promise<NetworkPortInfo> {
    const {data} = await this.customFetch<HuaweiNetworkPort>(this.baseUrl + odataId);
    if (!data || !data.Id) {
      throw new Error('未找到网卡端口信息或缺少端口 ID');
    }
    return {
      macAddress: data.AssociatedNetworkAddresses[0] || 'Unknown',
      linkStatus: data.LinkStatus,
      speedMbps: -1,
      speedDisplay: data.Oem.Huawei.PortMaxSpeed,
    };
  }

  /**
   * 虚拟媒体连接/卸载 - iBMC 模式
   * @param imageUri 镜像URI
   * @param matchingMedia 匹配的虚拟媒体设备
   * @param action 连接/卸载
   */
  async virtualMediaControl(imageUri: string, matchingMedia: HuaweiVirtualMedia, action: string): Promise<boolean> {
    if (!matchingMedia.Oem.Huawei.Actions['#VirtualMedia.VmmControl']) {
      throw new Error('未找到装载虚拟媒体操作');
    }
    const payload: VmmControlPayload = {
      VmmControlType: action
    };
    if (action !== 'Disconnect') {
      payload.Image = imageUri;
      this.log.info(`虚拟媒体操作: ${action}, 镜像URI: ${imageUri}`);
      if (!(imageUri.startsWith("https://") || imageUri.startsWith("nfs://") || imageUri.startsWith("cifs://") || imageUri.startsWith("smb://"))) {
        this.log.error('镜像URI必须以https://、nfs://、smb://或cifs://开头');
        throw new Error('镜像URI必须以https://、nfs://、smb://或cifs://开头');
      }
    }

    try {
      const {data} = await this.customFetch<Task>(this.baseUrl + matchingMedia.Oem.Huawei.Actions['#VirtualMedia.VmmControl'].target, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const taskId = data["@odata.id"];
      if (!taskId) {
        throw new Error('未找到任务ID');
      }
      this.log.debug({taskId, data})
      return await this.waitForTaskCompletion(taskId);
    } catch (error) {
      this.log.error('装载虚拟媒体失败', error);
      throw error;
    }
  }

  /**
   * 装载虚拟媒体 - iBMC 模式
   */
  async mountVirtualMedia(imageUri: string, matchingMedia: VirtualMedia): Promise<boolean> {
    return this.virtualMediaControl(imageUri, matchingMedia as HuaweiVirtualMedia, 'Connect');
  }

  /**
   * 卸载虚拟媒体 - iBMC 模式
   */
  async unmountVirtualMedia(matchingMedia: VirtualMedia): Promise<boolean> {
    return this.virtualMediaControl('', matchingMedia as HuaweiVirtualMedia, 'Disconnect');
  }

  /**
   * 设置虚拟媒体为下一个一次性启动设备 - iBMC 模式
   */
  async setVirtualMediaAsNextBootDevice(mediaType: string = 'CD', systemId?: string): Promise<boolean> {
    const sysId = systemId || await this.getDefaultSystemId();
    const managerInfo = this.managerInfos[sysId] || await this.getManagerInfo(sysId);
    if (!managerInfo) {
      throw new Error('未找到管理器信息');
    }
    const systemInfo = this.systemInfos[sysId] || await this.getSystemInfo(sysId);
    if (!systemInfo) {
      throw new Error('未找到系统信息');
    }
    const bootTarget = mediaType === 'CD' ? BootSourceOverrideTargets.Cd : BootSourceOverrideTargets.Floppy;
    return this.setNextBootDevice(sysId, bootTarget);
  }

  async getKVMUrl(systemId: string): Promise<string> {
    const sysId = systemId || await this.getDefaultSystemId();
    const managerInfo = this.managerInfos[sysId] || await this.getManagerInfo(sysId);
    const huaweiManager = managerInfo as HuaweiManager;
    const kvmService = huaweiManager.Oem.Huawei.KvmService;
    if (!kvmService) {
      throw new Error('未找到KVM信息');
    }

    // 获取KVM服务信息
    const {data: kvmServiceData} = await this.customFetch<KvmService>(this.baseUrl + kvmService["@odata.id"], {"method": 'GET'});
    if (!kvmServiceData) {
      throw new Error('未找到KVM服务信息');
    }
    const setKeyUrl = this.baseUrl + kvmServiceData.Actions["#KvmService.SetKvmKey"].target;
    // 创建随机字符串用于 KVM Key 创建
    const keyId = 1 + Math.floor(Math.random() * 114514);
    const secretKey = generateRandomHexString(64);
    await this.customFetch(setKeyUrl, {
      method: 'POST',
      body: JSON.stringify({
        Id: keyId,
        IdExt: generateRandomHexString(32),
        SecretKey: secretKey,
        Mode: "Shared"
      })
    });

    // 根据是否加密，计算最终用于拉起 KVM 的 Key
    const kvmKey = !kvmServiceData.EncryptionEnabled ? keyId.toString(): (decimalToPaddedHex(keyId, 8) + secretKey);
    return `${this.baseUrl}/remote_access.asp?authParam=${kvmKey}&lp=cn&openway=html5`;
  }
}
