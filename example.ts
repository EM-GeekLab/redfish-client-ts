import {autoDetect} from './index';

// 使用示例
async function main() {
  const bmcIpAddress: string | null = process.env.bmc_ip || null;
  const bmcUsername: string | null = process.env.bmc_username || null;
  const bmcPassword: string | null = process.env.bmc_password || null;
  const mediaUrl: string | null = process.env.image_url || null;
  if (!bmcIpAddress || !bmcUsername || !bmcPassword || !mediaUrl) {
    throw new Error('请设置 BMC 的 IP 地址、用户名和密码，以及镜像的 URL');
  }

  const bmcClient = await autoDetect(bmcIpAddress, bmcUsername, bmcPassword);

  let startTime = Date.now();
  console.log(`\n已创建 BMC 客户端，平台${bmcClient.name}，耗时 ${Date.now() - startTime} ms`);
  startTime = Date.now();
  try {
    // 获取可用的系统ID
    const systemIds = await bmcClient.getAvailableSystemIds();
    console.log(`\n已获取系统ID列表: ${systemIds.join(', ')}，耗时 ${Date.now() - startTime} ms`);

    // 遍历所有系统，获取信息
    for (const systemId of systemIds) {
      console.log(`\n获取系统 ${systemId} 的信息:`);
      startTime = Date.now();
      const [cpus, memory, pcieDevices, networks] = await Promise.all([
        bmcClient.getCPUInfo(systemId),
        bmcClient.getMemoryInfo(systemId),
        bmcClient.getPCIeDevicesInfo(systemId),
        bmcClient.getNetworkInterfaceInfo(systemId),
      ]);
      console.log(`\n获取系统基础信息耗时 ${Date.now() - startTime} ms`);
      console.log(JSON.stringify(cpus, null, 2));
      console.log(JSON.stringify(memory, null, 2));
      console.log(JSON.stringify(pcieDevices, null, 2));
      console.log(JSON.stringify(networks, null, 2));

      // 关键能用上的信息
      console.log(`\n系统ID: ${systemId}`);
      console.log(`CPU 架构: ${cpus[0].architecture}`);
      console.log(`全部 MAC 地址与网卡是否连接的对应关系：`);
      for (const network of networks) {
        console.log(`\n网卡ID: ${network.id}`);
        const ports = network.ports || [];
        for (const port of ports) {
          console.log(`MAC 地址: ${port.macAddress}, 连接状态: ${port.linkStatus}，链路速度: ${port.speedMbps} Mbps`);
        }
        console.log("--------------------\n");
      }

      console.log(`\n=========================================\n`);

      // // 挂载虚拟光驱并启动
      // startTime = Date.now();
      // const {status: loadSuccess, matchingMedia} = await bmcClient.bootVirtualMedia(mediaUrl, systemId);
      // console.log(`\n挂载虚拟光驱${loadSuccess ? "成功" : "失败"}, 耗时 ${Date.now() - startTime} ms`);
      // if (loadSuccess) {
      //   console.log(JSON.stringify(matchingMedia, null, 2));
      // }
    }
    console.log(`\n已退出登录，耗时 ${Date.now() - startTime} ms`);
  } catch (error) {
    console.error('发生错误:', error);
  } finally {
    // 退出登录，Redfish 存在全局会话数量限制，因此需要及时退出
    await bmcClient.closeSession();
  }
}

// 运行主函数
if (require.main === module) {
  main();
}
