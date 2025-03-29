# redfish-client
[\[中文文档\]](./README.cn.md)

This is a library for interacting with BMCs that support the Redfish API.

The library is open-source, you can get code in [GitHub](https://github.com/EM-GeekLab/redfish-client-ts).

NPM Package: [redfish-client](https://www.npmjs.com/package/redfish-client)

## To install:

```bash
bun add redfish-client
```

## To Use

```typescript
import {iDRACRedfishClient} from 'redfish-client';

const bmcClient = new iDRACRedfishClient("192.168.0.1", "root", "<YourPassword>")

console.log(`Server Status: ${await bmcClient.isAvailable()}`)
console.log(`Server Info: ${JSON.stringify(await bmcClient.getSystemInfo(), null, 2)}`)

const [cpus, memory, pcieDevices] = await Promise.all([
  bmcClient.getCPUInfo(systemId),
  bmcClient.getMemoryInfo(systemId),
  bmcClient.getPCIeDevicesInfo(systemId)
]);
console.log(`CPU Info: ${JSON.stringify(cpus, null, 2)}`);
console.log(`Memory Info: ${JSON.stringify(memory, null, 2)}`);
console.log(`PCIe Devices Info: ${JSON.stringify(pcieDevices, null, 2)}`);

// Important: Don't forget to close the client, Redfish has a global session limit, so you need to exit promptly
await bmcClient.closeSession();
```

Note: By default, the first obtained System will be used. However, in some high-density servers, there might be multiple Systems. You can get all System information via `getAvailableSystemIds` and then get specific System information using `getSystemInfo(sysId)`.

## Contributing

Since our team currently only has one Dell iDRAC 9 server, testing has only been done on this server. If you develop Redfish support for other server brands, feel free to submit a PR. It's recommended to focus mainly on adapting `mountVirtualMedia`, `unmountVirtualMedia`, and `setVirtualMediaAsNextBootDevice`.

Additionally, if you have servers from other brands, we welcome you to use [Redfish Mockup Creator](https://github.com/DMTF/Redfish-Mockup-Creator) to create a simulation of your existing Redfish server and submit an Issue. We will try to adapt it as soon as possible.