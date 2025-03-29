import {iDRACRedfishClient, RedfishTypes} from 'redfish-client';

async function input(label: string) {
  process.stdout.write(label);
  for await (const input of console) {
    return input;
  }
}

// 使用示例
async function main() {
  const bmcIpAddress: string | null = process.env.bmc_ip || null;
  const bmcUsername: string | null = process.env.bmc_username || null;
  const bmcPassword: string | null = process.env.bmc_password || null;

  if (!bmcIpAddress || !bmcUsername || !bmcPassword) {
    throw new Error('请设置 BMC 的 IP 地址、用户名和密码');
  }
  let startTime = Date.now();
  const bmcClient = new iDRACRedfishClient(bmcIpAddress, bmcUsername, bmcPassword);
  console.log(`\n已创建 BMC 客户端，耗时 ${Date.now() - startTime} ms`);
  startTime = Date.now();
  try {
    // 获取可用的系统ID
    const systemIds = await bmcClient.getAvailableSystemIds();
    console.log(`\n已获取系统ID列表: ${systemIds.join(', ')}，耗时 ${Date.now() - startTime} ms`);

    // 遍历所有系统，获取信息
    for (const systemId of systemIds) {
      console.log(`\n获取系统 ${systemId} 的信息:`);
      startTime = Date.now();
      const [cpus, memory, pcieDevices] = await Promise.all([
        bmcClient.getCPUInfo(systemId),
        bmcClient.getMemoryInfo(systemId),
        bmcClient.getPCIeDevicesInfo(systemId)
      ]);
      console.log(`\n获取系统基础信息耗时 ${Date.now() - startTime} ms`);
      console.log(JSON.stringify(cpus, null, 2));
      console.log(JSON.stringify(memory, null, 2));
      console.log(JSON.stringify(pcieDevices, null, 2));

      // 挂载虚拟光驱并启动
      const mediaUrl = process.env.image_url || await input('请输入虚拟光驱镜像的URL: ') || '';
      startTime = Date.now();
      const {status: loadSuccess, matchingMedia} = await bmcClient.bootVirtualMedia(mediaUrl, systemId);
      console.log(`\n挂载虚拟光驱${loadSuccess? "成功": "失败"}, 耗时 ${Date.now() - startTime} ms`);
      if (loadSuccess) {
        console.log(JSON.stringify(matchingMedia, null, 2));
      }
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
