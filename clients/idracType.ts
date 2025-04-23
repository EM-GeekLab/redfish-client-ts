import type {Action, Manager} from "../types";

export interface iDRACManager extends Manager {
  Links: {
    Oem: {
      Dell: {
        DellJobService: { '@odata.id': string };
        Jobs: { '@odata.id': string };
      }
    }
  }
}

export interface DellJobService {
  "@odata.id": string;
  Id: string;
  Name: string;
  Actions: Record<string, Action>;
}
