import type {NetworkPortInfo, VirtualMedia} from "../types";
import type {HuaweiNetworkPort, HuaweiVirtualMedia, VmmControlPayload} from "./ibmcType";
import {RedfishClient} from "./base";
import {BootSourceOverrideTargets} from "../enums";

export class iBMCRedfishClient extends RedfishClient {
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
    if (imageUri === '' || action === 'Disconnect') {
      payload.Image = imageUri;
    }
    try {
      await this.customFetch<void>(this.baseUrl + matchingMedia.Oem.Huawei.Actions['#VirtualMedia.VmmControl'].target, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return true;
    } catch (error) {
      console.error('装载虚拟媒体失败', error);
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
}
