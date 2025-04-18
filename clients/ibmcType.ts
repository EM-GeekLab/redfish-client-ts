import type {VirtualMedia, Action, NetworkPort} from "../types";

export interface HuaweiVirtualMedia extends VirtualMedia {
  Oem: {
    Huawei: {
      Actions: Record<string, Action>;
    }
  }
}

export interface VmmControlPayload {
  VmmControlType: string;
  Image?: string;
}

export interface HuaweiNetworkPort extends NetworkPort {
  CurrentLinkSpeedMbps?: never; // 该字段在 iBMC 中不支持
  Oem: {
    Huawei: {
      PortMaxSpeed: string;
    }
  }
}
