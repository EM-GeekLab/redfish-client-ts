import type {VirtualMedia} from "../types";
import {RedfishClient} from "./base";
import type {DelliDRACCardService, DellJobService, iDRACManager, KVMSessionInfo} from "./idracType.ts";

export class iDRACRedfishClient extends RedfishClient {
  public readonly name: string = 'iDRACRedfishClient';
  /**
   * 装载虚拟媒体 - iDRAC 模式
   * @param imageUri 镜像URI
   * @param matchingMedia 匹配的虚拟媒体设备
   */
  async mountVirtualMedia(imageUri: string, matchingMedia: VirtualMedia): Promise<boolean> {
    if (!matchingMedia.Actions || !matchingMedia.Actions["#VirtualMedia.InsertMedia"]) {
      throw new Error('未找到装载虚拟媒体操作');
    }
    // 装载虚拟媒体
    try {
      await this.customFetch<void>(this.baseUrl + matchingMedia.Actions["#VirtualMedia.InsertMedia"].target, {
        method: 'POST',
        body: JSON.stringify({Image: imageUri})
      });
      return true;
    } catch (error) {
      this.log.error('装载虚拟媒体失败', error);
      throw error;
    }
  }

  /**
   * 卸载虚拟媒体 - iDRAC 模式
   */
  async unmountVirtualMedia(matchingMedia: VirtualMedia): Promise<boolean> {
    if (!matchingMedia.Actions || !matchingMedia.Actions["#VirtualMedia.EjectMedia"]) {
      throw new Error('未找到卸载虚拟媒体操作');
    }
    try {
      await this.customFetch<void>(this.baseUrl + matchingMedia.Actions["#VirtualMedia.EjectMedia"].target, {
        method: 'POST',
        body: JSON.stringify({})
      });
      return true;
    } catch (error) {
      this.log.error('卸载虚拟媒体失败', error);
      throw error;
    }
  }

  /**
   * 设置虚拟媒体为下一个一次性启动设备 - iDRAC 模式
   * @param mediaType 虚拟媒体类型
   * @param systemId 系统ID
   */
  async setVirtualMediaAsNextBootDevice(mediaType: string = 'CD', systemId?: string): Promise<boolean> {
    const sysId = systemId || await this.getDefaultSystemId();
    const managerInfo = (this.managerInfos[sysId] || await this.getManagerInfo(sysId)) as iDRACManager;
    if (!managerInfo) {
      throw new Error('未找到管理器信息');
    }
    if (!managerInfo.Actions || !managerInfo.Actions.Oem || !managerInfo.Actions.Oem["#OemManager.ImportSystemConfiguration"]) {
      throw new Error('系统不支持导入系统配置操作');
    }

    // 删除已有的全部任务，避免后续的任务冲突报错
    const {data: jobCollection} = await this.customFetch<DellJobService>(this.baseUrl + managerInfo.Links.Oem.Dell.DellJobService["@odata.id"]);
    const deleteJobUri = jobCollection.Actions["#DellJobService.DeleteJobQueue"].target;
    await this.customFetch<any>(this.baseUrl + deleteJobUri, {
      method: 'POST',
      body: JSON.stringify({"JobID": "JID_CLEARALL"})
    })

    const actionUri = managerInfo.Actions.Oem["#OemManager.ImportSystemConfiguration"].target;
    const bootDeviceName = mediaType === 'CD' ? 'VCD-DVD' : 'vFDD';
    const payload = {
      "ShareParameters": {"Target": ["ALL"]},
      "ImportBuffer": `<SystemConfiguration><Component FQDD='${managerInfo.Id}'><Attribute Name='ServerBoot.1#BootOnce'>Enabled</Attribute><Attribute Name='ServerBoot.1#FirstBootDevice'>${bootDeviceName}</Attribute></Component></SystemConfiguration>`
    }
    try {
      const {headers} = await this.customFetch<any>(this.baseUrl + actionUri, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      const taskId = headers.get('location');
      if (!taskId) {
        throw new Error('未找到任务ID');
      }
      // 等待任务完成
      const taskOK = await this.waitForTaskCompletion(taskId);
      if (!taskOK) {
        throw new Error('任务执行失败');
      }
      return true;
    } catch (error) {
      this.log.error('设置虚拟媒体为下一个一次性启动设备失败', error);
      throw error;
    }
  }

  async getKVMUrl(systemId: string): Promise<string> {
    const sysId = systemId || await this.getDefaultSystemId();
    const managerInfo = (this.managerInfos[sysId] || await this.getManagerInfo(sysId)) as iDRACManager;
    if (!managerInfo) {
      throw new Error('未找到管理器信息');
    }
    const iDRACUri = managerInfo.Links.Oem.Dell.DelliDRACCardService["@odata.id"];
    const {data: iDRACData} = await this.customFetch<DelliDRACCardService>(this.baseUrl + iDRACUri);
    const kvmUri = iDRACData.Actions["#DelliDRACCardService.GetKVMSession"].target;
    const {data: kvmData} = await this.customFetch<KVMSessionInfo>(this.baseUrl + kvmUri, {
      method: 'POST',
      body: JSON.stringify({"SessionTypeName":"ssl_cert.txt"})
    });
    return `${this.baseUrl}/console?username=${this.userName}&tempUsername=${kvmData.TempUsername}&tempPassword=${kvmData.TempPassword}`
  }
}