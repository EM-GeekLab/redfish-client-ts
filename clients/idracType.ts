import type {Action, Manager} from "../types";

export interface iDRACManager extends Manager {
  Links: {
    Oem: {
      Dell: {
        DelliDRACCardService: { '@odata.id': string };
        DellJobService: { '@odata.id': string };
        Jobs: { '@odata.id': string };
      }
    }
  }
}

export interface DelliDRACCardService {
  "@odata.id": string;
  Id: string;
  Name: string;
  Actions: Record<string, Action>;
}

export interface DellJobService {
  "@odata.id": string;
  Id: string;
  Name: string;
  Actions: Record<string, Action>;
}

export interface KVMSessionInfo {
  TempPassword: string,
  TempUsername: string,
}