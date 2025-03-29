# redfish-client

[\[English Version\]](./README.md)

这是一个用于与支持 Redfish API 的 BMC 交互的库。

该代码已开源，您可从 [GitHub](https://github.com/EM-GeekLab/redfish-client-ts) 获得代码。

NPM 包: [redfish-client](https://www.npmjs.com/package/redfish-client)

## 安装方法：

```bash
bun add redfish-client
```

## 使用方法

```typescript
import {iDRACRedfishClient} from 'redfish-client';

const bmcClient = new iDRACRedfishClient("192.168.0.1", "root", "<YourPassword>")

console.log(`服务器状态：${await bmcClient.isAvailable()}`)
console.log(`服务器信息：${JSON.stringify(await bmcClient.getSystemInfo(), null, 2)}`)

const [cpus, memory, pcieDevices] = await Promise.all([
  bmcClient.getCPUInfo(systemId),
  bmcClient.getMemoryInfo(systemId),
  bmcClient.getPCIeDevicesInfo(systemId)
]);
console.log(`CPU 信息：${JSON.stringify(cpus, null, 2)}`);
console.log(`内存信息：${JSON.stringify(memory, null, 2)}`);
console.log(`PCIe 设备信息：${JSON.stringify(pcieDevices, null, 2)}`);

// 重要提示：不要忘记关闭客户端，Redfish 存在全局会话数量限制，因此需要及时退出 
await bmcClient.closeSession();
```

注意，默认会使用首个获取的 System，但在部分高密度服务器中，可能存在多个 System，可以通过 `getAvailableSystemIds` 获取所有 System 信息，然后通过 `getSystemInfo(sysId)` 获取指定 System 的信息。

## 贡献

由于团队目前仅拥有一台 Dell iDRAC 9 的服务器，因此目前仅在该服务器上进行了测试，如果您开发了其他品牌服务器的 Redfish 支持，欢迎提交 PR。建议主要考虑对 mountVirtualMedia、unmountVirtualMedia 及 setVirtualMediaAsNextBootDevice 的适配。

同时，若您有其他品牌服务器，欢迎使用 [Redfish Mockup Creator](https://github.com/DMTF/Redfish-Mockup-Creator) 对您现有的 Redfish 的服务器进行模拟保存，然后提交 Issue，我们会尽快进行适配。
