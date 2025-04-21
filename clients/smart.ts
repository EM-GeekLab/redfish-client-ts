import { iDRACRedfishClient } from "./idrac";
import { iBMCRedfishClient } from "./ibmc";
import type {RedfishRoot} from "../types";
import {fetchWithoutSSL} from "../utils";
import pretty from 'pino-pretty'
import {type Logger, pino} from "pino";

const localLogger: Logger =
  process.env.NODE_ENV === 'production'
    ? // JSON in production
    pino({ level: 'info' })
    : // Pretty print in development
    pino({ level: 'debug' }, pretty({
      colorize: true,
    }))

/**
 * autoDetect - 自动根据返回的 Redfish 的数据中的 oem 信息，自动选择对应的客户端
 * @param ip IP地址
 * @param username 用户名
 * @param password 密码
 * @param logger 日志记录器
 */
const autoDetect = async (ip: string, username: string, password: string, logger?: Logger) => {
  logger = logger || localLogger;
  const response = await fetchWithoutSSL(`https://${ip}/redfish/v1`, {method: 'GET'});
  const redfishData: RedfishRoot = await response.json() as RedfishRoot;
  if (!redfishData.Oem) {
    throw new Error('未找到 OEM 信息');
  }
  if ('Dell' in redfishData.Oem) {
    return new iDRACRedfishClient(ip, username, password, logger);
  } else if ('Huawei' in redfishData.Oem) {
    return new iBMCRedfishClient(ip, username, password, logger);
  } else {
    // throw new Error('暂未支持的 OEM 厂商：' + Object.keys(redfishData.Oem).join(', '));
    logger.warn("暂未支持的 OEM 厂商：", Object.keys(redfishData.Oem).join(', '), "，默认使用 iDRAC 客户端，请注意是否支持");
    return new iDRACRedfishClient(ip, username, password, logger);
  }
}

export { autoDetect };
