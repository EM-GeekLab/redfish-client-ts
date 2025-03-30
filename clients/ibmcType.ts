import type {VirtualMedia, Action} from "../types";

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
