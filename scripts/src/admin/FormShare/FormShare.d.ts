import { ISharedFormAdminPageProps } from "../admin";

export interface IFormShareProps extends ISharedFormAdminPageProps {
  data: any;
  refreshData: () => any;
  org?: boolean;
}

export interface IFormShareState {
  permissions: any;
  users: any;
  possiblePermissions: string[];
  newUserEmail: string;
}

export interface IPermission {
  [x: string]: boolean;
}
